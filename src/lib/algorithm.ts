import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, startOfISOWeek, subDays } from 'date-fns';
import { timeToMinutes, calculateActualWorkingHours } from '../utils/timeUtils';
import { UNASSIGNED_STAFF_ID, SHIFT_DAY, DEFAULT_CLOSED_DAYS } from '../constants';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass, ShiftRequirement, ShiftTimePattern, RotationSettings, BreakSettings } from '../types';

/**
 * Check if a staff member is available for a specific date
 */
export const isStaffAvailable = (
    staff: Staff,
    date: Date,
    dateStr: string,
    preferences: ShiftPreference[]
): boolean => {
    return isStaffAvailableReason(staff, date, dateStr, preferences) === 'available';
};

/**
 * Get the reason why a staff member is unavailable for a specific date
 */
export const isStaffAvailableReason = (
    staff: Staff,
    date: Date,
    dateStr: string,
    preferences: ShiftPreference[]
): 'available' | 'preference' | 'fixed' => {
    // 1. Check Shift Preference (休日管理) - 終日不可のみチェック
    const pref = preferences.find(p => p.staffId === staff.id);
    if (pref) {
        // details がある場合: startTime/endTimeが両方nullのエントリが終日不可
        if (pref.details && pref.details.length > 0) {
            const fullDayEntry = pref.details.find(d => d.date === dateStr && !d.startTime && !d.endTime);
            if (fullDayEntry) return 'preference';
        }
    }

    // 2. Check Staff Base Availability (スタッフ管理)
    const dayOfWeek = getDay(date);
    if (!staff.availableDays || staff.availableDays.length === 0) return 'available';

    const nthWeek = Math.ceil(date.getDate() / 7);
    const config = staff.availableDays.find(d => (typeof d === 'number' ? d : d.day) === dayOfWeek);
    if (!config) return 'fixed';
    if (typeof config === 'object' && config.weeks && !config.weeks.includes(nthWeek)) return 'fixed';

    return 'available';
};

/**
 * Check if a staff member is available for a specific time slot
 * This checks both the day availability and overlapping shifts
 */
const isStaffAvailableForTimeSlot = (
    staff: Staff,
    date: Date,
    dateStr: string,
    startTime: string,
    endTime: string,
    preferences: ShiftPreference[],
    existingShifts: Shift[],
    roles: DynamicRole[],
    holidays: string[] = [] // YYYY-MM-DD
): { available: boolean; matchingPattern?: ShiftTimePattern } => {
    // First check basic day availability (full-day unavailable)
    if (!isStaffAvailable(staff, date, dateStr, preferences)) return { available: false };

    // Check partial-day unavailability from preference details
    const pref = preferences.find(p => p.staffId === staff.id);
    if (pref?.details) {
        const partialEntries = pref.details.filter(d => d.date === dateStr && d.startTime && d.endTime);
        for (const entry of partialEntries) {
            // Convert to minutes for robust comparison (handles midnight crossing better if it occurs)
            const sMin = timeToMinutes(startTime);
            let eMin = timeToMinutes(endTime);
            if (eMin < sMin) eMin += 24 * 60;

            const usMin = timeToMinutes(entry.startTime!);
            let ueMin = timeToMinutes(entry.endTime!);
            if (ueMin < usMin) ueMin += 24 * 60;

            // Check if [sMin, eMin] overlaps with [usMin, ueMin]
            if (sMin < ueMin && eMin > usMin) {
                return { available: false };
            }
        }
    }

    const roleRecord = roles.find(r => r.name === staff.role || r.id === staff.role);
    const dayOfWeek = getDay(date);
    const dayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[dayOfWeek];
    const isHolidayDate = holidays.includes(dateStr);

    // Filter patterns based on requirements
    // 1. Role match (if pattern has roleIds, staff must have one of them)
    // 2. Day of week match
    // 3. Holiday match
    // 4. Time containment

    // We need to look at ALL patterns that could apply to this staff's role
    // OR patterns that are general (no roleIds)
    // and then filter by day/holiday and time.

    // Let's assume roles[].patterns contains all patterns (enriched with their metadata)
    // Wait, roles[].patterns in DynamicRole actually comes from the DB (role_patterns join).
    // In algorithm.ts, we should probably have access to the full pattern definitions
    // or the roleRecord.patterns should already contain the new metadata.

    // In our implementation plan, ShiftTimePattern has the new fields.
    // DynamicRole.patterns is an array of ShiftTimePattern.

    if (roleRecord && roleRecord.patterns && roleRecord.patterns.length > 0) {
        const potentialPatterns = roleRecord.patterns.filter(p => {
            // 1. Check if it's assigned to this role (handled by roleRecord.patterns)

            // 2. Check Day/Holiday restriction
            if (isHolidayDate) {
                if (p.holiday === 0) return false;
            } else {
                if (p[dayKey] === 0) return false;
            }

            // 3. Time containment
            return p.startTime <= startTime && p.endTime >= endTime;
        });

        // Use the first matching pattern (sorted by display_order from API)
        const matchedPattern = potentialPatterns[0];
        if (!matchedPattern) return { available: false };

        // Check for overlapping shifts
        const checkStart = matchedPattern.startTime;
        const checkEnd = matchedPattern.endTime;

        const hasOverlap = existingShifts.some(shift => {
            if (shift.staffId !== staff.id || shift.date !== dateStr) return false;
            if (shift.isError) return false;
            return (checkStart < shift.endTime && checkEnd > shift.startTime);
        });

        if (hasOverlap) return { available: false };

        return { available: true, matchingPattern: matchedPattern };
    }

    // Default behavior if no role patterns are defined (direct time slot matching)
    // But usually we want to enforce patterns if they exist.
    // If no patterns are defined for the role, we fall back to the requirement's time.
    const hasOverlap = existingShifts.some(shift => {
        if (shift.staffId !== staff.id || shift.date !== dateStr) return false;
        if (shift.isError) return false;
        return (startTime < shift.endTime && endTime > shift.startTime);
    });

    if (hasOverlap) return { available: false };

    return { available: true };
};

/**
 * Count staff assigned to a specific time slot
 */
const countStaffInTimeSlot = (
    existingShifts: Shift[],
    dateStr: string,
    startTime: string,
    endTime: string,
    classId: string
): number => {
    return existingShifts.filter(shift => {
        if (shift.date !== dateStr) return false;
        if (shift.classType !== classId) return false;
        if (shift.isError) return false;
        if (shift.staffId === UNASSIGNED_STAFF_ID) return false;

        // Check if the shift overlaps with the time slot
        return (shift.startTime < endTime && shift.endTime > startTime);
    }).length;
};

/**
 * Find available staff for a specific time slot
 */
const findAvailableStaff = (
    staffList: Staff[],
    date: Date,
    dateStr: string,
    startTime: string,
    endTime: string,
    preferences: ShiftPreference[],
    existingShifts: Shift[],
    currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>,
    roles: DynamicRole[],
    holidays: string[] = [],
    breakSettings?: BreakSettings
): Array<{ staff: Staff; pattern?: ShiftTimePattern }> => {
    return staffList
        .map(staff => ({
            staff,
            result: isStaffAvailableForTimeSlot(staff, date, dateStr, startTime, endTime, preferences, existingShifts, roles, holidays)
        }))
        .filter(({ result }) => result.available)
        .map(({ staff, result }) => ({ staff, pattern: result.matchingPattern }))
        .sort((a, b) => {
            // Priority 1: Role display_order
            const roleA = roles.find(r => r.name === a.staff.role || r.id === a.staff.role);
            const roleB = roles.find(r => r.name === b.staff.role || r.id === b.staff.role);
            const orderA = roleA ? roleA.display_order : 999;
            const orderB = roleB ? roleB.display_order : 999;

            if (orderA !== orderB) return orderA - orderB;

            // Priority 2: Avoid consecutive same-time shifts (連日同じ時間帯を避ける)を最優先
            // 過去月の労働時間差が繰り越されている場合、hoursDiffが常に存在し固定されてしまうため、
            // シフト種別（早番/遅番）のローテーションを時間差よりも優先します。
            const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');
            const yesterdayShiftA = existingShifts.find(s => s.staffId === a.staff.id && s.date === yesterdayStr);
            const yesterdayShiftB = existingShifts.find(s => s.staffId === b.staff.id && s.date === yesterdayStr);
            
            const isEarly = (time: string) => time < '12:00';
            const reqIsEarly = isEarly(startTime);
            const aGotSame = yesterdayShiftA && isEarly(yesterdayShiftA.startTime) === reqIsEarly ? 1 : 0;
            const bGotSame = yesterdayShiftB && isEarly(yesterdayShiftB.startTime) === reqIsEarly ? 1 : 0;
            
            if (aGotSame !== bGotSame) {
                return aGotSame - bGotSame; // 1 = demote A, -1 = demote B
            }

            // Priority 3: Hours balance (労働時間差による均等化 - シフトに入れるかどうかの判定用)
            const hoursDiff = currentHours[a.staff.id] - currentHours[b.staff.id];
            if (hoursDiff !== 0) return hoursDiff;

            // Priority 4: Break ties with a daily varying rotation to prevent permanent fixed assignments
            const hashA = (date.getDate() * 31 + a.staff.id.charCodeAt(a.staff.id.length - 1)) % 100;
            const hashB = (date.getDate() * 31 + b.staff.id.charCodeAt(b.staff.id.length - 1)) % 100;
            return hashA - hashB;
        })
        .filter(({ staff, pattern }) => {
            const shiftStart = pattern ? pattern.startTime : startTime;
            const shiftEnd = pattern ? pattern.endTime : endTime;
            const duration = calcDuration(shiftStart, shiftEnd, breakSettings);

            if (staff.hoursTarget !== null && currentHours[staff.id] + duration > staff.hoursTarget) {
                return false;
            }

            if (staff.weeklyHoursTarget !== null && staff.weeklyHoursTarget !== undefined) {
                const weekKey = `w-${format(startOfISOWeek(date), 'yyyy-MM-dd')}`;
                const currentWeekHrs = currentWeeklyHours[staff.id][weekKey] || 0;
                if (currentWeekHrs + duration > staff.weeklyHoursTarget) {
                    return false;
                }
            }

            return true;
        });
};

/**
 * Get requirements applicable to a specific day
 */
const getRequirementsForDay = (
    requirements: ShiftRequirement[],
    dayOfWeek: number,
    classIds: string[]
): ShiftRequirement[] => {
    return requirements
        .filter(req => {
            // Check if requirement applies to this day of week
            // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
            // req.dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat, 7=Weekdays (Mon-Fri), 8=Everyday
            const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

            let dayMatches = false;
            if (req.dayOfWeek === SHIFT_DAY.EVERYDAY) {
                dayMatches = true; // Everyday
            } else if (req.dayOfWeek === SHIFT_DAY.WEEKDAYS) {
                dayMatches = isWeekday; // Weekdays only
            } else {
                dayMatches = req.dayOfWeek === dayOfWeek;
            }

            // Only include requirements for classes that exist
            const classExists = classIds.includes(req.classId);

            return dayMatches && classExists;
        })
        .sort((a, b) => b.priority - a.priority); // Higher priority first
};

/**
 * Calculate shift duration in hours
 */
const calcDuration = (startTime: string, endTime: string, breakSettings?: BreakSettings): number => {
    if (breakSettings && breakSettings.displayActualHoursInModal) { // 便宜上ここでチェック、本来は休憩計算
        return calculateActualWorkingHours(startTime, endTime, breakSettings);
    }
    const startMins = timeToMinutes(startTime);
    let endMins = timeToMinutes(endTime);
    if (endTime < startTime) endMins += 24 * 60;
    return (endMins - startMins) / 60;
};

/**
 * Add a rotation shift and update hour tracking
 */
const addRotationShift = (
    generatedShifts: Shift[],
    dateStr: string,
    date: Date,
    staff: Staff,
    pattern: ShiftTimePattern,
    classes: ShiftClass[],
    currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>,
    shiftType: 'early' | 'late',
    breakSettings?: BreakSettings
): void => {
    // 全クラス共通: 先頭のクラスIDを使用
    const classId = classes[0]?.id || '';
    generatedShifts.push({
        id: `rot_${dateStr}_${shiftType}_${staff.id}`,
        date: dateStr,
        staffId: staff.id,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        classType: classId,
        isEarlyShift: shiftType === 'early'
    });

    const duration = calcDuration(pattern.startTime, pattern.endTime, breakSettings);
    currentHours[staff.id] += duration;
    const weekKey = `w-${format(startOfISOWeek(date), 'yyyy-MM-dd')}`;
    currentWeeklyHours[staff.id][weekKey] = (currentWeeklyHours[staff.id][weekKey] || 0) + duration;
};

/**
 * Apply rotation logic for full-time staff (正社員ローテーション)
 *
 * Rules:
 * - Weekdays: earlyCount early + lateCount late shifts
 * - One of previous day's late shift workers becomes today's early
 * - Previous day's early worker goes to late shift
 * - Saturday: prefer Friday's late shift workers
 */
const applyRotation = (
    days: Date[],
    settings: RotationSettings,
    staffList: Staff[],
    preferences: ShiftPreference[],
    generatedShifts: Shift[],
    currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>,
    closedDays: number[],
    holidays: string[],
    fixedDates: string[],
    existingShifts: Shift[],
    allPatterns: ShiftTimePattern[],
    classes: ShiftClass[],
    breakSettings?: BreakSettings
): void => {
    const rotationStaff = staffList.filter(s => s.role === settings.roleId);
    if (rotationStaff.length === 0) return;

    const earlyPattern = allPatterns.find(p => p.id === settings.earlyPatternId);
    const latePattern = allPatterns.find(p => p.id === settings.latePatternId);
    if (!earlyPattern || !latePattern) return;

    let previousDayEarly: string[] = [];
    let previousDayLate: string[] = [];

    const lastEarlyShift: Record<string, string> = {};
    const lastLateShift: Record<string, string> = {};
    const earlyShiftCount: Record<string, number> = {};
    const lateShiftCount: Record<string, number> = {};

    rotationStaff.forEach(s => {
        earlyShiftCount[s.id] = 0;
        lateShiftCount[s.id] = 0;
    });

    // Restore previous day state from last working day of previous month
    const firstDay = days[0];
    const prevMonthShifts = existingShifts.filter(s => s.date < format(firstDay, 'yyyy-MM-dd'));
    if (prevMonthShifts.length > 0) {
        // Find the last working day's shifts
        const sortedDates = [...new Set(prevMonthShifts.map(s => s.date))].sort();
        const lastWorkingDay = sortedDates[sortedDates.length - 1];

        for (const shift of prevMonthShifts) {
            if (!rotationStaff.some(rs => rs.id === shift.staffId)) continue;
            if (shift.startTime === earlyPattern.startTime && shift.endTime === earlyPattern.endTime) {
                if (!lastEarlyShift[shift.staffId] || shift.date > lastEarlyShift[shift.staffId]) {
                    lastEarlyShift[shift.staffId] = shift.date;
                }
                if (shift.date === lastWorkingDay) {
                    previousDayEarly.push(shift.staffId);
                }
            } else if (shift.startTime === latePattern.startTime && shift.endTime === latePattern.endTime) {
                if (!lastLateShift[shift.staffId] || shift.date > lastLateShift[shift.staffId]) {
                    lastLateShift[shift.staffId] = shift.date;
                }
                if (shift.date === lastWorkingDay) {
                    previousDayLate.push(shift.staffId);
                }
            }
        }
    }

    const sortByEarlyPriority = (a: Staff, b: Staff) => {
        const countA = earlyShiftCount[a.id] || 0;
        const countB = earlyShiftCount[b.id] || 0;
        if (countA !== countB) return countA - countB; // 1. 回数が少ない人を最優先

        const dateA = lastEarlyShift[a.id] || '2000-01-01';
        const dateB = lastEarlyShift[b.id] || '2000-01-01';
        if (dateA !== dateB) return dateA.localeCompare(dateB); // 2. 久しぶりの人を優先

        return currentHours[a.id] - currentHours[b.id]; // 3. 労働時間
    };

    const sortByLatePriority = (a: Staff, b: Staff) => {
        const countA = lateShiftCount[a.id] || 0;
        const countB = lateShiftCount[b.id] || 0;
        if (countA !== countB) return countA - countB;

        const dateA = lastLateShift[a.id] || '2000-01-01';
        const dateB = lastLateShift[b.id] || '2000-01-01';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        return currentHours[a.id] - currentHours[b.id];
    };

    for (const date of days) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);

        // Skip closed days, holidays, and fixed dates
        if (closedDays.includes(dayOfWeek) || holidays.includes(dateStr) || fixedDates.includes(dateStr)) {
            continue;
        }

        const available = rotationStaff.filter(s =>
            isStaffAvailable(s, date, dateStr, preferences)
        );

        if (available.length === 0) {
            continue;
        }

        // Saturday handling
        if (dayOfWeek === 6) {
            if (settings.saturdayEnabled) {
                let candidates: Staff[];
                if (settings.saturdayPreferFridayLate && previousDayLate.length > 0) {
                    const fridayLate = available.filter(s => previousDayLate.includes(s.id))
                        .sort(sortByLatePriority);
                    const others = available.filter(s => !previousDayLate.includes(s.id))
                        .sort(sortByLatePriority);
                    candidates = [...fridayLate, ...others];
                } else {
                    candidates = [...available].sort(sortByLatePriority);
                }

                const saturdayAssigned: string[] = [];
                for (let i = 0; i < settings.saturdayCount && i < candidates.length; i++) {
                    addRotationShift(generatedShifts, dateStr, date, candidates[i], latePattern, classes, currentHours, currentWeeklyHours, 'late', breakSettings);
                    saturdayAssigned.push(candidates[i].id);
                    lastLateShift[candidates[i].id] = dateStr;
                    lateShiftCount[candidates[i].id] = (lateShiftCount[candidates[i].id] || 0) + 1;
                }
                // 土曜に遅番として入ったスタッフも前日遅番候補に加える（金曜の遅番だったスタッフも月曜の早番候補として残すため）
                previousDayLate = Array.from(new Set([...previousDayLate, ...saturdayAssigned]));
                // previousDayEarlyはクリアしない（金曜早番のスタッフは月曜遅番の優先に入るため）
            }
            continue;
        }

        // Weekday handling (Mon-Fri)
        if (dayOfWeek < 1 || dayOfWeek > 5) {
            // Sunday is typically a closed day, but handle gracefully
            continue;
        }

        const earlyAssigned: string[] = [];
        const lateAssigned: string[] = [];

        // === Early shift assignment ===
        // 通常の候補（昨日の早番以外）
        const normalForEarly = available.filter(s => !previousDayEarly.includes(s.id))
            .sort(sortByEarlyPriority);
        // 昨日の早番（連続になるため優先度を下げて最終候補にする）
        const prevEarlyForEarly = available.filter(s => previousDayEarly.includes(s.id))
            .sort(sortByEarlyPriority);

        const earlyCandidates = [...normalForEarly, ...prevEarlyForEarly];

        for (let i = 0; i < settings.weekdayEarlyCount; i++) {
            const candidate = earlyCandidates.find(s => !earlyAssigned.includes(s.id));
            if (candidate) {
                addRotationShift(generatedShifts, dateStr, date, candidate, earlyPattern, classes, currentHours, currentWeeklyHours, 'early', breakSettings);
                earlyAssigned.push(candidate.id);
                lastEarlyShift[candidate.id] = dateStr;
                earlyShiftCount[candidate.id] = (earlyShiftCount[candidate.id] || 0) + 1;
            }
        }

        // === Late shift assignment ===
        // 通常の候補（昨日遅番以外）
        const normalForLate = available.filter(s => !previousDayLate.includes(s.id) && !earlyAssigned.includes(s.id))
            .sort(sortByLatePriority);
        // 昨日の遅番（連続になるため優先度を下げて最終候補にする）
        const prevLateForLate = available.filter(s => previousDayLate.includes(s.id) && !earlyAssigned.includes(s.id))
            .sort(sortByLatePriority);

        const lateCandidates = [...normalForLate, ...prevLateForLate];

        for (let i = 0; i < settings.weekdayLateCount; i++) {
            const candidate = lateCandidates.find(s =>
                !earlyAssigned.includes(s.id) && !lateAssigned.includes(s.id)
            );
            if (candidate) {
                addRotationShift(generatedShifts, dateStr, date, candidate, latePattern, classes, currentHours, currentWeeklyHours, 'late', breakSettings);
                lateAssigned.push(candidate.id);
                lastLateShift[candidate.id] = dateStr;
                lateShiftCount[candidate.id] = (lateShiftCount[candidate.id] || 0) + 1;
            }
        }

        previousDayEarly = earlyAssigned;
        previousDayLate = lateAssigned;
    }
};

/**
 * Heuristic shift generator.
 * Assigns shifts day by day for a given month based on staff availability,
 * requirements per time slot, and balancing rules.
 */
export const generateShiftsForMonth = (
    yearMonth: string, // e.g. '2024-04'
    staffList: Staff[],
    preferences: ShiftPreference[],
    roles: DynamicRole[],
    classes: ShiftClass[],
    holidays: string[] = [], // YYYY-MM-DD format
    requirements: ShiftRequirement[] = [], // New: shift requirements
    existingShifts: Shift[] = [], // New: shifts from adjacent months for weekly hours context
    fixedDates: string[] = [], // New: locked dates to avoid rewriting
    closedDays: number[] = DEFAULT_CLOSED_DAYS, // New: 施設が休館の曜日リスト (0=日, 1=月...6=土)
    rotationSettings?: RotationSettings, // ローテーション設定
    timePatterns?: ShiftTimePattern[], // 追加: アプリ全体のシフトパターン
    breakSettings?: BreakSettings // 休憩設定
): Shift[] => {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const generatedShifts: Shift[] = [];

    // Tracking staff hours for the month to balance
    const currentHours: Record<string, number> = {};
    const currentWeeklyHours: Record<string, Record<string, number>> = {};
    staffList.forEach(s => {
        currentHours[s.id] = 0;
        currentWeeklyHours[s.id] = {};
    });

    // Populate currentWeeklyHours with context from existing shifts
    existingShifts.forEach(shift => {
        if (!shift.staffId || shift.staffId === UNASSIGNED_STAFF_ID || shift.isError) return;
        const shiftDate = new Date(shift.date);
        const weekKey = `w-${format(startOfISOWeek(shiftDate), 'yyyy-MM-dd')}`;
        
        const duration = calcDuration(shift.startTime, shift.endTime, breakSettings);
        
        if (shift.date.startsWith(yearMonth)) {
            currentHours[shift.staffId] += duration;
        }

        if (!currentWeeklyHours[shift.staffId]) {
            currentWeeklyHours[shift.staffId] = {};
        }
        currentWeeklyHours[shift.staffId][weekKey] = (currentWeeklyHours[shift.staffId][weekKey] || 0) + duration;
    });

    // Apply rotation logic before the main requirement-based loop
    if (rotationSettings?.enabled) {
        const allPatterns = timePatterns && timePatterns.length > 0 ? timePatterns : roles.flatMap(r => r.patterns);
        applyRotation(
            days, rotationSettings, staffList, preferences,
            generatedShifts, currentHours, currentWeeklyHours,
            closedDays, holidays, fixedDates, existingShifts, allPatterns, classes, breakSettings
        );
    }

    const classIds = classes.map(c => c.id);

    days.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);

        if (closedDays.includes(dayOfWeek) || holidays.includes(dateStr) || fixedDates.includes(dateStr)) {
            return; // 休館日・祝日・固定日はスキップ
        }

        const availableStaff = staffList.filter(staff =>
            isStaffAvailable(staff, date, dateStr, preferences)
        );

        // 曜日の必要要件を取得（優先度順）
        const dayRequirements = getRequirementsForDay(requirements, dayOfWeek, classIds);

        // 要件に基づいてスタッフを割り当てる
        dayRequirements.forEach(req => {
            // 現時点でこの時間帯・クラスに割り当て済みの人数を確認
            const currentCount = countStaffInTimeSlot(generatedShifts, dateStr, req.startTime, req.endTime, req.classId);
            const needed = req.minStaffCount - currentCount;

            if (needed > 0) {
                // 利用可能なスタッフを探す（既に別スロットに割り当て済みの人は除外される）
                const candidates = findAvailableStaff(
                    availableStaff,
                    date,
                    dateStr,
                    req.startTime,
                    req.endTime,
                    preferences,
                    generatedShifts,
                    currentHours,
                    currentWeeklyHours,
                    roles,
                    holidays,
                    breakSettings
                );

                for (let i = 0; i < needed; i++) {
                    if (candidates[i]) {
                        const { staff, pattern } = candidates[i];
                        const shiftStart = pattern ? pattern.startTime : req.startTime;
                        const shiftEnd = pattern ? pattern.endTime : req.endTime;

                        generatedShifts.push({
                            id: `gen_${dateStr}_req_${req.id}_${staff.id}_${i}`,
                            date: dateStr,
                            staffId: staff.id,
                            startTime: shiftStart,
                            endTime: shiftEnd,
                            classType: req.classId,
                            isEarlyShift: true
                        });

                        // 労働時間を加算
                        // 日またぎ対応は calcDuration が処理
                        const duration = calcDuration(shiftStart, shiftEnd, breakSettings);
                        currentHours[staff.id] += duration;
                        
                        const weekKey = `w-${format(startOfISOWeek(date), 'yyyy-MM-dd')}`;
                        currentWeeklyHours[staff.id][weekKey] = (currentWeeklyHours[staff.id][weekKey] || 0) + duration;

                        // 重要: パターンで割り当てた場合、このスタッフが同じ日の他の要件も
                        // 同時に満たしている可能性があるため、ループの次の反復で
                        // countStaffInTimeSlot が正しく機能するように既存の配列に追加済み。
                    } else {
                        // スタッフが足りない場合はエラーシフトを作成
                        generatedShifts.push({
                            id: `err_${dateStr}_req_${req.id}_miss_${i}`,
                            date: dateStr,
                            staffId: UNASSIGNED_STAFF_ID,
                            startTime: req.startTime,
                            endTime: req.endTime,
                            classType: req.classId,
                            isError: true,
                            isEarlyShift: false
                        });
                    }
                }
            }
        });

    });

    return generatedShifts;
};

/**
 * Generate shifts with requirements fetched from API
 * This is a convenience wrapper that can be used when requirements are fetched separately
 */
export const generateShiftsForMonthWithRequirements = async (
    yearMonth: string,
    staffList: Staff[],
    preferences: ShiftPreference[],
    roles: DynamicRole[],
    classes: ShiftClass[],
    holidays: string[] = [],
    fetchRequirements: () => Promise<ShiftRequirement[]>,
    existingShifts: Shift[] = [],
    fixedDates: string[] = [],
    closedDays: number[] = DEFAULT_CLOSED_DAYS,
    rotationSettings?: RotationSettings,
    timePatterns?: ShiftTimePattern[],
    breakSettings?: BreakSettings
): Promise<Shift[]> => {
    const requirements = await fetchRequirements();
    return generateShiftsForMonth(
        yearMonth,
        staffList,
        preferences,
        roles,
        classes,
        holidays,
        requirements,
        existingShifts,
        fixedDates,
        closedDays,
        rotationSettings,
        timePatterns,
        breakSettings
    );
};

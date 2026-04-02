import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, startOfISOWeek, subDays } from 'date-fns';
import { timeToMinutes, calculateActualWorkingHours } from '../utils/timeUtils';
import { UNASSIGNED_STAFF_ID, SHIFT_DAY, DEFAULT_CLOSED_DAYS } from '../constants';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass, ShiftRequirement, ShiftTimePattern, RotationSettings, BreakSettings } from '../types';

export { isStaffAvailable, isStaffAvailableReason } from './availabilityUtils';
import { isStaffAvailable } from './availabilityUtils';
import { applyRotation } from './rotationAlgorithm';

/** roles 配列から name と id 両方で引ける Map を構築する（O(1) ルックアップ用） */
const buildRoleMap = (roles: DynamicRole[]): Map<string, DynamicRole> => {
    const map = new Map<string, DynamicRole>();
    for (const r of roles) {
        map.set(r.id, r);
        map.set(r.name, r);
    }
    return map;
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
    holidays: string[] = [], // YYYY-MM-DD
    closedDays: number[] = [] // 0=日, 1=月, ..., 6=土, 7=祝日
): { available: boolean; matchingPattern?: ShiftTimePattern } => {
    // First check basic day availability (full-day unavailable)
    // closedDays と isNationalHoliday を専門の引数経由で渡す
    if (!isStaffAvailable(staff, date, dateStr, preferences, closedDays, holidays.includes(dateStr))) return { available: false };

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

    const roleMap = buildRoleMap(roles);
    const roleRecord = roleMap.get(staff.role);
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
    breakSettings?: BreakSettings,
    closedDays: number[] = []
): Array<{ staff: Staff; pattern?: ShiftTimePattern }> => {
    const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');
    const todayShiftsByStaff = new Map<string, Shift[]>();
    const yesterdayShiftsByStaff = new Map<string, Shift>();

    for (const shift of existingShifts) {
        if (shift.isError) continue;
        if (shift.date === dateStr) {
            const arr = todayShiftsByStaff.get(shift.staffId) || [];
            arr.push(shift);
            todayShiftsByStaff.set(shift.staffId, arr);
        } else if (shift.date === yesterdayStr) {
            yesterdayShiftsByStaff.set(shift.staffId, shift);
        }
    }

    const roleMap = buildRoleMap(roles);

    return staffList
        .map(staff => ({
            staff,
            result: isStaffAvailableForTimeSlot(staff, date, dateStr, startTime, endTime, preferences, todayShiftsByStaff.get(staff.id) || [], roles, holidays, closedDays)
        }))
        .filter(({ result }) => result.available)
        .map(({ staff, result }) => ({ staff, pattern: result.matchingPattern }))
        .sort((a, b) => {
            // Priority 1: Role display_order
            const roleA = roleMap.get(a.staff.role);
            const roleB = roleMap.get(b.staff.role);
            const orderA = roleA ? roleA.display_order : 999;
            const orderB = roleB ? roleB.display_order : 999;

            if (orderA !== orderB) return orderA - orderB;

            // 優先順位 2: Avoid consecutive same-time shifts (連日同じ時間帯を避ける)を最優先
            const yesterdayShiftA = yesterdayShiftsByStaff.get(a.staff.id);
            const yesterdayShiftB = yesterdayShiftsByStaff.get(b.staff.id);
            
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
export const calcDuration = (startTime: string, endTime: string, breakSettings?: BreakSettings): number => {
    // 休憩設定が有効な場合は実労働時間（休憩込み）で計算
    // displayActualHoursInModal はUIフラグのため使用しない
    if (breakSettings && breakSettings.exceptionEnabled) {
        return calculateActualWorkingHours(startTime, endTime, breakSettings);
    }
    const startMins = timeToMinutes(startTime);
    let endMins = timeToMinutes(endTime);
    if (endTime < startTime) endMins += 24 * 60;
    return (endMins - startMins) / 60;
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
            closedDays, holidays, fixedDates, existingShifts, allPatterns, classes, roles, breakSettings
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
            isStaffAvailable(staff, date, dateStr, preferences, closedDays, holidays.includes(dateStr))
        );

        // 曜日の必要要件を取得（優先度順）
        const dayRequirements = getRequirementsForDay(requirements, dayOfWeek, classIds);

        // 同じ時間帯の要件をグルーピングし、クラス間でインターリーブ割り当て
        // これにより正社員が一方のクラスに固まるのを防ぐ
        const timeSlotGroups = new Map<string, ShiftRequirement[]>();
        for (const req of dayRequirements) {
            const key = `${req.startTime}-${req.endTime}`;
            if (!timeSlotGroups.has(key)) timeSlotGroups.set(key, []);
            timeSlotGroups.get(key)!.push(req);
        }

        for (const reqs of timeSlotGroups.values()) {
            // 各要件の残り必要人数を計算
            const slots = reqs.map(req => ({
                req,
                needed: req.minStaffCount - countStaffInTimeSlot(generatedShifts, dateStr, req.startTime, req.endTime, req.classId)
            })).filter(s => s.needed > 0);

            if (slots.length === 0) continue;

            // ラウンドロビンで1人ずつ各クラスに割り当て
            let assigned = true;
            while (assigned) {
                assigned = false;
                for (const slot of slots) {
                    if (slot.needed <= 0) continue;

                    const candidates = findAvailableStaff(
                        availableStaff,
                        date,
                        dateStr,
                        slot.req.startTime,
                        slot.req.endTime,
                        preferences,
                        generatedShifts,
                        currentHours,
                        currentWeeklyHours,
                        roles,
                        holidays,
                        breakSettings,
                        closedDays
                    );

                    if (candidates.length > 0) {
                        const { staff, pattern } = candidates[0];
                        const shiftStart = pattern ? pattern.startTime : slot.req.startTime;
                        const shiftEnd = pattern ? pattern.endTime : slot.req.endTime;

                        generatedShifts.push({
                            id: `gen_${dateStr}_req_${slot.req.id}_${staff.id}_${slot.needed}`,
                            date: dateStr,
                            staffId: staff.id,
                            startTime: shiftStart,
                            endTime: shiftEnd,
                            classType: slot.req.classId
                        });

                        const duration = calcDuration(shiftStart, shiftEnd, breakSettings);
                        currentHours[staff.id] += duration;
                        const weekKey = `w-${format(startOfISOWeek(date), 'yyyy-MM-dd')}`;
                        currentWeeklyHours[staff.id][weekKey] = (currentWeeklyHours[staff.id][weekKey] || 0) + duration;
                    } else {
                        generatedShifts.push({
                            id: `err_${dateStr}_req_${slot.req.id}_miss_${slot.needed}`,
                            date: dateStr,
                            staffId: UNASSIGNED_STAFF_ID,
                            startTime: slot.req.startTime,
                            endTime: slot.req.endTime,
                            classType: slot.req.classId,
                            isError: true
                        });
                    }

                    slot.needed--;
                    assigned = true;
                }
            }
        }

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

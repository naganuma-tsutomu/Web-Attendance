import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass, ShiftRequirement, ShiftTimePattern } from '../types';

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
    // 1. Check Shift Preference (休日管理)
    const pref = preferences.find(p => p.staffId === staff.id);
    if (pref && pref.unavailableDates.includes(dateStr)) return 'preference';

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
    // First check basic day availability
    if (!isStaffAvailable(staff, date, dateStr, preferences)) return { available: false };

    const roleRecord = roles.find(r => r.name === staff.role || r.id === staff.role);
    const dayOfWeek = getDay(date);
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek];
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
                if ((p as any)[dayKey] === 0) return false;
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
        if (shift.staffId === 'UNASSIGNED') return false;

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
    roles: DynamicRole[],
    holidays: string[] = []
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

            // Priority 2: Hours balance
            return currentHours[a.staff.id] - currentHours[b.staff.id];
        })
        .filter(({ staff }) => staff.hoursTarget === null || currentHours[staff.id] < staff.hoursTarget);
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
            if (req.dayOfWeek === 8) {
                dayMatches = true; // Everyday
            } else if (req.dayOfWeek === 7) {
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
    requirements: ShiftRequirement[] = [] // New: shift requirements
): Shift[] => {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const generatedShifts: Shift[] = [];

    // Tracking staff hours for the month to balance
    const currentHours: Record<string, number> = {};
    staffList.forEach(s => currentHours[s.id] = 0);

    const classIds = classes.map(c => c.id);

    days.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);

        if (dayOfWeek === 0 || holidays.includes(dateStr)) {
            return;
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
                    roles,
                    holidays
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
                        const [sH, sM] = shiftStart.split(':').map(Number);
                        const [eH, eM] = shiftEnd.split(':').map(Number);
                        let startMins = sH * 60 + sM;
                        let endMins = eH * 60 + eM;

                        // 日またぎ対応
                        if (shiftEnd < shiftStart) {
                            endMins += 24 * 60;
                        }

                        const duration = (endMins - startMins) / 60;
                        currentHours[staff.id] += duration;

                        // 重要: パターンで割り当てた場合、このスタッフが同じ日の他の要件も
                        // 同時に満たしている可能性があるため、ループの次の反復で
                        // countStaffInTimeSlot が正しく機能するように既存の配列に追加済み。
                    } else {
                        // スタッフが足りない場合はエラーシフトを作成
                        generatedShifts.push({
                            id: `err_${dateStr}_req_${req.id}_miss_${i}`,
                            date: dateStr,
                            staffId: 'UNASSIGNED',
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
    fetchRequirements: () => Promise<ShiftRequirement[]>
): Promise<Shift[]> => {
    const requirements = await fetchRequirements();
    return generateShiftsForMonth(
        yearMonth,
        staffList,
        preferences,
        roles,
        classes,
        holidays,
        requirements
    );
};

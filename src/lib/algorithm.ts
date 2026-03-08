import { differenceInMinutes, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass, ShiftRequirement } from '../types';

/**
 * Check if a staff member is available for a specific date
 */
export const isStaffAvailable = (
    staff: Staff,
    date: Date,
    dateStr: string,
    preferences: ShiftPreference[]
): boolean => {
    const dayOfWeek = getDay(date);
    const pref = preferences.find(p => p.staffId === staff.id);
    if (pref && pref.unavailableDates.includes(dateStr)) return false;
    if (!staff.availableDays || staff.availableDays.length === 0) return true;

    const nthWeek = Math.ceil(date.getDate() / 7);
    const config = staff.availableDays.find(d => (typeof d === 'number' ? d : d.day) === dayOfWeek);
    if (!config) return false;
    if (typeof config === 'object' && config.weeks && !config.weeks.includes(nthWeek)) return false;
    return true;
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
    existingShifts: Shift[]
): boolean => {
    // First check basic day availability
    if (!isStaffAvailable(staff, date, dateStr, preferences)) return false;

    // Check for overlapping shifts
    const hasOverlap = existingShifts.some(shift => {
        if (shift.staffId !== staff.id || shift.date !== dateStr) return false;
        if (shift.isError) return false; // Error shifts don't block

        const shiftStart = shift.startTime;
        const shiftEnd = shift.endTime;

        // Check overlap: (StartA < EndB) and (EndA > StartB)
        return (startTime < shiftEnd && endTime > shiftStart);
    });

    return !hasOverlap;
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
    currentHours: Record<string, number>
): Staff[] => {
    return staffList
        .filter(staff => isStaffAvailableForTimeSlot(staff, date, dateStr, startTime, endTime, preferences, existingShifts))
        .sort((a, b) => currentHours[a.id] - currentHours[b.id]) // Prioritize staff with fewer hours
        .filter(s => s.hoursTarget === null || currentHours[s.id] < s.hoursTarget);
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
    _roles: DynamicRole[],
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

        const availableStaff = staffList.filter(staff => {
            const pref = preferences.find(p => p.staffId === staff.id);
            if (pref && pref.unavailableDates.includes(dateStr)) return false;
            if (!staff.availableDays || staff.availableDays.length === 0) return true;

            const nthWeek = Math.ceil(date.getDate() / 7);
            const config = staff.availableDays.find(d => (typeof d === 'number' ? d : d.day) === dayOfWeek);
            if (!config) return false;
            if (typeof config === 'object' && config.weeks && !config.weeks.includes(nthWeek)) return false;
            return true;
        });

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
                    currentHours
                );

                for (let i = 0; i < needed; i++) {
                    if (candidates[i]) {
                        const staff = candidates[i];
                        generatedShifts.push({
                            id: `gen_${dateStr}_req_${req.id}_${staff.id}_${i}`,
                            date: dateStr,
                            staffId: staff.id,
                            startTime: req.startTime,
                            endTime: req.endTime,
                            classType: req.classId,
                            isEarlyShift: true // 要件ベースは便宜上 early 扱い
                        });

                        // 労働時間を加算
                        const duration = differenceInMinutes(
                            new Date(`2000-01-01T${req.endTime}`),
                            new Date(`2000-01-01T${req.startTime}`)
                        ) / 60;
                        currentHours[staff.id] += duration;
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

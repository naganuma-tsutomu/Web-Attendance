import { differenceInMinutes, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import type { Staff, ShiftPreference, Shift, ClassType, DynamicRole } from '../types';

/**
 * Heuristic shift generator.
 * Assigns shifts day by day for a given month based on staff availability and rules.
 */
export const generateShiftsForMonth = (
    yearMonth: string, // e.g. '2024-04'
    staffList: Staff[],
    preferences: ShiftPreference[],
    roles: DynamicRole[],
    holidays: string[] = [] // YYYY-MM-DD format
): Shift[] => {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const generatedShifts: Shift[] = [];

    // Helper to get base hours for a staff
    const getBaseHours = (staff: Staff): { start: string, end: string } => {
        // 1. Staff individual settings (Legacy override)
        if (staff.defaultWorkingHoursStart && staff.defaultWorkingHoursEnd) {
            return { start: staff.defaultWorkingHoursStart, end: staff.defaultWorkingHoursEnd };
        }
        // 2. Dynamic Role based patterns
        const role = roles.find(r => r.name === staff.role);
        if (role && role.patterns.length > 0) {
            // Use the first pattern as "default" for now
            return { start: role.patterns[0].startTime, end: role.patterns[0].endTime };
        }

        // 3. Fallback defaults (Compatibility with previous hardcoded logic)
        if (staff.role === '正社員') return { start: '10:15', end: '18:45' };
        if (staff.role === '準社員') return { start: '11:15', end: '18:45' };
        return { start: '12:00', end: '18:00' };
    };

    // Tracking staff hours for the month to balance
    const currentHours: Record<string, number> = {};
    staffList.forEach(s => currentHours[s.id] = 0);

    // Tracking for "At least 1 late from prev day does early today"
    let prevDayLateStaffIds: string[] = [];

    days.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);

        // Skip Sundays and Holidays
        if (dayOfWeek === 0 || holidays.includes(dateStr)) {
            prevDayLateStaffIds = []; // reset
            return;
        }

        // 1. Identify available staff for today
        const availableStaff = staffList.filter(staff => {
            if (staff.availableDays && !staff.availableDays.includes(dayOfWeek)) return false;
            const pref = preferences.find(p => p.staffId === staff.id);
            if (pref && pref.unavailableDates.includes(dateStr)) return false;
            return true;
        });

        const todayLateStaffIds: string[] = [];

        if (dayOfWeek === 6) {
            // Saturday Rule: 2 Full-time (正社員) + optional Sub-full-time (準社員)
            const fullTimeAvail = availableStaff.filter(s => s.role === '正社員')
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]);

            let assignedCount = 0;
            for (let i = 0; i < Math.min(2, fullTimeAvail.length); i++) {
                const s = fullTimeAvail[i];
                const { start, end } = getBaseHours(s);
                generatedShifts.push({
                    id: `gen_${dateStr}_sat_ft_${i}`,
                    date: dateStr,
                    staffId: s.id,
                    startTime: start,
                    endTime: end,
                    classType: i % 2 === 0 ? '虹組' : 'スマイル組',
                    isEarlyShift: false
                });
                currentHours[s.id] += differenceInMinutes(new Date(`2000-01-01T${end}`), new Date(`2000-01-01T${start}`)) / 60;
                assignedCount++;
            }

            const subFullTimeAvail = availableStaff.filter(s => s.role === '準社員')
                .filter(s => currentHours[s.id] < s.hoursTarget)
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]);

            if (subFullTimeAvail.length > 0) {
                const s = subFullTimeAvail[0];
                const { start, end } = getBaseHours(s);
                generatedShifts.push({
                    id: `gen_${dateStr}_sat_sft_0`,
                    date: dateStr,
                    staffId: s.id,
                    startTime: start,
                    endTime: end,
                    classType: '虹組',
                    isEarlyShift: false
                });
                currentHours[s.id] += differenceInMinutes(new Date(`2000-01-01T${end}`), new Date(`2000-01-01T${start}`)) / 60;
                assignedCount++;
            }

            if (assignedCount < 2) {
                generatedShifts.push({
                    id: `err_${dateStr}_sat`,
                    date: dateStr,
                    staffId: 'UNASSIGNED',
                    startTime: '10:15',
                    endTime: '18:45',
                    classType: '特殊',
                    isError: true,
                    isEarlyShift: false
                });
            }
            prevDayLateStaffIds = [];
        } else {
            // Weekday Rule
            let assignedStaffIds = new Set<string>();
            let classAssignmentCount: Record<string, number> = { '虹組': 0, 'スマイル組': 0 };

            const addShift = (staff: Staff, start: string, end: string, isEarly: boolean, isHelp: boolean = false) => {
                const classType: ClassType = isHelp ? '特殊' : (classAssignmentCount['虹組'] <= classAssignmentCount['スマイル組'] ? '虹組' : 'スマイル組');
                generatedShifts.push({
                    id: `gen_${dateStr}_wd_${staff.id}`,
                    date: dateStr,
                    staffId: staff.id,
                    startTime: start,
                    endTime: end,
                    classType,
                    isEarlyShift: isEarly
                });
                assignedStaffIds.add(staff.id);
                if (!isHelp) classAssignmentCount[classType]++;
                currentHours[staff.id] += differenceInMinutes(new Date(`2000-01-01T${end}`), new Date(`2000-01-01T${start}`)) / 60;
                if (!isEarly) todayLateStaffIds.push(staff.id);
            };

            // 1. Prev day constraint
            let ftAvail = availableStaff.filter(s => s.role === '正社員').sort((a, b) => currentHours[a.id] - currentHours[b.id]);
            const prevLateAvail = ftAvail.find(s => prevDayLateStaffIds.includes(s.id));
            if (prevLateAvail) {
                addShift(prevLateAvail, '10:15', '18:00', true);
                ftAvail = ftAvail.filter(s => s.id !== prevLateAvail.id);
            }

            ftAvail.forEach((s, idx) => {
                if (assignedStaffIds.size >= 6) return;
                const isEarly = idx % 2 === 0;
                if (isEarly) addShift(s, '10:15', '18:00', true);
                else addShift(s, '11:00', '18:45', false);
            });

            // SFT
            let sftAvail = availableStaff.filter(s => s.role === '準社員' && !assignedStaffIds.has(s.id))
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]);
            sftAvail.forEach((s) => {
                if (assignedStaffIds.size >= 6) return;
                const { start, end } = getBaseHours(s);
                addShift(s, start, end, false);
            });

            // PT
            let ptAvail = availableStaff.filter(s => (s.role === 'パート' || !['正社員', '準社員'].includes(s.role)) && !assignedStaffIds.has(s.id));
            ptAvail.forEach(s => {
                if (assignedStaffIds.size >= 6) return;
                const { start, end } = getBaseHours(s);
                addShift(s, start, end, true);
            });

            if (assignedStaffIds.size < 6) {
                let helpAvail = availableStaff.filter(s => s.isHelpStaff && !assignedStaffIds.has(s.id));
                helpAvail.forEach(s => {
                    if (assignedStaffIds.size >= 6) return;
                    const { start, end } = getBaseHours(s);
                    addShift(s, start, end, false, true);
                });
            }

            const missing = 6 - assignedStaffIds.size;
            if (missing > 0) {
                for (let i = 0; i < missing; i++) {
                    generatedShifts.push({
                        id: `err_${dateStr}_wd_miss_${i}`,
                        date: dateStr,
                        staffId: 'UNASSIGNED',
                        startTime: '12:00',
                        endTime: '18:45',
                        classType: classAssignmentCount['虹組'] <= classAssignmentCount['スマイル組'] ? '虹組' : 'スマイル組',
                        isError: true,
                        isEarlyShift: false
                    });
                }
            }
            prevDayLateStaffIds = todayLateStaffIds;
        }
    });

    return generatedShifts;
};

import { differenceInMinutes, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import type { Staff, ShiftPreference, Shift, ClassType } from '../types';

/**
 * Heuristic shift generator.
 * Assigns shifts day by day for a given month based on staff availability and rules.
 */
export const generateShiftsForMonth = (
    yearMonth: string, // e.g. '2024-04'
    staffList: Staff[],
    preferences: ShiftPreference[],
    holidays: string[] = [] // YYYY-MM-DD format
): Shift[] => {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const generatedShifts: Shift[] = [];

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
            // Check day of week availability (if specified)
            if (staff.availableDays && !staff.availableDays.includes(dayOfWeek)) {
                return false;
            }
            // Check preferences
            const pref = preferences.find(p => p.staffId === staff.id);
            if (pref && pref.unavailableDates.includes(dateStr)) {
                return false;
            }
            return true;
        });

        const todayLateStaffIds: string[] = [];

        if (dayOfWeek === 6) {
            // Saturday Rule: 2 Full-time (正社員) + optional Sub-full-time (準社員)
            const fullTimeAvail = availableStaff.filter(s => s.role === '正社員')
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]); // prioritize those with less hours

            let assignedCount = 0;

            // Assign up to 2 full time
            for (let i = 0; i < Math.min(2, fullTimeAvail.length); i++) {
                const s = fullTimeAvail[i];
                generatedShifts.push({
                    id: `gen_${dateStr}_sat_ft_${i}`,
                    date: dateStr,
                    staffId: s.id,
                    startTime: '10:15',
                    endTime: '18:45',
                    classType: i % 2 === 0 ? '虹組' : 'スマイル組',
                    isEarlyShift: false
                });
                currentHours[s.id] += 7.5; // Approx 7.5 hrs
                assignedCount++;
            }

            // Assign sub-full-time if they need hours
            const subFullTimeAvail = availableStaff.filter(s => s.role === '準社員')
                .filter(s => currentHours[s.id] < s.hoursTarget)
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]);

            if (subFullTimeAvail.length > 0) {
                const s = subFullTimeAvail[0];
                generatedShifts.push({
                    id: `gen_${dateStr}_sat_sft_0`,
                    date: dateStr,
                    staffId: s.id,
                    startTime: '11:15',
                    endTime: '18:45',
                    classType: '虹組', // default to Niji or balance
                    isEarlyShift: false
                });
                currentHours[s.id] += 6.5;
                assignedCount++;
            }

            if (assignedCount < 2) {
                // Error: Not enough staff for Saturday
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
            prevDayLateStaffIds = []; // reset since it's Saturday
        } else {
            // Weekday Rule: 6 people. 12:00-18:45 must have 2 per class.
            // Simplified assignment: 
            // - Try to assign 3 for 虹組, 3 for スマイル組
            // - Mix of early and late to ensure coverage
            let assignedStaffIds = new Set<string>();
            let classAssignmentCount: Record<string, number> = { '虹組': 0, 'スマイル組': 0 };

            // Helper to add shift
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

                // Track hours roughly
                currentHours[staff.id] += differenceInMinutes(new Date(`2000-01-01T${end}`), new Date(`2000-01-01T${start}`)) / 60;
                if (!isEarly) todayLateStaffIds.push(staff.id);
            };

            // 1. Fulfill Full-time prev day constraint
            let ftAvail = availableStaff.filter(s => s.role === '正社員').sort((a, b) => currentHours[a.id] - currentHours[b.id]);
            const prevLateAvail = ftAvail.find(s => prevDayLateStaffIds.includes(s.id));
            if (prevLateAvail) {
                addShift(prevLateAvail, '10:15', '18:00', true); // Early
                ftAvail = ftAvail.filter(s => s.id !== prevLateAvail.id);
            }

            // Assign remaining full-time (try to balance Early/Late)
            ftAvail.forEach((s, idx) => {
                if (assignedStaffIds.size >= 6) return;
                const isEarly = idx % 2 === 0;
                if (isEarly) {
                    addShift(s, '10:15', '18:00', true);
                } else {
                    addShift(s, '11:00', '18:45', false);
                }
            });

            // Assign Sub-full-time
            let sftAvail = availableStaff.filter(s => s.role === '準社員' && !assignedStaffIds.has(s.id))
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]);

            sftAvail.forEach((s, idx) => {
                if (assignedStaffIds.size >= 6) return;
                const type = idx % 2 === 0 ? 0 : 1;
                if (type === 0) addShift(s, '11:15', '18:45', false);
                else addShift(s, '12:00', '18:00', false);
            });

            // Assign Part-time (very greedy, just assign standard chunk to fill 6)
            let ptAvail = availableStaff.filter(s => s.role === 'パート' && !assignedStaffIds.has(s.id));
            ptAvail.forEach(s => {
                if (assignedStaffIds.size >= 6) return;
                addShift(s, '10:15', '16:15', true); // Default mock hours for part time
            });

            // Fill with help staff if still under 6
            if (assignedStaffIds.size < 6) {
                let helpAvail = availableStaff.filter(s => s.role === '特殊スタッフ' && s.isHelpStaff && !assignedStaffIds.has(s.id));
                helpAvail.forEach(s => {
                    if (assignedStaffIds.size >= 6) return;
                    addShift(s, s.defaultWorkingHours?.start || '16:00', s.defaultWorkingHours?.end || '17:00', false, true);
                });
            }

            // Check if we met the 6 people minimum
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

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
    const getHoursForShift = (staff: Staff, isEarly: boolean): { start: string, end: string } => {
        // 1. Staff individual settings (Legacy override)
        if (staff.defaultWorkingHoursStart && staff.defaultWorkingHoursEnd) {
            return { start: staff.defaultWorkingHoursStart, end: staff.defaultWorkingHoursEnd };
        }
        // 2. Dynamic Role based patterns (early=patterns[0], late=patterns[1])
        const role = roles.find(r => r.name === staff.role);
        if (role && role.patterns.length > 0) {
            if (isEarly || role.patterns.length === 1) {
                return { start: role.patterns[0].startTime, end: role.patterns[0].endTime };
            }
            return { start: role.patterns[1].startTime, end: role.patterns[1].endTime };
        }

        // 3. Fallback defaults (Compatibility with previous hardcoded logic)
        if (staff.role === '正社員') return isEarly ? { start: '10:15', end: '18:00' } : { start: '11:00', end: '18:45' };
        if (staff.role === '準社員') return { start: '11:15', end: '18:45' };
        return { start: '12:00', end: '18:00' };
    };

    // getBaseHours: 早番/遅番不問のデフォルトを返す（土曜やヘルプ用）
    const getBaseHours = (staff: Staff) => getHoursForShift(staff, true);

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
            // Check individual shift preferences (manual holidays) first
            const pref = preferences.find(p => p.staffId === staff.id);
            if (pref && pref.unavailableDates.includes(dateStr)) return false;

            // Check fixed available days (default holidays)
            if (!staff.availableDays || staff.availableDays.length === 0) return true;

            const dayOfWeek = getDay(date);
            const nthWeek = Math.ceil(date.getDate() / 7); // 第何週目か (1-5)

            const config = staff.availableDays.find(d => {
                if (typeof d === 'number') return d === dayOfWeek;
                return d.day === dayOfWeek;
            });

            if (!config) return false; // この曜日は出勤不可

            // 詳細設定（週指定）がある場合
            if (typeof config === 'object' && config.weeks && config.weeks.length > 0) {
                if (!config.weeks.includes(nthWeek)) return false; // この週は出勤不可
            }

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

            // 準社員は基本的に土曜出勤しない (assign only if full-time are missing and no other choice - skipped for simplicity as per requirement)
            // もしどうしても入れ込む必要がある場合は、準社員の role 名を確認
            const subFullTimeAvail = availableStaff.filter(s => s.role === '準社員' && !assignedCount) // 0人の場合のみ
                .filter(s => s.hoursTarget === null || currentHours[s.id] < s.hoursTarget)
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]);

            if (subFullTimeAvail.length > 0 && assignedCount < 2) {
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

            // Shift candidate selection logic (Generalized for all roles with hoursTarget)
            const getRankedCandidates = (roleFilter: (s: Staff) => boolean) => {
                return availableStaff.filter(s => !assignedStaffIds.has(s.id) && roleFilter(s))
                    .sort((a, b) => currentHours[a.id] - currentHours[b.id])
                    .filter(s => s.hoursTarget === null || currentHours[s.id] < s.hoursTarget);
            };

            // 1. Prev day constraint: 前日遅番だった正社員は今日早番に
            let ftAvail = availableStaff.filter(s => s.role === '正社員').sort((a, b) => currentHours[a.id] - currentHours[b.id]);
            const prevLateAvail = ftAvail.find(s => prevDayLateStaffIds.includes(s.id));
            if (prevLateAvail) {
                const { start, end } = getHoursForShift(prevLateAvail, true); // 早番
                addShift(prevLateAvail, start, end, true);
            }

            // FT
            getRankedCandidates(s => s.role === '正社員').forEach((s, idx) => {
                if (assignedStaffIds.size >= 6) return;
                const isEarly = idx % 2 === 0;
                const { start, end } = getHoursForShift(s, isEarly);
                addShift(s, start, end, isEarly);
            });

            // SFT
            getRankedCandidates(s => s.role === '準社員').forEach((s) => {
                if (assignedStaffIds.size >= 6) return;
                const { start, end } = getBaseHours(s);
                addShift(s, start, end, false);
            });

            // PT / Others
            getRankedCandidates(s => !['正社員', '準社員', 'ヘルプ要員'].includes(s.role)).forEach(s => {
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

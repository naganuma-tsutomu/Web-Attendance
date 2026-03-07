import { differenceInMinutes, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass } from '../types';

/**
 * Heuristic shift generator.
 * Assigns shifts day by day for a given month based on staff availability and rules.
 */
export const generateShiftsForMonth = (
    yearMonth: string, // e.g. '2024-04'
    staffList: Staff[],
    preferences: ShiftPreference[],
    roles: DynamicRole[],
    classes: ShiftClass[],
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
        // 2. Dynamic Role based patterns
        const role = roles.find(r => r.name === staff.role || r.id === staff.role);
        if (role && role.patterns.length > 0) {
            if (isEarly || role.patterns.length === 1) {
                return { start: role.patterns[0].startTime, end: role.patterns[0].endTime };
            }
            return { start: role.patterns[1].startTime, end: role.patterns[1].endTime };
        }

        // 3. Fallback defaults (Minimalistic fallback)
        return isEarly ? { start: '10:00', end: '18:00' } : { start: '11:00', end: '19:00' };
    };

    // getBaseHours: 早番/遅番不問のデフォルトを返す（土曜やヘルプ用）
    const getBaseHours = (staff: Staff) => getHoursForShift(staff, true);

    // Tracking staff hours for the month to balance
    const currentHours: Record<string, number> = {};
    staffList.forEach(s => currentHours[s.id] = 0);

    // Tracking for "At least 1 late from prev day does early today"
    let prevDayLateStaffIds: string[] = [];

    // クラスの分類: 自動割り当てが有効なクラスのみを対象とする
    const autoAllocateClasses = classes.filter(c => c.auto_allocate === 1).map(c => c.id);
    // 自動割り当てが無効なクラス（手動または例外用）
    const manualClasses = classes.filter(c => c.auto_allocate === 0).map(c => c.id);

    // ヘルパークラス（特殊/ヘルプなど）のフォールバック
    const fallbackClassId = manualClasses[0] || classes[0]?.id || 'default';

    // 役職の分類（targetHoursがあるものを「フルタイム系」とみなす）
    const fullTimeRoleNames = roles.filter(r => (r.targetHours || 0) >= 140).map(r => r.name);
    const isFullTime = (s: Staff) => fullTimeRoleNames.includes(s.role);

    // スタッフの所属クラスから割り当て先を決定するユーティリティ
    const getRandomAssignedClass = (staff: Staff): string => {
        const staffClassIds = staff.classIds || [];
        // スタッフの所属クラスのうち、自動割り当てが有効なものを抽出
        const eligibleClasses = staffClassIds.filter(cid => autoAllocateClasses.includes(cid));

        if (eligibleClasses.length > 0) {
            // 複数ある場合はランダムに1つ選択
            return eligibleClasses[Math.floor(Math.random() * eligibleClasses.length)];
        }

        // 該当がない場合（またはヘルプ要員など）はフォールバック
        return fallbackClassId;
    };

    days.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);

        if (dayOfWeek === 0 || holidays.includes(dateStr)) {
            prevDayLateStaffIds = [];
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

        const todayLateStaffIds: string[] = [];

        if (dayOfWeek === 6) {
            // Saturday Rule: 2 staff required
            const fullTimeAvail = availableStaff.filter(isFullTime)
                .sort((a, b) => currentHours[a.id] - currentHours[b.id]);

            let assignedCount = 0;
            for (let i = 0; i < Math.min(2, fullTimeAvail.length); i++) {
                const s = fullTimeAvail[i];
                const { start, end } = getBaseHours(s);
                const classType = getRandomAssignedClass(s);

                generatedShifts.push({
                    id: `gen_${dateStr}_sat_${s.id}`,
                    date: dateStr,
                    staffId: s.id,
                    startTime: start,
                    endTime: end,
                    classType,
                    isEarlyShift: false
                });
                currentHours[s.id] += differenceInMinutes(new Date(`2000-01-01T${end}`), new Date(`2000-01-01T${start}`)) / 60;
                assignedCount++;
            }

            if (assignedCount < 2) {
                generatedShifts.push({
                    id: `err_${dateStr}_sat_miss`,
                    date: dateStr,
                    staffId: 'UNASSIGNED',
                    startTime: '10:00',
                    endTime: '18:00',
                    classType: fallbackClassId,
                    isError: true,
                    isEarlyShift: false
                });
            }
            prevDayLateStaffIds = [];
        } else {
            // Weekday Rule: 6 staff required
            let assignedStaffIds = new Set<string>();

            const addShift = (staff: Staff, start: string, end: string, isEarly: boolean) => {
                const classType = getRandomAssignedClass(staff);

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
                currentHours[staff.id] += differenceInMinutes(new Date(`2000-01-01T${end}`), new Date(`2000-01-01T${start}`)) / 60;
                if (!isEarly) todayLateStaffIds.push(staff.id);
            };

            const getRankedCandidates = (roleFilter: (s: Staff) => boolean) => {
                return availableStaff.filter(s => !assignedStaffIds.has(s.id) && roleFilter(s))
                    .sort((a, b) => currentHours[a.id] - currentHours[b.id])
                    .filter(s => s.hoursTarget === null || currentHours[s.id] < s.hoursTarget);
            };

            // 1. Prev day late constraint
            const prevLateAvail = availableStaff.filter(isFullTime).find(s => prevDayLateStaffIds.includes(s.id));
            if (prevLateAvail) {
                const { start, end } = getHoursForShift(prevLateAvail, true);
                addShift(prevLateAvail, start, end, true);
            }

            // 2. Full-time staff
            getRankedCandidates(isFullTime).forEach((s, idx) => {
                if (assignedStaffIds.size >= 6) return;
                const isEarly = idx % 2 === 0;
                const { start, end } = getHoursForShift(s, isEarly);
                addShift(s, start, end, isEarly);
            });

            // 3. Regular staff (excluding help staff)
            getRankedCandidates(s => !isFullTime(s) && !s.isHelpStaff).forEach(s => {
                if (assignedStaffIds.size >= 6) return;
                const { start, end } = getBaseHours(s);
                addShift(s, start, end, true);
            });

            // 4. Help staff (only if missing)
            if (assignedStaffIds.size < 6) {
                availableStaff.filter(s => s.isHelpStaff && !assignedStaffIds.has(s.id)).forEach(s => {
                    if (assignedStaffIds.size >= 6) return;
                    const { start, end } = getBaseHours(s);
                    addShift(s, start, end, false);
                });
            }

            const missing = 6 - assignedStaffIds.size;
            if (missing > 0) {
                for (let i = 0; i < missing; i++) {
                    generatedShifts.push({
                        id: `err_${dateStr}_wd_miss_${i}`,
                        date: dateStr,
                        staffId: 'UNASSIGNED',
                        startTime: '10:00',
                        endTime: '18:00',
                        classType: fallbackClassId,
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

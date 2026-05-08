import type { Shift, Staff, DynamicRole, ShiftClass } from '../types';
import { UNASSIGNED_STAFF_ID } from '../constants';
import { buildLeaderMatcher } from '../utils/roleMatch';

export interface LeaderRebalanceInput {
    shifts: Shift[];
    staffList: Staff[];
    roles: DynamicRole[];
    classes: ShiftClass[];
    leaderRoleId: string | null;
}

export interface LeaderRebalanceResult {
    shifts: Shift[];
    swaps: Array<{
        date: string;
        classFrom: string;
        classTo: string;
        staffFrom: string;
        staffTo: string;
    }>;
}

const canStaffBeInClass = (staff: Staff | undefined, classId: string): boolean => {
    if (!staff) return false;
    if (!staff.classIds || staff.classIds.length === 0) return true;
    return staff.classIds.includes(classId);
};

export const applyLeaderRebalance = (input: LeaderRebalanceInput): LeaderRebalanceResult => {
    const { shifts, staffList, roles, classes, leaderRoleId } = input;
    if (!leaderRoleId) return { shifts, swaps: [] };

    const matcher = buildLeaderMatcher(leaderRoleId, roles);
    const staffById = new Map<string, Staff>();
    for (const s of staffList) staffById.set(s.id, s);
    const classById = new Map<string, ShiftClass>();
    for (const c of classes) classById.set(c.id, c);

    const sortedClasses = [...classes].sort((a, b) => a.display_order - b.display_order);

    // 日付ごとに処理。workingShifts は出力用（変更を反映していく）
    const workingShifts = [...shifts];
    const swaps: LeaderRebalanceResult['swaps'] = [];

    // 日付別の index Map: shiftId → workingShifts index
    const indexById = new Map<string, number>();
    workingShifts.forEach((s, i) => indexById.set(s.id, i));

    // 日ごとのシフト群（id ベースで参照、classType の最新は workingShifts から取得）
    const idsByDate = new Map<string, string[]>();
    for (const s of workingShifts) {
        if (s.isError) continue;
        if (s.staffId === UNASSIGNED_STAFF_ID) continue;
        if (!classById.has(s.classType)) continue;
        if (!idsByDate.has(s.date)) idsByDate.set(s.date, []);
        idsByDate.get(s.date)!.push(s.id);
    }

    const getShift = (id: string): Shift | undefined => {
        const idx = indexById.get(id);
        if (idx === undefined) return undefined;
        return workingShifts[idx];
    };

    const updateClassType = (id: string, newClassType: string) => {
        const idx = indexById.get(id);
        if (idx === undefined) return;
        workingShifts[idx] = { ...workingShifts[idx], classType: newClassType };
    };

    for (const [dateStr, dayShiftIds] of idsByDate) {
        // クラスごとの shiftId 配列を再構築
        const buildShiftsByClass = () => {
            const map = new Map<string, string[]>();
            for (const id of dayShiftIds) {
                const s = getShift(id);
                if (!s) continue;
                if (!map.has(s.classType)) map.set(s.classType, []);
                map.get(s.classType)!.push(id);
            }
            return map;
        };

        for (const classA of sortedClasses) {
            const shiftsByClass = buildShiftsByClass();
            const classAIds = shiftsByClass.get(classA.id) ?? [];
            if (classAIds.length === 0) continue;

            const hasLeader = classAIds.some(id => {
                const s = getShift(id);
                if (!s) return false;
                const staff = staffById.get(s.staffId);
                return staff ? matcher(staff) : false;
            });
            if (hasLeader) continue;

            let swapped = false;
            for (const xId of classAIds) {
                if (swapped) break;
                const shiftX = getShift(xId);
                if (!shiftX) continue;
                const staffX = staffById.get(shiftX.staffId);
                if (!staffX) continue;
                if (matcher(staffX)) continue;

                for (const classB of sortedClasses) {
                    if (swapped) break;
                    if (classB.id === classA.id) continue;
                    const classBIds = shiftsByClass.get(classB.id) ?? [];
                    const leadersInB = classBIds.filter(id => {
                        const s = getShift(id);
                        if (!s) return false;
                        const st = staffById.get(s.staffId);
                        return st ? matcher(st) : false;
                    });
                    // 反転防止：B から leader を抜くと B が leader 0 になるケースを禁止
                    if (leadersInB.length <= 1) continue;

                    for (const yId of leadersInB) {
                        const shiftY = getShift(yId);
                        if (!shiftY) continue;
                        if (shiftX.startTime !== shiftY.startTime) continue;
                        if (shiftX.endTime !== shiftY.endTime) continue;

                        const staffY = staffById.get(shiftY.staffId);
                        if (!staffY) continue;

                        if (!canStaffBeInClass(staffX, classB.id)) continue;
                        if (!canStaffBeInClass(staffY, classA.id)) continue;

                        // 同日に staffX が classB のシフトを既に持っている / staffY が classA を持っているか
                        const xConflict = dayShiftIds.some(id => {
                            if (id === xId || id === yId) return false;
                            const s = getShift(id);
                            return s ? s.staffId === staffX.id && s.classType === classB.id : false;
                        });
                        if (xConflict) continue;
                        const yConflict = dayShiftIds.some(id => {
                            if (id === xId || id === yId) return false;
                            const s = getShift(id);
                            return s ? s.staffId === staffY.id && s.classType === classA.id : false;
                        });
                        if (yConflict) continue;

                        updateClassType(xId, classB.id);
                        updateClassType(yId, classA.id);
                        swaps.push({
                            date: dateStr,
                            classFrom: classA.id,
                            classTo: classB.id,
                            staffFrom: staffX.id,
                            staffTo: staffY.id,
                        });
                        swapped = true;
                        break;
                    }
                }
            }
        }
    }

    return { shifts: workingShifts, swaps };
};

import { useMemo } from 'react';
import { format } from 'date-fns';
import { isStaffAvailableReason } from '../../../lib/algorithm';
import { calculateActualWorkingHours, calculateDuration as calculateDurationHours } from '../../../utils/timeUtils';
import { UNASSIGNED_STAFF_ID } from '../../../constants';
import type { Shift, Staff, ShiftClass, ShiftPreference } from '../../../types';
import type { OffDutyStaffInfo } from '../components/ShiftActionMenus';
import type { BreakSettings } from '../../../types';

interface TimelineHours {
    startHour: number;
    endHour: number;
}

interface UseDailyTimelineDataParams {
    date: Date;
    shifts: Shift[];
    staffList: Staff[];
    classes: ShiftClass[];
    preferences: ShiftPreference[];
    targetDateStr: string;
    addedShifts: Shift[];
    deletedIds: Set<string>;
    breakSettings?: BreakSettings;
}

export const useDailyTimelineData = ({
    date,
    shifts,
    staffList,
    classes,
    preferences,
    targetDateStr,
    addedShifts,
    deletedIds,
    breakSettings,
}: UseDailyTimelineDataParams) => {
    const targetYearMonth = format(date, 'yyyy-MM');

    const dayShifts = useMemo<Shift[]>(() => {
        return [...shifts.filter(s => s.date === targetDateStr), ...addedShifts]
            .filter(s => !deletedIds.has(s.id))
            .sort((a, b) => {
                if (a.classType !== b.classType) return a.classType.localeCompare(b.classType);
                const indexA = staffList.findIndex(s => s.id === a.staffId);
                const indexB = staffList.findIndex(s => s.id === b.staffId);
                if (indexA !== -1 && indexB !== -1) {
                    if (indexA !== indexB) return indexA - indexB;
                } else if (indexA !== -1) return -1;
                else if (indexB !== -1) return 1;
                return a.startTime.localeCompare(b.startTime);
            });
    }, [shifts, targetDateStr, addedShifts, deletedIds, staffList]);

    const staffMonthlyHours = useMemo(() => {
        const hrs: Record<string, number> = {};
        const base = shifts.filter(s =>
            s.date.startsWith(targetYearMonth) && !deletedIds.has(s.id) && s.staffId !== UNASSIGNED_STAFF_ID
        );
        const added = addedShifts.filter(s =>
            s.date.startsWith(targetYearMonth) && s.staffId !== UNASSIGNED_STAFF_ID
        );
        [...base, ...added].forEach(s => {
            const duration = breakSettings
                ? calculateActualWorkingHours(s.startTime, s.endTime, breakSettings)
                : calculateDurationHours(s.startTime, s.endTime);
            hrs[s.staffId] = (hrs[s.staffId] || 0) + duration;
        });
        return hrs;
    }, [shifts, addedShifts, deletedIds, targetYearMonth, breakSettings]);

    const offDutyStaff = useMemo<OffDutyStaffInfo[]>(() => {
        return staffList
            .map(staff => {
                const isOnShift = dayShifts.some(s => s.staffId === staff.id);
                const reason = isStaffAvailableReason(staff, date, targetDateStr, preferences);

                let isFullDayPref = false;
                let isPartialPref = false;
                let timeStr: string | null = null;
                let isTraining = false;

                const pref = preferences.find(p => p.staffId === staff.id);
                if (pref?.details?.length) {
                    const detail = pref.details.find(d => d.date === targetDateStr);
                    if (detail) {
                        if (detail.type === 'training') isTraining = true;
                        else if (!detail.startTime && !detail.endTime) isFullDayPref = true;
                        else if (detail.startTime && detail.endTime) {
                            isPartialPref = true;
                            timeStr = `${detail.startTime}-${detail.endTime}`;
                        }
                    }
                }

                const hasPreference = isFullDayPref || isPartialPref || isTraining || reason === 'preference';
                if (!isOnShift || hasPreference) {
                    return { staff, reason, isFullDayPref, isPartialPref, isTraining, timeStr, isOnShift };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [staffList, dayShifts, date, targetDateStr, preferences]);

    const classColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        classes.forEach(c => { if (c.color) map[c.id] = c.color; });
        return map;
    }, [classes]);

    return { dayShifts, staffMonthlyHours, offDutyStaff, classColorMap };
};

export const useTimelineHourLabels = (hours: TimelineHours) => useMemo(
    () => Array.from({ length: (hours.endHour - hours.startHour) + 1 }, (_, i) => hours.startHour + i),
    [hours],
);

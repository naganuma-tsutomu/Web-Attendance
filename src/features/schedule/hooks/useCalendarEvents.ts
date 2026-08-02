import { useMemo } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { isStaffAvailableReason } from '../../../lib/algorithm';
import { CALENDAR_COLORS, DEFAULT_CLOSED_DAYS } from '../../../constants';
import { createBusinessDayOverrideMap, resolveBusinessDay } from '../../../lib/businessDayUtils';
import type { Shift, Staff, ShiftClass, ShiftPreference, BusinessHours, Holiday, BusinessDayOverride } from '../../../types';

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resourceId: string;
    isError: boolean;
    isSummary?: boolean;
    type?: string;
    classNameValue?: string;
    classColor?: string;
}

export const useCalendarEvents = (
    rawShifts: Shift[],
    staffList: Staff[],
    classes: ShiftClass[],
    preferences: ShiftPreference[],
    currentDate: Date,
    view: View,
    targetYearMonth: string,
    businessHours: BusinessHours | undefined,
    holidays: Holiday[] = [],
    businessDayOverrides: BusinessDayOverride[] = []
) => {
    const { events, errorCount, errorDates } = useMemo(() => {
        const errorByDate = new Map<string, number>();
        const calendarEvents: CalendarEvent[] = rawShifts.map(shift => {
            if (shift.isError && shift.date.startsWith(targetYearMonth)) {
                errorByDate.set(shift.date, (errorByDate.get(shift.date) ?? 0) + 1);
            }
            const staff = staffList.find(s => s.id === shift.staffId);
            const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');

            const shiftClass = classes.find(c => c.id === shift.classType);
            const className = shiftClass ? shiftClass.name : shift.classType;

            const titleSuffix = shift.isError ? '(エラー)' : '';

            return {
                id: shift.id,
                title: `${staffName}${titleSuffix}`,
                start: new Date(`${shift.date}T${shift.startTime}:00`),
                end: new Date(`${shift.date}T${shift.endTime}:00`),
                resourceId: shift.classType,
                isError: shift.isError ?? false,
                classNameValue: className,
                classColor: shiftClass?.color
            };
        });
        const sortedErrorDates = Array.from(errorByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));
        const totalErrors = sortedErrorDates.reduce((sum, e) => sum + e.count, 0);
        return { events: calendarEvents, errorCount: totalErrors, errorDates: sortedErrorDates };
    }, [rawShifts, staffList, classes, targetYearMonth]);

    const summaryEvents = useMemo(() => {
        if (view !== Views.MONTH) return events;

        const dailySummary: Record<string, { classes: Record<string, number>; insufficient: number; requestedOff: number; training: number; fixedOff: number }> = {};

        events.forEach(event => {
            const dateStr = format(event.start, 'yyyy-MM-dd');
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0, training: 0, fixedOff: 0 };
            }
            if (event.isError) {
                dailySummary[dateStr].insufficient++;
            } else {
                const className = event.classNameValue || 'その他';
                dailySummary[dateStr].classes[className] = (dailySummary[dateStr].classes[className] || 0) + 1;
            }
        });

        const [year, month] = targetYearMonth.split('-').map(Number);
        const dStart = startOfMonth(new Date(year, month - 1));
        const dEnd = endOfMonth(dStart);
        const daysInMonth = eachDayOfInterval({ start: dStart, end: dEnd });
        const closedDays = businessHours?.closedDays || DEFAULT_CLOSED_DAYS;
        const holidayMap = new Map(holidays.map(item => [item.date, item]));
        const overrideMap = createBusinessDayOverrideMap(businessDayOverrides);

        daysInMonth.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (!resolveBusinessDay({ date: day, dateStr, closedDays, holiday: holidayMap.get(dateStr), override: overrideMap.get(dateStr) }).isOpen) return;
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0, training: 0, fixedOff: 0 };
            }

            staffList.forEach(staff => {
                const pref = preferences.find(p => p.staffId === staff.id);
                let isTraining = false;
                let isReqOff = false;

                if (pref) {
                    const detailMatch = pref.details && pref.details.find((d) => d.date === dateStr);
                    if (detailMatch && detailMatch.type === 'training') {
                        isTraining = true;
                    } else if (detailMatch) {
                        isReqOff = true;
                    }
                }

                if (isTraining) {
                    dailySummary[dateStr].training++;
                } else if (isReqOff) {
                    dailySummary[dateStr].requestedOff++;
                } else {
                    const reason = isStaffAvailableReason(staff, day, dateStr, preferences);
                    if (reason === 'fixed') {
                        dailySummary[dateStr].fixedOff++;
                    }
                }
            });
        });

        const summaries: CalendarEvent[] = [];
        Object.entries(dailySummary).forEach(([dateStr, data]) => {
            const baseDate = new Date(`${dateStr}T00:00:00`);

            classes.forEach(cls => {
                const count = data.classes[cls.name];
                if (count > 0) {
                    summaries.push({ id: `summary-class-${cls.id}-${dateStr}`, title: `${cls.name}: ${count}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isSummary: true, type: 'class', classNameValue: cls.name, classColor: cls.color });
                }
            });
            if (data.insufficient > 0) summaries.push({ id: `summary-insufficient-${dateStr}`, title: `不足: ${data.insufficient}名`, start: baseDate, end: baseDate, resourceId: '', isError: true, isSummary: true, type: 'error' });
            if (data.training > 0) summaries.push({ id: `summary-training-${dateStr}`, title: `研修: ${data.training}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isSummary: true, type: 'training' });
            if (data.requestedOff > 0) summaries.push({ id: `summary-req-off-${dateStr}`, title: `希望休: ${data.requestedOff}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isSummary: true, type: 'requested-off' });
            if (data.fixedOff > 0) summaries.push({ id: `summary-fixed-off-${dateStr}`, title: `固定休: ${data.fixedOff}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isSummary: true, type: 'fixed-off' });
        });
        return summaries;
    }, [view, targetYearMonth, events, staffList, preferences, classes, businessHours?.closedDays, holidays, businessDayOverrides]);

    const eventStyleGetter = (event: CalendarEvent) => {
        const style: Record<string, string | number> = {
            borderRadius: '4px',
            opacity: (view === Views.MONTH && !isSameMonth(event.start, currentDate)) ? 0.4 : 0.9,
            color: 'white',
            border: '0px',
            display: 'block',
            fontSize: '11px',
            padding: '2px 4px',
            cursor: 'pointer'
        };

        if (event.isError || event.type === 'error') {
            style.backgroundColor = CALENDAR_COLORS.error;
        } else if (event.type === 'requested-off') {
            style.backgroundColor = CALENDAR_COLORS.requestedOff;
        } else if (event.type === 'training') {
            style.backgroundColor = CALENDAR_COLORS.training;
        } else if (event.type === 'fixed-off') {
            style.backgroundColor = CALENDAR_COLORS.fixedOffBg;
            style.color = CALENDAR_COLORS.fixedOffText;
        } else {
            // 通常シフト: クラスの色（DB管理）を使用、なければフォールバック
            style.backgroundColor = event.classColor || CALENDAR_COLORS.classFallback;
        }

        return { style };
    };

    return { events, summaryEvents, errorCount, errorDates, eventStyleGetter };
};

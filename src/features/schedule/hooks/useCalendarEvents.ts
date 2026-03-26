import { useMemo } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from 'date-fns';
import { isStaffAvailableReason } from '../../../lib/algorithm';
import type { Shift, Staff, ShiftClass, ShiftPreference, BusinessHours } from '../../../types';

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resourceId: string;
    isError: boolean;
    isEarly: boolean;
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
    businessHours: BusinessHours | undefined
) => {
    const { events, errorCount } = useMemo(() => {
        let errCount = 0;
        const calendarEvents: CalendarEvent[] = rawShifts.map(shift => {
            if (shift.isError) errCount++;
            const staff = staffList.find(s => s.id === shift.staffId);
            const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');

            const shiftClass = classes.find(c => c.id === shift.classType);
            const className = shiftClass ? shiftClass.name : shift.classType;

            let titleSuffix = '';
            if (shift.isError) titleSuffix = '(エラー)';
            else titleSuffix = shift.isEarlyShift ? '(早番)' : '(遅番)';

            return {
                id: shift.id,
                title: `${staffName}${titleSuffix}`,
                start: new Date(`${shift.date}T${shift.startTime}:00`),
                end: new Date(`${shift.date}T${shift.endTime}:00`),
                resourceId: shift.classType,
                isError: shift.isError ?? false,
                isEarly: shift.isEarlyShift,
                classNameValue: className,
                classColor: shiftClass?.color
            };
        });
        return { events: calendarEvents, errorCount: errCount };
    }, [rawShifts, staffList, classes]);

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
        const closedDays = businessHours?.closedDays || [0];

        daysInMonth.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0, training: 0, fixedOff: 0 };
            }

            staffList.forEach(staff => {
                const dayOfWeek = getDay(day);
                if (closedDays.includes(dayOfWeek)) return;

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
                    summaries.push({ id: `summary-class-${cls.id}-${dateStr}`, title: `${cls.name}: ${count}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isEarly: false, isSummary: true, type: 'class', classNameValue: cls.name, classColor: cls.color });
                }
            });
            if (data.insufficient > 0) summaries.push({ id: `summary-insufficient-${dateStr}`, title: `不足: ${data.insufficient}名`, start: baseDate, end: baseDate, resourceId: '', isError: true, isEarly: false, isSummary: true, type: 'error' });
            if (data.training > 0) summaries.push({ id: `summary-training-${dateStr}`, title: `研修: ${data.training}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isEarly: false, isSummary: true, type: 'training' });
            if (data.requestedOff > 0) summaries.push({ id: `summary-req-off-${dateStr}`, title: `希望休: ${data.requestedOff}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isEarly: false, isSummary: true, type: 'requested-off' });
            if (data.fixedOff > 0) summaries.push({ id: `summary-fixed-off-${dateStr}`, title: `固定休: ${data.fixedOff}名`, start: baseDate, end: baseDate, resourceId: '', isError: false, isEarly: false, isSummary: true, type: 'fixed-off' });
        });
        return summaries;
    }, [view, targetYearMonth, events, staffList, preferences, classes, businessHours?.closedDays]);

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
            style.backgroundColor = '#94a3b8';
        } else if (event.type === 'requested-off') {
            style.backgroundColor = '#ef4444';
        } else if (event.type === 'training') {
            style.backgroundColor = '#f59e0b';
        } else if (event.type === 'fixed-off') {
            style.backgroundColor = '#cbd5e1';
            style.color = '#475569';
        } else if (event.type === 'class') {
            style.backgroundColor = event.classColor || '#6366f1';
        } else if (event.isEarly) {
            style.backgroundColor = '#3b82f6';
        } else {
            style.backgroundColor = '#f59e0b';
        }

        return { style };
    };

    return { events, summaryEvents, errorCount, eventStyleGetter };
};

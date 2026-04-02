import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { dayNames } from './constants';
import type { DayStatus } from './types';

export const generateMonthDays = (baseDate: Date, holidays: any[]): DayStatus[] => {
    const start = startOfMonth(baseDate);
    const end = endOfMonth(baseDate);
    return eachDayOfInterval({ start, end }).map(date => {
        const dayOfWeekIndex = getDay(date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const h = holidays.find((hol: any) => hol.date === dateStr);
        return {
            dateStr,
            dayOfWeek: dayNames[dayOfWeekIndex],
            isHoliday: dayOfWeekIndex === 0,
            status: 'available',
            isNationalHoliday: !!h && !h.isWorkday && !h.is_workday,
            holidayName: h?.name
        };
    });
};

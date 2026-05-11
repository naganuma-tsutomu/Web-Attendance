import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { dayNames } from './constants';
import type { DayStatus } from './types';
import type { Holiday } from '../../types';

export const generateMonthDays = (baseDate: Date, holidays: Holiday[]): DayStatus[] => {
    const start = startOfMonth(baseDate);
    const end = endOfMonth(baseDate);
    return eachDayOfInterval({ start, end }).map(date => {
        const dayOfWeekIndex = getDay(date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const h = holidays.find(hol => hol.date === dateStr);
        return {
            dateStr,
            dayOfWeek: dayNames[dayOfWeekIndex],
            isHoliday: dayOfWeekIndex === 0,
            status: 'available',
            isNationalHoliday: !!h && !h.isWorkday,
            holidayName: h?.name
        };
    });
};

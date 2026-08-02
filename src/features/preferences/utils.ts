import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { dayNames } from './constants';
import type { DayStatus } from './types';
import { createBusinessDayOverrideMap, resolveBusinessDay } from '../../lib/businessDayUtils';
import type { Holiday, BusinessDayOverride } from '../../types';

export const generateMonthDays = (baseDate: Date, holidays: Holiday[], closedDays: number[] = [], overrides: BusinessDayOverride[] = []): DayStatus[] => {
    const start = startOfMonth(baseDate);
    const end = endOfMonth(baseDate);
    const overrideMap = createBusinessDayOverrideMap(overrides);
    return eachDayOfInterval({ start, end }).map(date => {
        const dayOfWeekIndex = getDay(date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const h = holidays.find(hol => hol.date === dateStr);
        const override = overrideMap.get(dateStr);
        const resolution = resolveBusinessDay({ date, dateStr, closedDays, holiday: h, override });
        return {
            dateStr,
            dayOfWeek: dayNames[dayOfWeekIndex],
            isHoliday: !resolution.isOpen,
            status: 'available',
            isNationalHoliday: !!h && !h.isWorkday,
            holidayName: override?.name || h?.name
        };
    });
};

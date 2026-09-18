type AvailableDay = number | { day: number; weeks?: number[] | null };

export const getHolidayDisplay = (availableDays?: AvailableDay[]): string => {
    if (!availableDays || availableDays.length === 0) return '設定なし';

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const workingDayNumbers = [1, 2, 3, 4, 5, 6];

    const holidayNames = workingDayNumbers
        .filter(day => !availableDays.some(availableDay => (
            typeof availableDay === 'number' ? availableDay : availableDay.day
        ) === day))
        .map(day => dayNames[day]);

    const partialHolidays = availableDays.flatMap(availableDay => {
        if (typeof availableDay === 'number' || !availableDay.weeks || availableDay.weeks.length >= 5) {
            return [];
        }
        const offWeeks = [1, 2, 3, 4, 5].filter(week => !availableDay.weeks?.includes(week));
        return [`${dayNames[availableDay.day]} (第${offWeeks.join(',')})`];
    });

    return [...holidayNames, ...partialHolidays].join(', ') || '設定なし';
};

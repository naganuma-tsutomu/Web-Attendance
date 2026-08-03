import { createContext, useContext } from 'react';

interface CalendarDisplayContextValue {
    fixedDates: Set<string>;
    toggleFixedDate: (dateStr: string) => void;
    getHolidayNameForDate: (date: Date) => string | undefined;
    getBusinessDayStatusForDate: (date: Date) => 'open' | 'closed' | null;
    isHolidayDate: (date: Date) => boolean;
    handleOpenTimeline: (date: Date) => void;
    lastTouchOpenRef: React.RefObject<number>;
}

export const CalendarDisplayContext = createContext<CalendarDisplayContextValue | null>(null);

export const useCalendarDisplay = (): CalendarDisplayContextValue => {
    const ctx = useContext(CalendarDisplayContext);
    if (!ctx) throw new Error('useCalendarDisplay must be used within CalendarDisplayContext.Provider');
    return ctx;
};

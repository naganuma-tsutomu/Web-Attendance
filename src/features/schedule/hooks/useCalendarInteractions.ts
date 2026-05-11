import { useState, useEffect, useRef } from 'react';
import { type View } from 'react-big-calendar';
import { startOfWeek, startOfMonth, addDays } from 'date-fns';
import { getWeekStartsOn } from '../../../utils/dateUtils';

export const useCalendarInteractions = (
    currentDate: Date,
    view: View,
    onOpenTimeline: (date: Date) => void
) => {
    const [calendarKey, setCalendarKey] = useState(0);
    const calendarContainerRef = useRef<HTMLDivElement>(null);
    const lastTouchOpenRef = useRef<number>(0);
    const isTouchDevice = typeof window !== 'undefined' && navigator.maxTouchPoints > 0;

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => setCalendarKey(prev => prev + 1), 150);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        const el = calendarContainerRef.current;
        if (!el || !isTouchDevice) return;

        let startX = 0, startY = 0;

        const onTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const onTouchEnd = (e: TouchEvent) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            if (Math.abs(endX - startX) > 10 || Math.abs(endY - startY) > 10) return;

            const monthView = el.querySelector('.rbc-month-view');
            if (!monthView) return;

            const rect = monthView.getBoundingClientRect();
            const header = monthView.querySelector('.rbc-row.rbc-month-header');
            const headerHeight = header ? header.getBoundingClientRect().height : 0;

            const relX = endX - rect.left;
            const relY = endY - rect.top - headerHeight;
            if (relY < 0 || relX < 0 || relX > rect.width) return;

            const col = Math.floor((relX / rect.width) * 7);
            const monthRows = monthView.querySelectorAll('.rbc-month-row');
            if (!monthRows.length) return;
            const rowHeight = (rect.height - headerHeight) / monthRows.length;
            const row = Math.floor(relY / rowHeight);

            const weekStartsOn = getWeekStartsOn() as 0 | 1;
            const calendarStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
            const date = addDays(calendarStart, row * 7 + col);

            lastTouchOpenRef.current = Date.now();
            onOpenTimeline(date);
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [view, currentDate, calendarKey, isTouchDevice, onOpenTimeline]);

    return { calendarKey, calendarContainerRef, lastTouchOpenRef, isTouchDevice };
};

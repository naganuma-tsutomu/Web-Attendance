import { format } from 'date-fns';
import { Lock, Unlock } from 'lucide-react';
import type { DateHeaderProps } from 'react-big-calendar';
import { useCalendarDisplay } from '../context/CalendarDisplayContext';

const CalendarDateHeader = (props: DateHeaderProps) => {
    const { fixedDates, toggleFixedDate, getHolidayNameForDate, getBusinessDayStatusForDate, isHolidayDate, handleOpenTimeline, lastTouchOpenRef } = useCalendarDisplay();
    const dateStr = format(props.date, 'yyyy-MM-dd');
    const isFixed = fixedDates.has(dateStr);
    const holidayName = getHolidayNameForDate(props.date);
    const isClosed = isHolidayDate(props.date);
    const explicitStatus = getBusinessDayStatusForDate(props.date);

    const openTimeline = () => {
        if (Date.now() - lastTouchOpenRef.current < 500) return;
        handleOpenTimeline(props.date);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            className="flex justify-between items-center w-full px-1 py-0.5 cursor-pointer"
            onClick={openTimeline}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTimeline(); } }}
        >
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFixedDate(dateStr);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className={`p-1 hidden sm:flex items-center justify-center rounded transition-colors shrink-0 ${isFixed ? 'text-red-500 bg-red-100 hover:bg-red-200' : 'text-slate-300 hover:text-slate-700 hover:bg-slate-200/50'}`}
                title={isFixed ? '自動生成からロック中' : 'シフトをロックする'}
                aria-label={isFixed ? 'シフトのロックを解除する' : 'シフトをロックする'}
            >
                {isFixed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
            {(isClosed || explicitStatus) && (
                <span className={`hidden sm:inline text-xs font-medium truncate flex-1 text-center px-1 ${isClosed ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`} title={holidayName}>
                    {holidayName || (isClosed ? '休業' : '営業')}
                </span>
            )}
            <span className="font-medium text-slate-700 dark:text-slate-300 pr-1 shrink-0">{props.label}</span>
        </div>
    );
};

export default CalendarDateHeader;

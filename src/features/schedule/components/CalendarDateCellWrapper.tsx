import { getDay } from 'date-fns';
import type { DateCellWrapperProps } from 'react-big-calendar';
import { useCalendarDisplay } from '../context/CalendarDisplayContext';

const CalendarDateCellWrapper = (props: DateCellWrapperProps) => {
    const { isHolidayDate } = useCalendarDisplay();
    const date = props.value;
    const isHoliday = isHolidayDate(date);
    const dayOfWeek = getDay(date);

    let bgColorClass = '';
    if (dayOfWeek === 0 || isHoliday) {
        bgColorClass = 'bg-red-50 dark:bg-red-900/10';
    } else if (dayOfWeek === 6) {
        bgColorClass = 'bg-blue-50 dark:bg-blue-900/10';
    }

    return (
        <div className={`rbc-day-bg ${bgColorClass}`} style={{ height: '100%' }}>
            {props.children}
        </div>
    );
};

export default CalendarDateCellWrapper;

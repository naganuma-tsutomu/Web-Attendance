import { useState, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DatePickerProps {
    date: Date;
    onChange: (date: Date) => void;
    trigger: React.ReactNode;
    align?: 'left' | 'center' | 'right';
}

export const DatePicker = ({ date, onChange, trigger, align = 'left' }: DatePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(date));
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setCurrentMonth(startOfMonth(date));
        }
    }, [isOpen, date]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth)
    });

    // Offset for the first day of the month
    const startDay = days[0].getDay();
    const blanks = Array.from({ length: startDay }).map((_, i) => <div key={`blank-${i}`} className="w-8 h-8 md:w-10 md:h-10" />);

    return (
        <div className="relative inline-block" ref={popoverRef}>
            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                {trigger}
            </div>

            {isOpen && (
                <div className={`absolute z-50 top-full ${align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'right' ? 'right-0' : '-left-2 md:-left-4'} mt-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200/50 dark:border-slate-800/50 p-5 w-[280px] md:w-[320px] animate-in fade-in zoom-in-95 duration-200 ${align === 'center' ? 'origin-top' : align === 'right' ? 'origin-top-right' : 'origin-top-left'}`}>
                    <div className="flex items-center justify-between mb-5">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="font-black text-slate-800 dark:text-white flex items-center space-x-2 text-lg">
                            <span className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 p-1.5 rounded-lg shadow-sm">
                                <Calendar className="w-4 h-4" />
                            </span>
                            <span>{format(currentMonth, 'yyyy年 M月', { locale: ja })}</span>
                        </div>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                            <div key={d} className={`text-center text-[10px] md:text-xs font-black uppercase tracking-widest ${
                                i === 0 ? 'text-red-500 dark:text-red-400' : i === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                            }`}>
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {blanks}
                        {days.map((d, i) => {
                            const isSelected = isSameDay(d, date);
                            const isCurrentMonth = isSameMonth(d, currentMonth);
                            const today = isToday(d);
                            const isSunday = d.getDay() === 0;
                            const isSaturday = d.getDay() === 6;

                            return (
                                <button
                                    key={i}
                                    onClick={() => {
                                        onChange(d);
                                        setIsOpen(false);
                                    }}
                                    className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-sm transition-all relative group
                                        ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
                                        ${isSelected
                                            ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none'
                                            : today
                                                ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800/80 dark:text-indigo-400'
                                                : `hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                                    isSunday ? 'text-red-500 dark:text-red-400 font-medium' : isSaturday ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300 font-medium'
                                                }`
                                        }
                                    `}
                                >
                                    {format(d, 'd')}
                                    {today && !isSelected && (
                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-between gap-2">
                        <button
                            onClick={() => {
                                onChange(new Date());
                                setIsOpen(false);
                            }}
                            className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                        >
                            今日
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatePicker;

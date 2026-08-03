import { useEffect, useRef, useState } from 'react';
import { addMonths, format, setMonth, setYear, startOfMonth, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface MonthNavigationProps {
    date: Date;
    onChange: (date: Date) => void;
    isLoading?: boolean;
}

export default function MonthNavigation({ date, onChange, isLoading = false }: MonthNavigationProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(date.getFullYear());
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const openPicker = () => {
        setPickerYear(date.getFullYear());
        setIsOpen(value => !value);
    };

    const selectMonth = (month: number) => {
        onChange(startOfMonth(setMonth(setYear(date, pickerYear), month)));
        setIsOpen(false);
    };

    return (
        <div ref={pickerRef} className="relative flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:w-auto">
            <button
                type="button"
                onClick={() => onChange(subMonths(date, 1))}
                aria-label="前月へ"
                className="min-h-11 min-w-11 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 sm:min-h-0 sm:min-w-0 sm:p-1.5"
            >
                <ChevronLeft className="h-5 w-5" />
            </button>
            <button
                type="button"
                onClick={openPicker}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                className="flex min-h-11 min-w-[150px] select-none items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-center text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 dark:text-white dark:hover:bg-slate-700/50 sm:min-h-0"
            >
                <Calendar className="h-4 w-4 shrink-0 text-indigo-500" />
                {format(date, 'yyyy年M月', { locale: ja })}
                {isLoading && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-indigo-400" />}
            </button>
            <button
                type="button"
                onClick={() => onChange(addMonths(date, 1))}
                aria-label="翌月へ"
                className="min-h-11 min-w-11 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 sm:min-h-0 sm:min-w-0 sm:p-1.5"
            >
                <ChevronRight className="h-5 w-5" />
            </button>
            {isOpen && (
                <div role="dialog" aria-label="対象月を選択" className="absolute right-0 top-full z-50 mt-3 w-[280px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
                    <div className="mb-4 flex items-center justify-between">
                        <button type="button" onClick={() => setPickerYear(year => year - 1)} aria-label="前年へ" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                            <Calendar className="h-4 w-4 text-indigo-500" />
                            {pickerYear}年
                        </div>
                        <button type="button" onClick={() => setPickerYear(year => year + 1)} aria-label="翌年へ" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }, (_, month) => {
                            const selected = pickerYear === date.getFullYear() && month === date.getMonth();
                            return (
                                <button
                                    type="button"
                                    key={month}
                                    onClick={() => selectMonth(month)}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                >
                                    {month + 1}月
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

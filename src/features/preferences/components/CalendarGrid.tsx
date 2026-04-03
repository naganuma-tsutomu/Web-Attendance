import type { DayStatus } from '../types';

interface CalendarGridProps {
    preferences: DayStatus[];
    prefLoading: boolean;
    handleDateClick: (index: number) => void;
}

const CalendarGrid = ({ preferences, prefLoading, handleDateClick }: CalendarGridProps) => (
    <>
        {/* 曜日ヘッダー */}
        <div className="px-5 pt-4">
            <div className="grid grid-cols-6 gap-2.5 mb-2">
                {['月', '火', '水', '木', '金', '土'].map((d) => (
                    <div key={d} className={`text-center text-xs font-bold py-1 ${d === '土' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {d}
                    </div>
                ))}
            </div>
        </div>

        {/* 日付グリッド */}
        <div className="p-5 pt-0">
            {prefLoading ? (
                <div className="text-center py-12 text-slate-400">読み込み中...</div>
            ) : (
                <div className="grid grid-cols-6 gap-2.5">
                    {/* 月の開始曜日に合わせた空セル */}
                    {(() => {
                        const firstDay = preferences[0];
                        if (!firstDay) return null;
                        const firstDayObj = new Date(firstDay.dateStr);
                        const dayOfWeek = firstDayObj.getDay();
                        const offset = dayOfWeek === 0 ? 0 : dayOfWeek - 1;
                        return Array.from({ length: offset }).map((_, i) => (
                            <div key={`empty-${i}`} className="p-3" />
                        ));
                    })()}

                    {preferences
                        .filter(item => !item.isHoliday)
                        .map((item) => {
                            const realIndex = preferences.indexOf(item);
                            const isSaturday = item.dayOfWeek === '土';
                            const isTraining = item.status === 'unavailable' && item.type === 'training';

                            return (
                                <button
                                    key={item.dateStr}
                                    onClick={() => handleDateClick(realIndex)}
                                    disabled={item.status === 'fixed'}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-150 select-none
                                        ${item.status === 'fixed'
                                            ? item.isNationalHoliday
                                                ? 'bg-red-50/50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 opacity-80 cursor-not-allowed'
                                                : 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-70 cursor-not-allowed'
                                            : isTraining
                                                ? 'bg-amber-50 dark:bg-amber-900/40 border-amber-300 dark:border-amber-800 shadow-sm'
                                                : item.status === 'unavailable'
                                                    ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800 shadow-sm'
                                                    : item.isNationalHoliday
                                                        ? 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'
                                                        : isSaturday
                                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700'
                                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                                        }`}
                                >
                                    <span className={`text-base font-bold ${item.isNationalHoliday ? 'text-red-500 dark:text-red-400' : item.status === 'fixed' ? 'text-slate-400 dark:text-slate-500' : isTraining ? 'text-amber-700 dark:text-amber-400' : item.status === 'unavailable' ? 'text-red-700 dark:text-red-400' : isSaturday ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {parseInt(item.dateStr.split('-')[2])}
                                    </span>
                                    <span className={`text-[9px] sm:text-[10px] font-bold mt-1 px-0.5 sm:px-1 py-0.5 rounded-md truncate w-[calc(100%-4px)] sm:w-auto sm:max-w-[80px] text-center block ${
                                        item.status === 'fixed'
                                            ? item.isNationalHoliday
                                                ? 'bg-red-100/70 dark:bg-red-900/50 text-red-600 dark:text-red-300'
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                            : isTraining
                                                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                                            : item.status === 'unavailable'
                                                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                            : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                        }`}>
                                        {item.status === 'fixed'
                                            ? (item.isNationalHoliday ? '祝日' : '固定休')
                                            : item.status === 'unavailable'
                                                ? (isTraining ? '研修' : (item.startTime ? `${item.startTime}~不可` : '不可'))
                                                : '○'
                                        }
                                    </span>
                                </button>
                            );
                        })}
                </div>
            )}
        </div>
    </>
);

export default CalendarGrid;

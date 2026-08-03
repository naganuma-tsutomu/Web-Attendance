import React from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import type { Shift, Staff, ShiftClass, ShiftTimePattern, DynamicRole, BusinessHours } from '../../types';
import { getWeekStartsOn } from '../../utils/dateUtils';
import DailyTimelineView from './DailyTimelineView';

interface WeeklyTimelineViewProps {
    startDate: Date;
    shifts: Shift[];
    staffList: Staff[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    roles: DynamicRole[];
    businessHours?: BusinessHours;
    isHolidayDate?: (date: Date) => boolean;
    getHolidayNameForDate?: (date: Date) => string;
    getBusinessDayStatusForDate?: (date: Date) => 'open' | 'closed' | null;
    onDateClick: (date: Date) => void;
}

const WeeklyTimelineView: React.FC<WeeklyTimelineViewProps> = ({
    startDate,
    shifts,
    staffList,
    classes,
    timePatterns,
    roles,
    isHolidayDate,
    getHolidayNameForDate,
    getBusinessDayStatusForDate,
    onDateClick
}) => {
    // 週の開始日を取得
    const weekStartsOn = getWeekStartsOn();
    const weekStart = startOfWeek(startDate, { locale: ja, weekStartsOn });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
        <div className="h-full overflow-y-auto flex flex-col p-4">
            <div className="flex justify-end text-[10px] text-slate-500 dark:text-slate-400 italic mb-2">
                ※クリックで詳細な編集が可能です
            </div>
            
            <div className="flex flex-col space-y-4">
            {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                const isClosed = isHolidayDate?.(day) ?? false;
                const dayShiftCount = shifts.filter(shift => shift.date === dateStr).length;
                const businessDayLabel = getHolidayNameForDate?.(day) ?? '';
                const explicitStatus = getBusinessDayStatusForDate?.(day) ?? null;

                return (
                    <div
                        key={dateStr}
                        role="button"
                        tabIndex={0}
                        className="flex-shrink-0 flex flex-col space-y-0 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => onDateClick(day)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDateClick(day); }}
                    >
                        <div
                            className={`flex items-center justify-between px-4 py-1.5 transition-colors border-b
                                ${isClosed
                                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                                    : isToday
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
                                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {format(day, 'M/d (E)', { locale: ja })}
                                </span>
                                {isToday && (
                                    <span className="px-2 py-0.5 text-[9px] bg-indigo-600 text-white rounded-full font-bold">今日</span>
                                )}
                                {(isClosed || explicitStatus) && (
                                    <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold ${isClosed ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'}`} title={businessDayLabel}>
                                        {businessDayLabel || (isClosed ? '休業' : '営業')}
                                    </span>
                                )}
                                {isClosed && dayShiftCount > 0 && (
                                    <span className="px-2 py-0.5 text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 rounded-full font-bold">
                                        休業・シフト{dayShiftCount}件あり
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                                <span className="text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">詳しく見る / 編集</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800">
                            {isClosed && dayShiftCount === 0 ? (
                                <div className="py-5 text-center text-sm font-bold text-red-500 dark:text-red-300">
                                    {businessDayLabel || '休業日'}
                                </div>
                            ) : (
                            <DailyTimelineView
                                date={day}
                                shifts={shifts}
                                staffList={staffList}
                                classes={classes}
                                timePatterns={timePatterns}
                                roles={roles}
                                readOnly={true}
                            />
                            )}
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
};

export default WeeklyTimelineView;

import React from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import type { Shift, Staff, ShiftClass, ShiftTimePattern, DynamicRole } from '../../types';
import DailyTimelineView from './DailyTimelineView';

interface WeeklyTimelineViewProps {
    startDate: Date;
    shifts: Shift[];
    staffList: Staff[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    roles: DynamicRole[];
    onDateClick: (date: Date) => void;
}

const WeeklyTimelineView: React.FC<WeeklyTimelineViewProps> = ({
    startDate,
    shifts,
    staffList,
    classes,
    timePatterns,
    roles,
    onDateClick
}) => {
    // 週の開始日を取得
    const weekStartsOn = (parseInt(localStorage.getItem('weekStartsOn') || '0') as 0 | 1);
    const weekStart = startOfWeek(startDate, { locale: ja, weekStartsOn });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
        <div className="h-full overflow-y-auto flex flex-col space-y-4 p-4">
            {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                return (
                    <div 
                        key={dateStr} 
                        className="flex-shrink-0 flex flex-col space-y-0 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => onDateClick(day)}
                    >
                        <div
                            className={`flex items-center justify-between px-4 py-1.5 transition-colors border-b
                                ${isToday
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
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                                <span className="text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">詳しく見る / 編集</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800">
                            <DailyTimelineView
                                date={day}
                                shifts={shifts}
                                staffList={staffList}
                                classes={classes}
                                timePatterns={timePatterns}
                                roles={roles}
                                readOnly={true}
                            />
                        </div>
                    </div>
                );
            })}

            {/* Global Legend for Weekly View */}
            <div className="sticky bottom-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md pt-3 pb-1 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                {classes.map(c => (
                    <div key={c.id} className="flex items-center space-x-1">
                        <div className={`w-2.5 h-2.5 rounded-sm border ${c.id === 'class_niji' ? 'bg-amber-300 border-amber-400' :
                            c.id === 'class_smile' ? 'bg-blue-300 border-blue-400' :
                                c.id === 'class_special' ? 'bg-emerald-300 border-emerald-400' :
                                    'bg-purple-300 border-purple-400'
                            }`} />
                        <span>{c.name === '特殊' ? 'ヘルプ' : c.name}</span>
                    </div>
                ))}
                <div className="flex items-center space-x-1"><div className="w-2.5 h-2.5 bg-slate-300 border border-slate-400 dark:bg-slate-600 dark:border-slate-500 rounded-sm" /><span>不足</span></div>
                <div className="flex items-center space-x-1"><div className="w-2.5 h-2.5 bg-amber-400 border border-amber-500 rounded-sm" /><span>研修</span></div>
                <div className="flex items-center space-x-1"><div className="w-2.5 h-2.5 bg-red-400 border border-red-500 rounded-sm" /><span>希望休</span></div>
                <div className="ml-auto italic">※クリックで詳細な編集が可能です</div>
            </div>
        </div>
    );
};

export default WeeklyTimelineView;

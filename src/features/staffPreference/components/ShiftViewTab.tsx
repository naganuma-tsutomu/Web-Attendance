import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Users } from 'lucide-react';
import DailyTimelineView from '../../schedule/DailyTimelineView';
import type { Shift, Staff, ShiftClass, ShiftTimePattern, DynamicRole } from '../../../types';

interface ShiftViewTabProps {
    days: Date[];
    allShifts: Shift[];
    loading: boolean;
    staff: { id: string; name: string };
    staffList: Staff[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    roles: DynamicRole[];
}

export default function ShiftViewTab({
    days,
    allShifts,
    loading,
    staff,
    staffList,
    classes,
    timePatterns,
    roles
}: ShiftViewTabProps) {
    // アクティブな日付をReact stateで管理（DOM直書き換えを排除）
    const [activeSidebarDate, setActiveSidebarDate] = useState<string | null>(null);
    // 不要な setState を防ぐための ref
    const lastActiveDateRef = useRef<string | null>(null);

    useEffect(() => {
        let rafId = 0;
        const handleScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const elements = document.querySelectorAll('[id^="shift-date-"]');
                if (elements.length === 0) return;

                const triggerLine = Math.max(window.innerHeight * 0.35, 250);
                let activeDate: string | null = null;
                let closestDate: string | null = null;
                let minDistance = Infinity;

                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.top <= triggerLine && rect.bottom > triggerLine) {
                        activeDate = el.id.replace('shift-date-', '');
                    }
                    const dist = Math.min(Math.abs(rect.top - triggerLine), Math.abs(rect.bottom - triggerLine));
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestDate = el.id.replace('shift-date-', '');
                    }
                });

                const targetDate = activeDate || closestDate;
                if (targetDate && targetDate !== lastActiveDateRef.current) {
                    lastActiveDateRef.current = targetDate;
                    setActiveSidebarDate(targetDate);
                }
            });
        };

        const timer = setTimeout(() => {
            handleScroll();
            window.addEventListener('scroll', handleScroll, { passive: true });
        }, 100);

        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [allShifts]);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
            <div className="flex items-center justify-between px-1">
                <h2 className="font-black text-slate-800 dark:text-white tracking-tight">全員のシフト一覧</h2>
            </div>

            <div className="flex items-start gap-2 sm:gap-4 relative">
                {/* Main timeline area */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden min-w-0">
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayShifts = allShifts.filter(s => s.date === dateStr);

                            if (dayShifts.length === 0) return null;

                            return (
                                <div key={dateStr} id={`shift-date-${dateStr}`} className="flex-shrink-0 flex flex-col space-y-0 border-b border-slate-100 dark:border-slate-800 last:border-0 scroll-mt-40 lg:scroll-mt-44">
                                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-bold ${
                                                day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-slate-800 dark:text-white'
                                            }`}>
                                                {format(day, 'M/d (E)', { locale: ja })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800">
                                        <DailyTimelineView
                                            date={day}
                                            shifts={dayShifts}
                                            staffList={staffList}
                                            classes={classes}
                                            timePatterns={timePatterns}
                                            roles={roles}
                                            readOnly={true}
                                            hideHeaderToggle={true}
                                            highlightStaffId={staff.id}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {allShifts.length === 0 && !loading && (
                            <div className="py-20 text-center">
                                <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold">まだシフトが登録されていません</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Date Navigation Sidebar */}
                <div className="flex flex-col sticky top-24 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto hidden-scrollbar">
                    <div className="flex flex-col items-center">
                        {days.map(d => {
                            const dateStr = format(d, 'yyyy-MM-dd');
                            const hasShifts = allShifts.some(s => s.date === dateStr);
                            if (!hasShifts) return null;

                            const dow = d.getDay();
                            const isActive = activeSidebarDate === dateStr;
                            const baseClass = `w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-bold transition-all mb-1 last:mb-0`;
                            const colorClass = isActive
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : dow === 0 ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                                : dow === 6 ? 'text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800';

                            return (
                                <button
                                    key={dateStr}
                                    id={`sidebar-date-${dateStr}`}
                                    onClick={() => {
                                        const el = document.getElementById(`shift-date-${dateStr}`);
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className={`${baseClass} ${colorClass}`}
                                    title={format(d, 'M/d (E)', { locale: ja })}
                                >
                                    {format(d, 'd')}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

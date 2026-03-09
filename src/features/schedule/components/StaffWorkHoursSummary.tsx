import { useMemo } from 'react';
import { Users, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import type { Staff, Shift } from '../../../types';
import { calculateTotalHours } from '../../../utils/timeUtils';

interface StaffWorkHoursSummaryProps {
    staffs: Staff[];
    shifts: Shift[];
    isOpen: boolean;
    onToggle: () => void;
}

const StaffWorkHoursSummary = ({ staffs, shifts, isOpen, onToggle }: StaffWorkHoursSummaryProps) => {
    const totalHoursMap = useMemo(() => calculateTotalHours(shifts), [shifts]);

    const sortedStaffs = useMemo(() => {
        return [...staffs].sort((a, b) => {
            const hoursA = totalHoursMap[a.id] || 0;
            const hoursB = totalHoursMap[b.id] || 0;
            return hoursB - hoursA;
        });
    }, [staffs, totalHoursMap]);

    return (
        <div
            className={`fixed top-24 bottom-6 right-0 z-40 transition-all duration-300 transform ${isOpen ? 'translate-x-0 w-80' : 'translate-x-full w-0'
                }`}
        >
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 bg-white dark:bg-slate-800 border-y border-l border-slate-200 dark:border-slate-700 p-2 rounded-l-xl shadow-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title={isOpen ? "サマリーを閉じる" : "サマリーを開く"}
            >
                {isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            <div className="h-full bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-bold text-slate-800 dark:text-white">スタッフ別労働時間</h3>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {sortedStaffs.map(staff => {
                        const currentHours = totalHoursMap[staff.id] || 0;
                        const targetHours = staff.hoursTarget || 0;
                        const percentage = targetHours > 0 ? Math.min((currentHours / targetHours) * 100, 100) : 0;
                        const isOver = targetHours > 0 && currentHours > targetHours;

                        return (
                            <div key={staff.id} className="space-y-1.5">
                                <div className="flex justify-between items-end">
                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                                        {staff.name}
                                    </div>
                                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        <span className={`font-bold ${isOver ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                                            {currentHours.toFixed(1)}h
                                        </span>
                                        {targetHours > 0 && ` / ${targetHours}h`}
                                    </div>
                                </div>
                                {targetHours > 0 && (
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-indigo-500'
                                                }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {sortedStaffs.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm italic">
                            スタッフが登録されていません
                        </div>
                    )}
                </div>

                {/* Legend/Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>目標時間内</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span>目標時間を超過</span>
                    </div>
                    <p className="mt-2 leading-relaxed">
                        ※ シフトの編集内容はリアルタイムで集計に反映されます。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StaffWorkHoursSummary;

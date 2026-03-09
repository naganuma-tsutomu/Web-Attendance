import { useMemo } from 'react';
import { Users } from 'lucide-react';
import type { Staff, Shift } from '../../../types';
import { calculateTotalHours } from '../../../utils/timeUtils';

interface StaffWorkHoursSummaryProps {
    staffs: Staff[];
    shifts: Shift[];
    isOpen: boolean;
}

const StaffWorkHoursSummary = ({ staffs, shifts, isOpen }: StaffWorkHoursSummaryProps) => {
    const totalHoursMap = useMemo(() => calculateTotalHours(shifts), [shifts]);

    const sortedStaffs = useMemo(() => {
        return [...staffs].sort((a, b) => {
            const hoursA = totalHoursMap[a.id] || 0;
            const hoursB = totalHoursMap[b.id] || 0;
            return hoursB - hoursA;
        });
    }, [staffs, totalHoursMap]);

    if (!isOpen) return null;

    return (
        <div className="w-full lg:w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col h-full lg:h-auto overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">スタッフ別労働時間</h3>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {sortedStaffs.map(staff => {
                    const currentHours = totalHoursMap[staff.id] || 0;
                    const targetHours = staff.hoursTarget || 0;
                    const percentage = targetHours > 0 ? Math.min((currentHours / targetHours) * 100, 100) : 0;
                    const isOver = targetHours > 0 && currentHours > targetHours;

                    return (
                        <div key={staff.id} className="group space-y-1.5">
                            <div className="flex justify-between items-end">
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                                    {staff.name}
                                </div>
                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    <span className={`font-bold ${isOver ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                                        {currentHours.toFixed(1)}h
                                    </span>
                                    {targetHours > 0 && ` / ${targetHours}h`}
                                </div>
                            </div>
                            {targetHours > 0 && (
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ease-out ${isOver ? 'bg-red-500' : 'bg-indigo-500 group-hover:bg-indigo-400'
                                            }`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}

                {sortedStaffs.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                        スタッフ未登録
                    </div>
                )}
            </div>

            {/* Legend/Info */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>目標時間内</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>目標時間超過</span>
                </div>
            </div>
        </div>
    );
};

export default StaffWorkHoursSummary;

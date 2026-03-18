import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import type { Staff, Shift } from '../../../types';
import { calculateTotalHours, formatHours } from '../../../utils/timeUtils';

interface StaffWorkHoursSummaryProps {
    staffs: Staff[];
    shifts: Shift[];
    isOpen: boolean;
    viewDate?: Date; // Add viewDate to identify the current week
}

const StaffWorkHoursSummary = ({ staffs, shifts, isOpen, viewDate = new Date() }: StaffWorkHoursSummaryProps) => {
    const totalHoursMap = useMemo(() => {
        const monthStart = startOfMonth(viewDate);
        const monthEnd = endOfMonth(viewDate);
        const filteredShifts = shifts.filter(shift => {
            const shiftDate = parseISO(shift.date);
            return isWithinInterval(shiftDate, { start: monthStart, end: monthEnd });
        });
        return calculateTotalHours(filteredShifts);
    }, [shifts, viewDate]);

    // Calculate weekly hours for the week containing viewDate
    const weeklyHoursMap = useMemo(() => {
        const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 }); // Monday start to match ISO
        const weekEnd = endOfWeek(viewDate, { weekStartsOn: 1 });
        
        const filteredShifts = shifts.filter(shift => {
            const shiftDate = parseISO(shift.date);
            return isWithinInterval(shiftDate, { start: weekStart, end: weekEnd });
        });
        
        return calculateTotalHours(filteredShifts);
    }, [shifts, viewDate]);

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
                                        {formatHours(currentHours)}h
                                    </span>
                                    {targetHours > 0 && ` / ${targetHours}h`}
                                </div>
                            </div>
                            
                            {/* Weekly Hours Display */}
                            {(staff.weeklyHoursTarget !== null && staff.weeklyHoursTarget !== undefined) && (
                                <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-bold px-0.5">
                                    <span>今週の合計</span>
                                    <span className={weeklyHoursMap[staff.id] > staff.weeklyHoursTarget ? 'text-red-500 font-bold' : ''}>
                                        {weeklyHoursMap[staff.id] !== undefined ? formatHours(weeklyHoursMap[staff.id]) : '0.0'}h / {staff.weeklyHoursTarget}h
                                    </span>
                                </div>
                            )}
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

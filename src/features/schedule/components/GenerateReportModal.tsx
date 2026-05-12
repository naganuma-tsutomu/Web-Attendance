import { useMemo } from 'react';
import { BarChart2, X, AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { calculateTotalHours, formatHours } from '../../../utils/timeUtils';
import { UNASSIGNED_STAFF_ID } from '../../../constants';
import type { Shift, Staff, ShiftClass, BreakSettings } from '../../../types';

export interface GenerateReportData {
    generatedShifts: Shift[];
    unassignedCount: number;
    yearMonth: string;
}

interface GenerateReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportData: GenerateReportData | null;
    staffList: Staff[];
    classes: ShiftClass[];
    breakSettings: BreakSettings | undefined;
}

const GenerateReportModal = ({
    isOpen,
    onClose,
    reportData,
    staffList,
    classes,
    breakSettings,
}: GenerateReportModalProps) => {
    const assignedShifts = useMemo(
        () => reportData?.generatedShifts.filter(s => s.staffId !== UNASSIGNED_STAFF_ID && !s.isError) ?? [],
        [reportData]
    );

    const totalHoursMap = useMemo(
        () => calculateTotalHours(assignedShifts, breakSettings),
        [assignedShifts, breakSettings]
    );

    const classShiftCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        assignedShifts.forEach(s => {
            counts[s.classType] = (counts[s.classType] || 0) + 1;
        });
        return counts;
    }, [assignedShifts]);

    const staffRows = useMemo(() => {
        return staffList
            .map(staff => ({
                staff,
                hours: totalHoursMap[staff.id] || 0,
                target: staff.hoursTarget || 0,
            }))
            .filter(row => row.hours > 0)
            .sort((a, b) => b.hours - a.hours);
    }, [staffList, totalHoursMap]);

    if (!reportData) return null;

    const { unassignedCount, generatedShifts } = reportData;
    const totalShifts = generatedShifts.length;
    const hasUnassigned = unassignedCount > 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-base font-bold text-slate-800 dark:text-white">生成レポート</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-colors"
                    aria-label="閉じる"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
                {/* サマリーカード */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">生成シフト数</p>
                            <p className="text-xl font-bold text-slate-800 dark:text-white">{totalShifts}<span className="text-sm font-normal ml-1">件</span></p>
                        </div>
                    </div>
                    <div className={`rounded-xl p-4 flex items-center gap-3 ${hasUnassigned ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                        <div className={`p-2 rounded-lg ${hasUnassigned ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
                            {hasUnassigned
                                ? <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                : <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            }
                        </div>
                        <div>
                            <p className={`text-xs ${hasUnassigned ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>未割当</p>
                            <p className={`text-xl font-bold ${hasUnassigned ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                                {unassignedCount}<span className="text-sm font-normal ml-1">件</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* クラス別シフト数 */}
                {classes.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">クラス別シフト数</h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden">
                            {classes.map((cls, i) => (
                                <div
                                    key={cls.id}
                                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${i < classes.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
                                >
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{cls.name}</span>
                                    <span className="font-bold text-slate-800 dark:text-white tabular-nums">
                                        {classShiftCounts[cls.id] || 0}<span className="text-xs font-normal text-slate-400 ml-1">件</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* スタッフ別勤務時間 */}
                <div>
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        スタッフ別勤務時間（月間）
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden">
                        {staffRows.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">データなし</p>
                        ) : (
                            staffRows.map((row, i) => {
                                const isOver = row.target > 0 && row.hours > row.target;
                                const diff = row.target > 0 ? row.hours - row.target : null;
                                return (
                                    <div
                                        key={row.staff.id}
                                        className={`px-4 py-2.5 ${i < staffRows.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
                                    >
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate pr-2">{row.staff.name}</span>
                                            <div className="flex items-baseline gap-2 flex-shrink-0 tabular-nums">
                                                <span className={`font-bold ${isOver ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                                                    {formatHours(row.hours)}h
                                                </span>
                                                {row.target > 0 && (
                                                    <span className="text-xs text-slate-400">/ {row.target}h</span>
                                                )}
                                                {diff !== null && (
                                                    <span className={`text-xs font-medium ${isOver ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                                        {isOver ? `+${formatHours(diff)}` : `-${formatHours(Math.abs(diff))}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {row.target > 0 && (
                                            <div className="mt-1.5 h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${Math.min((row.hours / row.target) * 100, 100)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
                <button
                    onClick={onClose}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                >
                    閉じる
                </button>
            </div>
        </Modal>
    );
};

export default GenerateReportModal;

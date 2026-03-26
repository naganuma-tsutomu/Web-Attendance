import { Views, type View } from 'react-big-calendar';
import { format, startOfWeek, addDays, addMonths, addWeeks, subMonths, subWeeks, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Settings2, Download, AlertCircle, Loader2, Trash2, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import type { Shift, Staff, ShiftClass, ShiftTimePattern, BusinessHours } from '../../../types';
import { exportToPDF } from '../../../lib/exportUtils';
import { exportToExcelAdvanced } from '../../../utils/excelExport';
import { getWeekStartsOn } from '../../../utils/dateUtils';

interface ScheduleHeaderProps {
    currentDate: Date;
    view: View;
    generating: boolean;
    errorCount: number;
    loadError: string | null;
    isSummaryOpen: boolean;
    targetYearMonth: string;
    staffList: Staff[];
    rawShifts: Shift[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    onDateChange: (date: Date) => void;
    onViewChange: (view: View) => void;
    onGenerate: () => void;
    onClearShifts: () => void;
    onToggleSummary: () => void;
    onRetry: () => void;
    businessHours?: BusinessHours;
}

const ScheduleHeader = ({
    currentDate,
    view,
    generating,
    errorCount,
    loadError,
    isSummaryOpen,
    targetYearMonth,
    staffList,
    rawShifts,
    classes,
    timePatterns,
    onDateChange,
    onViewChange,
    onGenerate,
    onClearShifts,
    onToggleSummary,
    onRetry,
    businessHours,
}: ScheduleHeaderProps) => {
    return (
        <div className="flex-shrink-0 p-4 sm:p-6 md:p-8 pb-4 md:pb-4 space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Date Navigation & View Switcher */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="flex bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
                        <button
                            onClick={() => {
                                if (view === Views.MONTH) onDateChange(subMonths(currentDate, 1));
                                else if (view === Views.WEEK) onDateChange(subWeeks(currentDate, 1));
                                else onDateChange(subDays(currentDate, 1));
                            }}
                            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <div className="px-3 py-1.5 font-bold text-slate-800 dark:text-white min-w-[120px] text-center">
                            {view === Views.MONTH
                                ? format(currentDate, 'yyyy年M月', { locale: ja })
                                : view === Views.WEEK
                                    ? `${format(startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() }), 'M/d')} - ${format(addDays(startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() }), 6), 'M/d')}`
                                    : format(currentDate, 'M月d日(E)', { locale: ja })
                            }
                        </div>
                        <button
                            onClick={() => {
                                if (view === Views.MONTH) onDateChange(addMonths(currentDate, 1));
                                else if (view === Views.WEEK) onDateChange(addWeeks(currentDate, 1));
                                else onDateChange(addDays(currentDate, 1));
                            }}
                            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                        {([
                            { key: Views.MONTH, label: '月' },
                            { key: Views.WEEK, label: '週' },
                            { key: Views.DAY, label: '日' },
                        ] as const).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => onViewChange(key)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${view === key ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <button
                        onClick={onGenerate}
                        disabled={generating}
                        className={`flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center ${generating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-indigo-700 hover:cursor-pointer'}`}
                    >
                        {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings2 className="w-5 h-5" />}
                        <span className="whitespace-nowrap">{generating ? '生成中...' : '自動生成'}</span>
                    </button>
                    <button
                        onClick={onClearShifts}
                        className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center hover:cursor-pointer"
                    >
                        <Trash2 className="w-5 h-5 text-red-500" />
                        <span className="whitespace-nowrap">消去</span>
                    </button>

                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button
                            onClick={onToggleSummary}
                            className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl shadow-sm transition-all flex-1 cursor-pointer ${isSummaryOpen
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            title="スタッフ別労働時間を表示"
                        >
                            <BarChart2 className={`w-5 h-5 ${isSummaryOpen ? 'text-white' : 'text-indigo-500'}`} />
                            <span className="hidden sm:inline text-sm font-bold whitespace-nowrap">労働時間</span>
                        </button>
                        <button
                            onClick={() => exportToExcelAdvanced(targetYearMonth, staffList, rawShifts, classes, timePatterns, businessHours)}
                            className="flex items-center justify-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl shadow-sm transition-colors flex-1 cursor-pointer"
                        >
                            <Download className="w-5 h-5 text-green-600" />
                            <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">Excel</span>
                        </button>
                        <button
                            onClick={() => exportToPDF(targetYearMonth, staffList, rawShifts)}
                            className="flex items-center justify-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl shadow-sm transition-colors flex-1 cursor-pointer"
                        >
                            <Download className="w-5 h-5 text-red-600" />
                            <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Warning Banner */}
            {errorCount > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm border-l-2 border-red-500 pl-3">
                        <p className="text-red-900 dark:text-red-200 font-medium">シフトエラーがあります ({errorCount}件)</p>
                    </div>
                </div>
            )}

            {/* Error Banner with Retry */}
            {loadError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in" role="alert">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-red-900 dark:text-red-200 font-medium">{loadError}</p>
                    </div>
                    <button
                        onClick={onRetry}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                        aria-label="再試行"
                    >
                        <Loader2 className="w-4 h-4" />
                        再試行
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScheduleHeader;

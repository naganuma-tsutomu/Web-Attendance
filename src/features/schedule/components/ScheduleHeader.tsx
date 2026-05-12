import { useState } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, startOfWeek, addDays, addMonths, addWeeks, subMonths, subWeeks, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Settings2, Download, AlertCircle, Loader2, Trash2, ChevronLeft, ChevronRight, BarChart2, Archive, FileUp, MoreHorizontal } from 'lucide-react';
import type { Shift, Staff, ShiftClass, ShiftTimePattern, BusinessHours, ShiftPreference, Holiday, ExcelSettings, BreakSettings, DynamicRole } from '../../../types';
import { exportToExcelAdvanced } from '../../../utils/excelExport';
import { getWeekStartsOn } from '../../../utils/dateUtils';
import DatePicker from '../../../components/ui/DatePicker';

interface ScheduleHeaderProps {
    currentDate: Date;
    view: View;
    generating: boolean;
    errorCount: number;
    errorDates?: { date: string; count: number }[];
    loadError: string | null;
    isFetching: boolean;
    isSummaryOpen: boolean;
    targetYearMonth: string;
    staffList: Staff[];
    rawShifts: Shift[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    preferences: ShiftPreference[];
    holidays: Holiday[];
    onDateChange: (date: Date) => void;
    onViewChange: (view: View) => void;
    onGenerate: () => void;
    onClearShifts: () => void;
    onOpenBackups: () => void;
    onOpenImport: () => void;
    onToggleSummary: () => void;
    onRetry: () => void;
    onErrorDateClick?: (date: Date) => void;
    businessHours?: BusinessHours;
    excelSettings?: ExcelSettings;
    breakSettings?: BreakSettings;
    roles?: DynamicRole[];
}

const ScheduleHeader = ({
    currentDate,
    view,
    generating,
    errorCount,
    errorDates = [],
    loadError,
    isFetching,
    isSummaryOpen,
    targetYearMonth,
    staffList,
    rawShifts,
    classes,
    timePatterns,
    preferences,
    holidays,
    onDateChange,
    onViewChange,
    onGenerate,
    onClearShifts,
    onOpenBackups,
    onOpenImport,
    onToggleSummary,
    onRetry,
    onErrorDateClick,
    businessHours,
    excelSettings,
    breakSettings,
    roles = []
}: ScheduleHeaderProps) => {
    const [showMoreMenu, setShowMoreMenu] = useState(false);

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
                            aria-label={view === Views.MONTH ? '前月へ' : view === Views.WEEK ? '前週へ' : '前日へ'}
                            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <DatePicker
                            date={currentDate}
                            onChange={onDateChange}
                            trigger={
                                <div className="px-3 py-1.5 font-bold text-slate-800 dark:text-white min-w-[120px] text-center hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer select-none">
                                    {view === Views.MONTH
                                        ? format(currentDate, 'yyyy年M月', { locale: ja })
                                        : view === Views.WEEK
                                            ? `${format(startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() }), 'M/d')} - ${format(addDays(startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() }), 6), 'M/d')}`
                                        : format(currentDate, 'M月d日(E)', { locale: ja })
                                    }
                                    {isFetching && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin inline-block ml-2 mb-0.5" />}
                                </div>
                            }
                        />
                        <button
                            onClick={() => {
                                if (view === Views.MONTH) onDateChange(addMonths(currentDate, 1));
                                else if (view === Views.WEEK) onDateChange(addWeeks(currentDate, 1));
                                else onDateChange(addDays(currentDate, 1));
                            }}
                            aria-label={view === Views.MONTH ? '翌月へ' : view === Views.WEEK ? '翌週へ' : '翌日へ'}
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

                    {/* デスクトップ: 個別ボタン */}
                    <button
                        onClick={onClearShifts}
                        className="hidden sm:flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-4 py-2.5 rounded-xl shadow-sm transition-colors justify-center hover:cursor-pointer"
                    >
                        <Trash2 className="w-5 h-5 text-red-500" />
                        <span className="whitespace-nowrap">消去</span>
                    </button>
                    <button
                        onClick={onOpenBackups}
                        className="hidden sm:flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl shadow-sm transition-colors justify-center hover:cursor-pointer"
                    >
                        <Archive className="w-5 h-5 text-indigo-500" />
                        <span className="whitespace-nowrap">バックアップ</span>
                    </button>
                    <button
                        onClick={onOpenImport}
                        className="hidden sm:flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl shadow-sm transition-colors justify-center hover:cursor-pointer"
                    >
                        <FileUp className="w-5 h-5 text-emerald-600" />
                        <span className="whitespace-nowrap">取込</span>
                    </button>
                    <button
                        onClick={onToggleSummary}
                        className={`hidden sm:flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer ${isSummaryOpen
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        title="スタッフ別労働時間を表示"
                    >
                        <BarChart2 className={`w-5 h-5 ${isSummaryOpen ? 'text-white' : 'text-indigo-500'}`} />
                        <span className="text-sm font-bold whitespace-nowrap">労働時間</span>
                    </button>
                    <button
                        onClick={() => exportToExcelAdvanced(targetYearMonth, staffList, rawShifts, classes, timePatterns, businessHours, preferences, holidays, excelSettings, breakSettings, roles)}
                        className="hidden sm:flex items-center justify-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                    >
                        <Download className="w-5 h-5 text-green-600" />
                        <span className="text-xs font-bold whitespace-nowrap">Excel</span>
                    </button>

                    {/* モバイル: 労働時間 + バックアップ + ⋯ドロップダウン */}
                    <button
                        onClick={onOpenBackups}
                        className="sm:hidden flex items-center justify-center px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="バックアップ"
                    >
                        <Archive className="w-5 h-5 text-indigo-500" />
                    </button>
                    <button
                        onClick={onToggleSummary}
                        className={`sm:hidden flex items-center justify-center px-3 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer ${isSummaryOpen
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                            }`}
                        title="スタッフ別労働時間を表示"
                    >
                        <BarChart2 className={`w-5 h-5 ${isSummaryOpen ? 'text-white' : 'text-indigo-500'}`} />
                    </button>
                    <div className="sm:hidden relative">
                        <button
                            onClick={() => setShowMoreMenu(v => !v)}
                            className="flex items-center justify-center px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="その他の操作"
                        >
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {showMoreMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                                <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150">
                                    <button
                                        onClick={() => { onClearShifts(); setShowMoreMenu(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        消去
                                    </button>
                                    <button
                                        onClick={() => { onOpenImport(); setShowMoreMenu(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <FileUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        取込
                                    </button>
                                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                                    <button
                                        onClick={() => { exportToExcelAdvanced(targetYearMonth, staffList, rawShifts, classes, timePatterns, businessHours, preferences, holidays, excelSettings, breakSettings, roles); setShowMoreMenu(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Download className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        Excel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Warning Banner */}
            {errorCount > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm border-l-2 border-red-500 pl-3 flex-1 min-w-0">
                        <p className="text-red-900 dark:text-red-200 font-medium">シフトエラーがあります ({errorCount}件)</p>
                        {errorDates.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {errorDates.map(({ date, count }) => {
                                    const d = new Date(`${date}T00:00:00`);
                                    const label = format(d, 'M/d(E)', { locale: ja });
                                    return (
                                        <button
                                            key={date}
                                            type="button"
                                            onClick={() => onErrorDateClick?.(d)}
                                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 text-xs text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                                            title={`${label} の未割り当て ${count}件を確認`}
                                        >
                                            {label}{count > 1 ? ` (${count})` : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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

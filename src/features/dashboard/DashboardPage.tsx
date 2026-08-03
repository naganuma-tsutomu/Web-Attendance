import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatHours } from '../../utils/timeUtils';
import { loadActiveMonth, saveActiveMonth } from '../../utils/dateUtils';
import MonthNavigation from '../../components/ui/MonthNavigation';
import { analyzeSchedule } from '../../lib/scheduleAnalysis';
import {
    useBreakSettings, useBusinessDayOverrides, useBusinessHours, useClasses, useHolidays,
    usePreferencesByMonth, useShiftRequirements, useShiftsByMonth, useStaffList,
} from '../../lib/hooks';

export default function DashboardPage() {
    const [yearMonth, setYearMonth] = useState(() => format(loadActiveMonth(), 'yyyy-MM'));

    useEffect(() => {
        saveActiveMonth(parseISO(`${yearMonth}-01`));
    }, [yearMonth]);
    const year = Number(yearMonth.slice(0, 4));
    const shifts = useShiftsByMonth(yearMonth);
    const staffs = useStaffList();
    const classes = useClasses();
    const preferences = usePreferencesByMonth(yearMonth);
    const requirements = useShiftRequirements();
    const holidays = useHolidays(year);
    const overrides = useBusinessDayOverrides(yearMonth);
    const businessHours = useBusinessHours();
    const breakSettings = useBreakSettings();
    const loading = [shifts, staffs, classes, preferences, requirements, holidays, overrides, businessHours, breakSettings].some(query => query.isLoading);
    const error = [shifts, staffs, classes, preferences, requirements, holidays, overrides, businessHours, breakSettings].some(query => query.isError);
    const analysis = useMemo(() => analyzeSchedule({
        yearMonth,
        shifts: shifts.data ?? [],
        staffs: staffs.data ?? [],
        classes: classes.data ?? [],
        preferences: preferences.data ?? [],
        requirements: requirements.data ?? [],
        holidays: holidays.data ?? [],
        businessDayOverrides: overrides.data ?? [],
        businessHours: businessHours.data,
        breakSettings: breakSettings.data,
    }), [yearMonth, shifts.data, staffs.data, classes.data, preferences.data, requirements.data, holidays.data, overrides.data, businessHours.data, breakSettings.data]);

    const cards = [
        { label: '必要人数充足率', value: `${Math.round(analysis.summary.fillRate * 100)}%`, icon: CheckCircle2, color: 'text-emerald-600' },
        { label: '未割当', value: `${analysis.summary.unassignedCount}件`, icon: Users, color: 'text-amber-600' },
        { label: 'エラー・警告', value: `${analysis.summary.errorCount + analysis.summary.warningCount}件`, icon: AlertTriangle, color: 'text-red-600' },
        { label: '希望休提出', value: `${analysis.summary.submittedCount}/${analysis.summary.staffCount}名`, icon: CalendarDays, color: 'text-sky-600' },
    ];

    return (
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:space-y-6 sm:p-6 md:p-8">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center space-x-2 sm:space-x-3"><BarChart3 className="h-6 w-6 shrink-0 text-indigo-500 sm:h-8 sm:w-8" /><div><h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">集計ダッシュボード</h2><p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">登録済みシフトに基づく予定値です。勤務実績ではありません。</p></div></div>
                <MonthNavigation date={parseISO(`${yearMonth}-01`)} onChange={date => setYearMonth(format(date, 'yyyy-MM'))} />
            </header>
            {loading && <div className="rounded-2xl bg-white p-8 text-center text-slate-500 dark:bg-slate-800">集計中...</div>}
            {error && <div className="rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">データの取得に失敗しました。</div>}
            {!loading && !error && <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <div key={label} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-4"><Icon className={`h-5 w-5 ${color}`} /><p className="mt-3 truncate text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{value}</p></div>)}</div>
                <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5"><h3 className="mb-4 font-bold text-slate-900 dark:text-white">クラス別充足率</h3><div className="space-y-4">{analysis.classMetrics.map(metric => <div key={metric.classId}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{metric.className}</span><span className="shrink-0 text-slate-500">{Math.round(metric.fillRate * 100)}%</span></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-2 rounded-full ${metric.fillRate >= 1 ? 'bg-emerald-500' : metric.fillRate >= .8 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, metric.fillRate * 100)}%` }} /></div></div>)}</div></section>
                <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="p-4 sm:p-5"><h3 className="font-bold text-slate-900 dark:text-white">スタッフ別予定時間</h3></div><div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/20 sm:hidden">{analysis.staffMetrics.map(metric => <article key={metric.staffId} className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="mb-3 flex items-center justify-between gap-3"><h4 className="min-w-0 truncate font-bold text-slate-800 dark:text-slate-100">{metric.staffName}</h4><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${metric.issueCount > 0 ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>問題 {metric.issueCount}件</span></div><dl className="grid grid-cols-3 gap-x-2 text-sm"><div className="min-w-0"><dt className="text-xs text-slate-500">予定 / 目標</dt><dd className="mt-0.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{formatHours(metric.scheduledHours)}h / {metric.targetHours == null ? '—' : `${formatHours(metric.targetHours)}h`}</dd></div><div className="min-w-0"><dt className="text-xs text-slate-500">差</dt><dd className={`mt-0.5 whitespace-nowrap font-medium ${metric.differenceHours != null && metric.differenceHours > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{metric.differenceHours == null ? '—' : `${metric.differenceHours > 0 ? '+' : ''}${formatHours(metric.differenceHours)}h`}</dd></div><div className="min-w-0"><dt className="text-xs text-slate-500">勤務日</dt><dd className="mt-0.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{metric.workingDays}日</dd></div></dl></article>)}</div><div className="hidden overflow-x-auto sm:block"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/40"><tr><th className="px-5 py-3">スタッフ</th><th className="px-5 py-3">予定</th><th className="px-5 py-3">目標</th><th className="px-5 py-3">差</th><th className="px-5 py-3">勤務日</th><th className="px-5 py-3">問題</th></tr></thead><tbody>{analysis.staffMetrics.map(metric => <tr key={metric.staffId} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{metric.staffName}</td><td className="px-5 py-3">{formatHours(metric.scheduledHours)}h</td><td className="px-5 py-3">{metric.targetHours == null ? '—' : `${formatHours(metric.targetHours)}h`}</td><td className={`px-5 py-3 ${metric.differenceHours != null && metric.differenceHours > 0 ? 'text-red-600' : ''}`}>{metric.differenceHours == null ? '—' : `${metric.differenceHours > 0 ? '+' : ''}${formatHours(metric.differenceHours)}h`}</td><td className="px-5 py-3">{metric.workingDays}日</td><td className="px-5 py-3">{metric.issueCount}件</td></tr>)}</tbody></table></div></section>
            </>}
        </div>
    );
}

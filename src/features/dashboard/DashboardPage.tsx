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
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div><h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><BarChart3 className="h-6 w-6 text-indigo-500" />集計ダッシュボード</h2><p className="mt-1 text-sm text-slate-500">登録済みシフトに基づく予定値です。勤務実績ではありません。</p></div>
                <MonthNavigation date={parseISO(`${yearMonth}-01`)} onChange={date => setYearMonth(format(date, 'yyyy-MM'))} />
            </header>
            {loading && <div className="rounded-2xl bg-white p-8 text-center text-slate-500 dark:bg-slate-800">集計中...</div>}
            {error && <div className="rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">データの取得に失敗しました。</div>}
            {!loading && !error && <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"><Icon className={`h-5 w-5 ${color}`} /><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p></div>)}</div>
                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"><h3 className="mb-4 font-bold text-slate-900 dark:text-white">クラス別充足率</h3><div className="space-y-4">{analysis.classMetrics.map(metric => <div key={metric.classId}><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-700 dark:text-slate-200">{metric.className}</span><span className="text-slate-500">{Math.round(metric.fillRate * 100)}%</span></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-2 rounded-full ${metric.fillRate >= 1 ? 'bg-emerald-500' : metric.fillRate >= .8 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, metric.fillRate * 100)}%` }} /></div></div>)}</div></section>
                <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="p-5"><h3 className="font-bold text-slate-900 dark:text-white">スタッフ別予定時間</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/40"><tr><th className="px-5 py-3">スタッフ</th><th className="px-5 py-3">予定</th><th className="px-5 py-3">目標</th><th className="px-5 py-3">差</th><th className="px-5 py-3">勤務日</th><th className="px-5 py-3">問題</th></tr></thead><tbody>{analysis.staffMetrics.map(metric => <tr key={metric.staffId} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{metric.staffName}</td><td className="px-5 py-3">{formatHours(metric.scheduledHours)}h</td><td className="px-5 py-3">{metric.targetHours == null ? '—' : `${formatHours(metric.targetHours)}h`}</td><td className={`px-5 py-3 ${metric.differenceHours != null && metric.differenceHours > 0 ? 'text-red-600' : ''}`}>{metric.differenceHours == null ? '—' : `${metric.differenceHours > 0 ? '+' : ''}${formatHours(metric.differenceHours)}h`}</td><td className="px-5 py-3">{metric.workingDays}日</td><td className="px-5 py-3">{metric.issueCount}件</td></tr>)}</tbody></table></div></section>
            </>}
        </div>
    );
}

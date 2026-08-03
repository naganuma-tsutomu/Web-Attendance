import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import type { ScheduleAnalysisResult, ScheduleIssueSeverity } from '../../../lib/scheduleAnalysis';

interface Props {
    analysis: ScheduleAnalysisResult;
    isOpen: boolean;
    onClose: () => void;
    onSelectDate: (date: string) => void;
}

export default function ScheduleIssuesPanel({ analysis, isOpen, onClose, onSelectDate }: Props) {
    const [severity, setSeverity] = useState<ScheduleIssueSeverity | 'all'>('all');
    const issues = useMemo(() => analysis.issues.filter(issue => severity === 'all' || issue.severity === severity), [analysis.issues, severity]);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="schedule-issues-title">
            <button className="absolute inset-0 bg-slate-950/45" onClick={onClose} aria-label="閉じる" />
            <section className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-800 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 id="schedule-issues-title" className="text-xl font-bold text-slate-900 dark:text-white">シフトの問題</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{analysis.yearMonth}・{analysis.summary.affectedDateCount}日が対象</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="閉じる"><X className="h-5 w-5" /></button>
                </div>
                <div className="mb-5 grid grid-cols-3 gap-2">
                    {([
                        ['all', 'すべて', analysis.issues.length],
                        ['error', 'エラー', analysis.summary.errorCount],
                        ['warning', '警告', analysis.summary.warningCount],
                    ] as const).map(([key, label, count]) => (
                        <button key={key} onClick={() => setSeverity(key)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${severity === key ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
                            {label}<span className="ml-1">{count}</span>
                        </button>
                    ))}
                </div>
                <div className="space-y-2">
                    {issues.length === 0 && <p className="rounded-xl bg-emerald-50 p-5 text-center text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">該当する問題はありません。</p>}
                    {issues.map(issue => (
                        <button key={issue.id} onClick={() => { onSelectDate(issue.date); onClose(); }} className="flex w-full gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                            {issue.severity === 'error' ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
                            <span className="min-w-0">
                                <span className="block text-xs font-bold text-slate-500 dark:text-slate-400">{issue.date}{issue.startTime ? ` ${issue.startTime}${issue.endTime ? `〜${issue.endTime}` : ''}` : ''}</span>
                                <span className="mt-1 block text-sm text-slate-800 dark:text-slate-100">{issue.message}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuditLogs } from '../../lib/hooks';
import { loadActiveMonth, saveActiveMonth } from '../../utils/dateUtils';
import MonthNavigation from '../../components/ui/MonthNavigation';

const actionLabels: Record<string, string> = { create: '追加', update: '更新', delete: '削除', replace: '一括置換', import: '取込', restore: '復元', lock: 'ロック', unlock: '解除' };
export default function AuditLogPage() {
    const [yearMonth, setYearMonth] = useState(() => format(loadActiveMonth(), 'yyyy-MM'));
    const [action, setAction] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isError,
        isFetchingNextPage,
        isLoading,
    } = useAuditLogs(yearMonth, action);
    const logs = data?.pages.flatMap(page => page.items) ?? [];

    useEffect(() => {
        saveActiveMonth(parseISO(`${yearMonth}-01`));
    }, [yearMonth]);

    return (
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:space-y-6 sm:p-6 md:p-8">
            <header className="mb-4 flex items-center space-x-2 sm:mb-6 sm:space-x-3"><History className="h-6 w-6 shrink-0 text-indigo-500 sm:h-8 sm:w-8" /><div><h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">操作履歴</h2><p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">シフトやロックなどの主要な変更を確認できます。</p></div></header>
            <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800 sm:flex-row">
                <MonthNavigation date={parseISO(`${yearMonth}-01`)} onChange={date => setYearMonth(format(date, 'yyyy-MM'))} />
                <select value={action} onChange={event => setAction(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 dark:border-slate-600 dark:bg-slate-900" aria-label="操作種別"><option value="">すべての操作</option>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
            {isLoading && <p className="rounded-2xl bg-white p-8 text-center text-slate-500 dark:bg-slate-800">読み込み中...</p>}
            {isError && <p className="rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">操作履歴を取得できません。マイグレーションの適用状況を確認してください。</p>}
            {!isLoading && !isError && <div className="space-y-2">{logs.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-slate-500 dark:bg-slate-800">この月の操作履歴はありません。</p>}{logs.map(log => <article key={log.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><button onClick={() => setExpanded(expanded === log.id ? null : log.id)} className="flex w-full items-center gap-3 p-4 text-left"><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><span className="min-w-0 font-medium text-slate-800 dark:text-slate-100">{log.summary}</span><span className="hidden shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 sm:inline-block">{actionLabels[log.action] ?? log.action}</span></span><span className="mt-1 block text-xs text-slate-500">{new Date(`${log.occurredAt}Z`).toLocaleString('ja-JP')}・{log.actorType === 'staff' ? 'スタッフ' : log.actorType === 'admin' ? '管理者' : 'システム'}{log.targetDate ? `・${log.targetDate}` : ''}</span></span><span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 sm:hidden">{actionLabels[log.action] ?? log.action}</span>{expanded === log.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}</button>{expanded === log.id && <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-4 text-xs dark:border-slate-700 dark:bg-slate-900/40 sm:grid-cols-2">{log.before != null && <div><p className="mb-1 font-bold text-slate-500">変更前</p><pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 dark:bg-slate-800">{JSON.stringify(log.before, null, 2)}</pre></div>}{log.after != null && <div><p className="mb-1 font-bold text-slate-500">変更後</p><pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 dark:bg-slate-800">{JSON.stringify(log.after, null, 2)}</pre></div>}{log.metadata != null && <div className="sm:col-span-2"><p className="mb-1 font-bold text-slate-500">処理情報</p><pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 dark:bg-slate-800">{JSON.stringify(log.metadata, null, 2)}</pre></div>}</div>}</article>)}{hasNextPage && <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage} className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">{isFetchingNextPage ? '読み込み中...' : 'さらに読み込む'}</button>}</div>}
        </div>
    );
}

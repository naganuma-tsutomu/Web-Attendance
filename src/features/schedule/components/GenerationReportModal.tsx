import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { AlertTriangle, BarChart3, CheckCircle2, Clock, Lock, Users, X } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { formatHours } from '../../../utils/timeUtils';
import type { GenerationReport } from '../../../types';

interface GenerationReportModalProps {
    isOpen: boolean;
    report: GenerationReport | null;
    onClose: () => void;
    onOpenDate: (date: Date) => void;
}

const formatDate = (date: string) => {
    try {
        return format(parseISO(date), 'M/d(E)', { locale: ja });
    } catch {
        return date;
    }
};

const SummaryTile = ({
    icon,
    label,
    value,
    tone = 'slate',
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    tone?: 'slate' | 'red' | 'emerald' | 'indigo';
}) => {
    const tones = {
        slate: 'bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
    };

    return (
        <div className={`rounded-xl px-4 py-3 ${tones[tone]}`}>
            <div className="flex items-center gap-2 text-xs font-bold opacity-80">
                {icon}
                {label}
            </div>
            <div className="mt-1 text-2xl font-black">{value}</div>
        </div>
    );
};

const GenerationReportModal = ({ isOpen, report, onClose, onOpenDate }: GenerationReportModalProps) => {
    if (!report) return null;

    const overTargetCount = report.staffRows.filter(row => (row.diffHours ?? 0) > 0).length;
    const underTargetCount = report.staffRows.filter(row => row.diffHours !== null && row.diffHours < 0).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} zIndex="z-[90]" aria-label="生成レポート">
            <div className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">自動生成レポート</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {report.yearMonth} / {format(parseISO(report.generatedAt), 'M/d HH:mm', { locale: ja })}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="閉じる"
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5 overflow-y-auto">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <SummaryTile icon={<CheckCircle2 className="w-4 h-4" />} label="生成枠" value={`${report.generatedCount}件`} tone="indigo" />
                        <SummaryTile icon={<AlertTriangle className="w-4 h-4" />} label="未割当" value={`${report.unassignedCount}件`} tone={report.unassignedCount > 0 ? 'red' : 'emerald'} />
                        <SummaryTile icon={<Lock className="w-4 h-4" />} label="固定日保持" value={`${report.fixedDateCount}日`} />
                        <SummaryTile icon={<Users className="w-4 h-4" />} label="目標差分" value={`超${overTargetCount} / 未${underTargetCount}`} />
                    </div>

                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">未割当</h3>
                        </div>
                        <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                            {report.unassignedRows.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-emerald-600 dark:text-emerald-400 font-bold">未割当はありません</div>
                            ) : (
                                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                    {report.unassignedRows.map(row => (
                                        <button
                                            key={row.id}
                                            type="button"
                                            onClick={() => onOpenDate(parseISO(row.date))}
                                            className="w-full px-4 py-3 grid grid-cols-[92px_1fr_auto] gap-3 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <span className="font-bold text-slate-800 dark:text-slate-100">{formatDate(row.date)}</span>
                                            <span className="text-slate-600 dark:text-slate-300">{row.className}</span>
                                            <span className="text-red-600 dark:text-red-300 font-bold whitespace-nowrap">{row.startTime}-{row.endTime}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-indigo-500" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">スタッフ別 目標差分</h3>
                            </div>
                            <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                    {report.staffRows.slice(0, 12).map(row => {
                                        const diff = row.diffHours;
                                        const diffClass = diff === null
                                            ? 'text-slate-400'
                                            : diff > 0
                                                ? 'text-red-600 dark:text-red-300'
                                                : diff < 0
                                                    ? 'text-amber-600 dark:text-amber-300'
                                                    : 'text-emerald-600 dark:text-emerald-300';
                                        return (
                                            <div key={row.staffId} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                                                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{row.staffName}</span>
                                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {formatHours(row.actualHours)}h
                                                    {row.targetHours !== null && ` / ${formatHours(row.targetHours)}h`}
                                                    <span className={`ml-2 font-black ${diffClass}`}>
                                                        {diff === null ? '-' : `${diff > 0 ? '+' : ''}${formatHours(diff)}h`}
                                                    </span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-emerald-600" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">クラス別 充足率</h3>
                            </div>
                            <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                                {report.classRows.map(row => {
                                    const percent = Math.round(row.fillRate * 100);
                                    const barClass = percent < 100 ? 'bg-amber-500' : 'bg-emerald-500';
                                    return (
                                        <div key={row.classId} className="px-4 py-3 space-y-2">
                                            <div className="flex items-center justify-between gap-3 text-sm">
                                                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{row.className}</span>
                                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {row.assignedCount}/{row.totalCount}枠
                                                    <span className="ml-2 font-black text-slate-800 dark:text-white">{percent}%</span>
                                                </span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default GenerationReportModal;

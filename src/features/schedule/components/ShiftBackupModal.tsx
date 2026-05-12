import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Archive, Download, Loader2, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../../../components/ui/Modal';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { useCreateShiftSnapshot, useRestoreShiftSnapshot, useShiftSnapshots } from '../../../lib/hooks';
import { handleApiError } from '../../../lib/errorHandler';
import { downloadShiftSnapshotCsv } from '../../../lib/api';
import type { ShiftSnapshotMetadata } from '../../../types';

interface ShiftBackupModalProps {
    isOpen: boolean;
    yearMonth: string;
    onClose: () => void;
    onRestored: () => void;
}

const getReasonLabel = (reason: string) => {
    switch (reason) {
        case 'manual':
            return '手動';
        case 'before-generate':
            return '自動生成前';
        case 'before-clear':
            return '消去前';
        case 'restore-before':
            return '復元前';
        case 'before-import':
            return '取込前';
        default:
            return reason;
    }
};

const formatCreatedAt = (value: string) => {
    try {
        return format(parseISO(value.replace(' ', 'T')), 'yyyy/M/d HH:mm', { locale: ja });
    } catch {
        return value;
    }
};

const ShiftBackupModal = ({ isOpen, yearMonth, onClose, onRestored }: ShiftBackupModalProps) => {
    const [label, setLabel] = useState('');
    const [restoreTarget, setRestoreTarget] = useState<ShiftSnapshotMetadata | null>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const { data: snapshots = [], isLoading, refetch } = useShiftSnapshots(yearMonth);
    const createSnapshot = useCreateShiftSnapshot();
    const restoreSnapshot = useRestoreShiftSnapshot();

    const sortedSnapshots = useMemo(
        () => [...snapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        [snapshots]
    );

    const handleCreate = async () => {
        try {
            await createSnapshot.mutateAsync({
                yearMonth,
                reason: 'manual',
                label: label.trim() || null,
            });
            setLabel('');
            toast.success('バックアップを作成しました');
            await refetch();
        } catch (err) {
            handleApiError(err, 'バックアップの作成に失敗しました');
        }
    };

    const handleRestore = async () => {
        if (!restoreTarget) return;
        try {
            const result = await restoreSnapshot.mutateAsync({ id: restoreTarget.id });
            toast.success(`${result.restoredShiftCount}件のシフトを復元しました`);
            setRestoreTarget(null);
            onRestored();
            onClose();
        } catch (err) {
            handleApiError(err, 'バックアップの復元に失敗しました');
        }
    };

    const handleExportCsv = async (snapshot: ShiftSnapshotMetadata) => {
        setExportingId(snapshot.id);
        try {
            const blob = await downloadShiftSnapshotCsv(snapshot.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeLabel = (snapshot.label || getReasonLabel(snapshot.reason)).replace(/[\\/:*?"<>|]/g, '_');
            link.href = url;
            link.download = `shift_backup_${snapshot.yearMonth}_${safeLabel}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('CSVを出力しました');
        } catch (err) {
            handleApiError(err, 'CSV出力に失敗しました');
        } finally {
            setExportingId(null);
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} zIndex="z-[90]">
                <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                                <Archive className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">バックアップ</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{yearMonth}</p>
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

                    <div className="p-5 space-y-5">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="メモ（任意）"
                                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={createSnapshot.isPending}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {createSnapshot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                作成
                            </button>
                        </div>

                        <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                            {isLoading ? (
                                <div className="h-40 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    読み込み中...
                                </div>
                            ) : sortedSnapshots.length === 0 ? (
                                <div className="h-40 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                                    まだバックアップはありません
                                </div>
                            ) : (
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                    {sortedSnapshots.map(snapshot => (
                                        <div key={snapshot.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-bold text-slate-900 dark:text-white truncate">
                                                        {snapshot.label || getReasonLabel(snapshot.reason)}
                                                    </p>
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                                                        {getReasonLabel(snapshot.reason)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {formatCreatedAt(snapshot.createdAt)} / {snapshot.shiftCount}件
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleExportCsv(snapshot)}
                                                    disabled={exportingId === snapshot.id}
                                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {exportingId === snapshot.id ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Download className="w-4 h-4 text-emerald-600" />}
                                                    CSV
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRestoreTarget(snapshot)}
                                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    <RotateCcw className="w-4 h-4 text-indigo-500" />
                                                    復元
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={restoreTarget !== null}
                title="バックアップを復元"
                message="現在の月シフトと固定状態を、このバックアップの内容に置き換えます。復元前の状態も自動でバックアップされます。"
                confirmLabel="復元"
                onConfirm={handleRestore}
                onCancel={() => setRestoreTarget(null)}
                variant="info"
                isLoading={restoreSnapshot.isPending}
            />
        </>
    );
};

export default ShiftBackupModal;

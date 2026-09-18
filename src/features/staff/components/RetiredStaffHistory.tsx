import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { usePermanentlyDeleteRetiredStaff, useRestoreRetiredStaff, useRetiredStaffList } from '../../../lib/hooks';
import { handleApiError } from '../../../lib/errorHandler';
import type { RetiredStaff } from '../../../lib/api';

const RetiredStaffHistory = () => {
    const { data: retiredStaff = [], isLoading, isError, refetch } = useRetiredStaffList();
    const permanentDelete = usePermanentlyDeleteRetiredStaff();
    const restore = useRestoreRetiredStaff();
    const [deleteTarget, setDeleteTarget] = useState<RetiredStaff | null>(null);
    const [restoreTarget, setRestoreTarget] = useState<RetiredStaff | null>(null);

    const confirmRestore = async () => {
        if (!restoreTarget) return;
        try {
            await restore.mutateAsync(restoreTarget.id);
            setRestoreTarget(null);
            toast.success('現役スタッフに戻しました。新しいアクセスキーをスタッフ管理で確認してください。');
        } catch (error) {
            handleApiError(error, '復職処理に失敗しました');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await permanentDelete.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
            toast.success('退職者と関連シフトを完全に削除しました。');
        } catch (error) {
            handleApiError(error, '完全削除に失敗しました');
        }
    };

    if (isLoading) return <p className="text-sm text-slate-500">退職者履歴を読み込んでいます…</p>;
    if (isError) return <div role="alert" className="text-sm text-rose-600">退職者履歴を読み込めませんでした。<button className="ml-2 underline" onClick={() => void refetch()}>再試行</button></div>;

    return (
        <section aria-label="退職者履歴" className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">元に戻すと既存のシフトを引き継ぎます。完全削除すると関連シフトも削除されます。</p>
            {retiredStaff.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">退職者はいません</p>
            ) : retiredStaff.map(staff => (
                <div key={staff.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white">{staff.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{staff.role} · 退職日 {staff.retiredAt.slice(0, 10)} · シフト {staff.shiftCount}件</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <button type="button" onClick={() => setRestoreTarget(staff)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20" aria-label={`${staff.name}を現役スタッフに戻す`}>
                            <RotateCcw className="h-4 w-4" />
                            元に戻す
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(staff)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" aria-label={`${staff.name}を完全削除`}>
                            <Trash2 className="h-4 w-4" />
                            完全削除
                        </button>
                    </div>
                </div>
            ))}
            <ConfirmModal
                isOpen={restoreTarget !== null}
                title="退職者を元に戻す"
                message={`${restoreTarget?.name ?? ''} さんを現役スタッフに戻します。既存のシフトはそのまま残り、ログイン用の新しいアクセスキーが発行されます。`}
                confirmLabel="元に戻す"
                onConfirm={() => void confirmRestore()}
                onCancel={() => setRestoreTarget(null)}
                isLoading={restore.isPending}
                variant="info"
            />
            <ConfirmModal
                isOpen={deleteTarget !== null}
                title="退職者の完全削除"
                message={`${deleteTarget?.name ?? ''} さんと関連シフト ${deleteTarget?.shiftCount ?? 0}件を完全に削除します。スナップショット内の該当シフトも削除します。`}
                confirmLabel="完全削除する"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setDeleteTarget(null)}
                isLoading={permanentDelete.isPending}
                variant="danger"
            />
        </section>
    );
};

export default RetiredStaffHistory;

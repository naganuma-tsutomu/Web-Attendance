import { useEffect, useState } from 'react';
import { FilePlus2, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    applyShiftRequirementTemplate,
    createShiftRequirementTemplate,
    deleteShiftRequirementTemplate,
    overwriteShiftRequirementTemplate,
    renameShiftRequirementTemplate,
} from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import { QUERY_KEYS, useShiftRequirementTemplates } from '../../../lib/hooks';
import Modal from '../../../components/ui/Modal';
import ConfirmModal from '../../../components/ui/ConfirmModal';

interface RequirementTemplateManagerProps {
    hasUnsavedChanges: boolean;
}

type NameDialog = { mode: 'create'; name: string } | { mode: 'rename'; name: string } | null;
type ConfirmAction = 'apply' | 'overwrite' | 'delete' | null;

const RequirementTemplateManager = ({ hasUnsavedChanges }: RequirementTemplateManagerProps) => {
    const queryClient = useQueryClient();
    const { data: templates = [], isLoading } = useShiftRequirementTemplates();
    const [selectedId, setSelectedId] = useState('');
    const [nameDialog, setNameDialog] = useState<NameDialog>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (templates.length === 0) {
            setSelectedId('');
            return;
        }
        if (!templates.some(template => template.id === selectedId)) {
            setSelectedId(templates[0].id);
        }
    }, [selectedId, templates]);

    const selectedTemplate = templates.find(template => template.id === selectedId);

    const handleNameSubmit = async () => {
        if (!nameDialog || !nameDialog.name.trim() || isProcessing) return;
        if (nameDialog.mode === 'create') {
            const duplicate = templates.find(template => template.name === nameDialog.name.trim());
            if (duplicate) {
                setSelectedId(duplicate.id);
                setNameDialog(null);
                setConfirmAction('overwrite');
                return;
            }
        }
        setIsProcessing(true);
        try {
            if (nameDialog.mode === 'create') {
                const id = await createShiftRequirementTemplate(nameDialog.name);
                setSelectedId(id);
                toast.success(`テンプレート「${nameDialog.name.trim()}」を保存しました`);
            } else if (selectedTemplate) {
                await renameShiftRequirementTemplate(selectedTemplate.id, nameDialog.name);
                toast.success('テンプレート名を変更しました');
            }
            setNameDialog(null);
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftRequirementTemplates });
        } catch (err) {
            handleApiError(err, nameDialog.mode === 'create' ? 'テンプレートの保存に失敗しました' : '名前の変更に失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedTemplate || !confirmAction || isProcessing) return;
        setIsProcessing(true);
        try {
            if (confirmAction === 'apply') {
                await applyShiftRequirementTemplate(selectedTemplate.id);
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftRequirements });
                toast.success(`テンプレート「${selectedTemplate.name}」を呼び出しました`);
            } else if (confirmAction === 'overwrite') {
                await overwriteShiftRequirementTemplate(selectedTemplate.id);
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftRequirementTemplates });
                toast.success(`テンプレート「${selectedTemplate.name}」を上書きしました`);
            } else {
                await deleteShiftRequirementTemplate(selectedTemplate.id);
                setSelectedId('');
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftRequirementTemplates });
                toast.success(`テンプレート「${selectedTemplate.name}」を削除しました`);
            }
            setConfirmAction(null);
        } catch (err) {
            const fallback = confirmAction === 'apply'
                ? 'テンプレートの呼び出しに失敗しました'
                : confirmAction === 'overwrite'
                    ? 'テンプレートの上書きに失敗しました'
                    : 'テンプレートの削除に失敗しました';
            handleApiError(err, fallback);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6">
                <div className="flex flex-col gap-4">
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">必要人数テンプレート</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            全クラスの必要人数設定をまとめて保存・呼び出しできます。
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            aria-label="必要人数テンプレート"
                            value={selectedId}
                            onChange={event => setSelectedId(event.target.value)}
                            disabled={isLoading || templates.length === 0 || isProcessing}
                            className="min-w-0 flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                        >
                            {templates.length === 0 && <option value="">テンプレートはありません</option>}
                            {templates.map(template => (
                                <option key={template.id} value={template.id}>
                                    {template.name}（{template.itemCount}件）
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setConfirmAction('apply')}
                            disabled={!selectedTemplate || isProcessing}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50"
                        >
                            呼び出す
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setNameDialog({ mode: 'create', name: '' })}
                            disabled={hasUnsavedChanges || isProcessing}
                            title={hasUnsavedChanges ? '先に必要人数設定を保存してください' : undefined}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                        >
                            <FilePlus2 className="w-4 h-4" />
                            現在の設定を保存
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmAction('overwrite')}
                            disabled={!selectedTemplate || hasUnsavedChanges || isProcessing}
                            title={hasUnsavedChanges ? '先に必要人数設定を保存してください' : undefined}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                            選択中を上書き
                        </button>
                        <button
                            type="button"
                            onClick={() => selectedTemplate && setNameDialog({ mode: 'rename', name: selectedTemplate.name })}
                            disabled={!selectedTemplate || isProcessing}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                            <Pencil className="w-4 h-4" />
                            名前変更
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmAction('delete')}
                            disabled={!selectedTemplate || isProcessing}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            削除
                        </button>
                    </div>

                    {hasUnsavedChanges && (
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            現在の設定をテンプレートに保存するには、先に「必要人数を保存」してください。
                        </p>
                    )}
                </div>
            </section>

            <Modal
                isOpen={!!nameDialog}
                onClose={() => !isProcessing && setNameDialog(null)}
                aria-label={nameDialog?.mode === 'create' ? 'テンプレートを保存' : 'テンプレート名を変更'}
            >
                <form
                    onSubmit={event => {
                        event.preventDefault();
                        void handleNameSubmit();
                    }}
                    className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-2xl"
                >
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {nameDialog?.mode === 'create' ? 'テンプレートを保存' : 'テンプレート名を変更'}
                    </h3>
                    <label htmlFor="requirement-template-name" className="block mt-5 mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                        テンプレート名
                    </label>
                    <input
                        id="requirement-template-name"
                        value={nameDialog?.name ?? ''}
                        onChange={event => setNameDialog(current => current ? { ...current, name: event.target.value } : null)}
                        maxLength={50}
                        autoComplete="off"
                        placeholder="例：夏休み"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setNameDialog(null)}
                            disabled={isProcessing}
                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={!nameDialog?.name.trim() || isProcessing}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
                        >
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                            {nameDialog?.mode === 'create' ? '保存' : '変更'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={confirmAction === 'apply'}
                title="テンプレートの呼び出し"
                message={
                    hasUnsavedChanges
                        ? `未保存の変更は破棄されます。テンプレート「${selectedTemplate?.name ?? ''}」で全クラスの必要人数設定を置き換えますか？`
                        : `テンプレート「${selectedTemplate?.name ?? ''}」で全クラスの必要人数設定を置き換えますか？`
                }
                confirmLabel="呼び出す"
                onConfirm={() => void handleConfirm()}
                onCancel={() => setConfirmAction(null)}
                isLoading={isProcessing}
                variant="info"
            />

            <ConfirmModal
                isOpen={confirmAction === 'overwrite'}
                title="テンプレートの上書き"
                message={`テンプレート「${selectedTemplate?.name ?? ''}」を現在の全クラス設定で上書きしますか？`}
                confirmLabel="上書きする"
                onConfirm={() => void handleConfirm()}
                onCancel={() => setConfirmAction(null)}
                isLoading={isProcessing}
                variant="info"
            />

            <ConfirmModal
                isOpen={confirmAction === 'delete'}
                title="テンプレートの削除"
                message={`テンプレート「${selectedTemplate?.name ?? ''}」を削除します。この操作は取り消せません。`}
                confirmLabel="削除する"
                onConfirm={() => void handleConfirm()}
                onCancel={() => setConfirmAction(null)}
                isLoading={isProcessing}
                variant="danger"
            />
        </>
    );
};

export default RequirementTemplateManager;

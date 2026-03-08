import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Clock, Loader2 } from 'lucide-react';
import { createTimePattern, deleteTimePattern, updateTimePattern } from '../../../lib/api';
import type { ShiftTimePattern } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';

interface TimePatternsSettingsProps {
    patterns: ShiftTimePattern[];
    loading: boolean;
    onUpdate: () => void;
    showMessage: (msg: string) => void;
}

const TimePatternsSettings = ({ patterns, loading, onUpdate, showMessage }: TimePatternsSettingsProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', startTime: '09:00', endTime: '18:00' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingId) {
                await updateTimePattern(editingId, formData);
                showMessage('パターンを更新しました');
            } else {
                await createTimePattern(formData);
                showMessage('パターンを追加しました');
            }
            cancelEdit();
            onUpdate();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (pattern: ShiftTimePattern) => {
        setEditingId(pattern.id);
        setFormData({
            name: pattern.name,
            startTime: pattern.startTime,
            endTime: pattern.endTime
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({ name: '', startTime: '09:00', endTime: '18:00' });
    };

    const handleDeletePattern = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await deleteTimePattern(deleteConfirmId);
            setDeleteConfirmId(null);
            showMessage('パターンを削除しました');
            onUpdate();
        } catch (err) {
            console.error(err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Pattern form */}
            <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border ${editingId ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700'} shadow-sm transition-all`}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">
                        {editingId ? 'パターンの編集' : '新規作成'}
                    </h4>
                    {editingId && (
                        <button
                            onClick={cancelEdit}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center space-x-1"
                        >
                            <X className="w-3 h-3" />
                            <span>キャンセル</span>
                        </button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">パターン名 (必須)</label>
                        <input
                            type="text"
                            required
                            placeholder="例: 早番, 遅番, Aシフト..."
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">開始時間</label>
                        <input
                            type="time"
                            required
                            value={formData.startTime}
                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">終了時間</label>
                        <input
                            type="time"
                            required
                            value={formData.endTime}
                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                        />
                    </div>
                    <button
                        disabled={isSubmitting}
                        className={`${editingId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all h-[38px] flex items-center justify-center space-x-2 sm:col-span-4 md:col-span-1 md:col-start-4 mt-2 md:mt-0 w-full disabled:opacity-50`}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                        <span>{isSubmitting ? (editingId ? '更新中...' : '追加中...') : (editingId ? '更新' : '追加')}</span>
                    </button>
                </form>
            </div>

            {/* Patterns list */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">登録済みパターン</h4>
                    <span className="text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{patterns.length}件</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : patterns.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">パターンが登録されていません。</div>
                    ) : (
                        patterns.map(p => (
                            <div key={p.id} className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all group ${editingId === p.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm border border-indigo-100 dark:border-indigo-800">
                                        {p.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.name}</p>
                                            {editingId === p.id && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">編集中...</span>}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                                            <Clock className="w-3 h-3" />
                                            <span>{p.startTime} 〜 {p.endTime}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={() => handleEditClick(p)}
                                        className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="編集"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmId(p.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="削除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="パターンの削除"
                message="この勤務時間パターンを削除しますか？"
                confirmLabel="削除する"
                cancelLabel="キャンセル"
                onConfirm={handleDeletePattern}
                onCancel={() => setDeleteConfirmId(null)}
                isLoading={isDeleting}
                variant="danger"
            />
        </div>
    );
};

export default TimePatternsSettings;

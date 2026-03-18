import React from 'react';
import { X, Clock, Loader2, UserCheck, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DynamicRole } from '../../../types';

interface TimePatternEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    roles: DynamicRole[];
    isSubmitting: boolean;
}

const DAYS = [
    { key: 'sun', label: '日' },
    { key: 'mon', label: '月' },
    { key: 'tue', label: '火' },
    { key: 'wed', label: '水' },
    { key: 'thu', label: '木' },
    { key: 'fri', label: '金' },
    { key: 'sat', label: '土' },
    { key: 'holiday', label: '祝' },
];

const TimePatternEditModal = ({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    roles,
    isSubmitting
}: TimePatternEditModalProps) => {
    const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = React.useState(false);

    if (!isOpen) return null;

    const handleBackdropMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setMouseDownOnBackdrop(true);
        }
    };

    const handleBackdropMouseUp = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && mouseDownOnBackdrop) {
            onClose();
        }
        setMouseDownOnBackdrop(false);
    };

    const toggleRole = (roleId: string) => {
        setFormData((prev: any) => ({
            ...prev,
            roleIds: prev.roleIds.includes(roleId)
                ? prev.roleIds.filter((id: string) => id !== roleId)
                : [...prev.roleIds, roleId]
        }));
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] overflow-y-auto"
            onMouseDown={handleBackdropMouseDown}
            onMouseUp={handleBackdropMouseUp}
        >
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/30">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                        勤務パターンの編集
                    </h3>
                    <button onClick={onClose} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-8 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                    パターン名称 <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例: 早番, 遅番, 9時間拘束..."
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-5 py-3.5 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">開始時間</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="time"
                                            required
                                            value={formData.startTime}
                                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full pl-11 pr-4 py-3.5 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-mono text-slate-700 dark:text-white outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">終了時間</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="time"
                                            required
                                            value={formData.endTime}
                                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full pl-11 pr-4 py-3.5 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-mono text-slate-700 dark:text-white outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                                    <UserCheck className="w-3.5 h-3.5 mr-2" />
                                    連動する役職
                                </label>
                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl min-h-[56px]">
                                    {roles.length === 0 ? (
                                        <span className="text-xs text-slate-400 italic">役職がありません</span>
                                    ) : roles.map(r => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => toggleRole(r.id)}
                                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${formData.roleIds.includes(r.id)
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'
                                                }`}
                                        >
                                            {r.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                                    <Calendar className="w-3.5 h-3.5 mr-2" />
                                    有効な曜日・属性
                                </label>
                                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                                    {DAYS.map(d => (
                                        <button
                                            key={d.key}
                                            type="button"
                                            onClick={() => setFormData((prev: any) => ({ ...prev, [d.key]: prev[d.key] === 1 ? 0 : 1 }))}
                                            className={`h-14 rounded-2xl flex flex-col items-center justify-center transition-all border ${formData[d.key] === 1
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/20'
                                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-300 hover:border-slate-300'
                                                }`}
                                        >
                                            <span className="text-[11px] font-black uppercase">{d.label}</span>
                                            {formData[d.key] === 1 ? <CheckCircle2 className="w-3.5 h-3.5 mt-1" /> : <AlertCircle className="w-3.5 h-3.5 mt-1 opacity-20" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex space-x-4 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] px-6 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none transition-all font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>更新中...</span>
                                </>
                            ) : (
                                <span>パターンの更新を保存</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TimePatternEditModal;

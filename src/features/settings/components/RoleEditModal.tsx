import React from 'react';
import { X, Loader2, CheckCircle, Target, Calendar } from 'lucide-react';
import type { ShiftTimePattern } from '../../../types';

interface RoleEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    formData: {
        name: string;
        hoursTarget: number | null;
        weeklyHoursTarget: number | null;
        patternIds: string[];
        order: number;
    };
    setFormData: React.Dispatch<React.SetStateAction<{
        name: string;
        hoursTarget: number | null;
        weeklyHoursTarget: number | null;
        patternIds: string[];
        order: number;
    }>>;
    timePatterns: ShiftTimePattern[];
    isSubmitting: boolean;
}

const RoleEditModal = ({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    timePatterns,
    isSubmitting
}: RoleEditModalProps) => {
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

    const togglePattern = (patternId: string) => {
        setFormData(prev => ({
            ...prev,
            patternIds: prev.patternIds.includes(patternId)
                ? prev.patternIds.filter(id => id !== patternId)
                : [...prev.patternIds, patternId]
        }));
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] overflow-y-auto"
            onMouseDown={handleBackdropMouseDown}
            onMouseUp={handleBackdropMouseUp}
        >
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/30">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                        スタッフ区分の編集
                    </h3>
                    <button onClick={onClose} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-8 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                        スタッフ区分名 <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="例: 正社員, パート..."
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-5 py-3.5 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white outline-none transition-all"
                                    />
                                </div>
                                <div className="col-span-1 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                        表示順
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.order}
                                        onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                                        className="w-full px-5 py-3.5 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white outline-none transition-all text-center"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between pl-1">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center">
                                        <Target className="w-3.5 h-3.5 mr-2" />
                                        月間労働時間 (目安)
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.hoursTarget !== null}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, hoursTarget: e.target.checked ? 160 : null });
                                                }}
                                            />
                                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        value={formData.hoursTarget === null ? '' : formData.hoursTarget}
                                        disabled={formData.hoursTarget === null}
                                        onChange={e => setFormData({ ...formData, hoursTarget: parseInt(e.target.value) || 0 })}
                                        placeholder="設定なし"
                                        className={`flex-1 px-5 py-3 border rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold ${formData.hoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                                    />
                                    <span className="text-xs text-slate-500 font-bold">時間</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between pl-1">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center">
                                        <Target className="w-3.5 h-3.5 mr-2" />
                                        週間労働時間 (目安)
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.weeklyHoursTarget !== null}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, weeklyHoursTarget: e.target.checked ? 40 : null });
                                                }}
                                            />
                                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        value={formData.weeklyHoursTarget === null ? '' : formData.weeklyHoursTarget}
                                        disabled={formData.weeklyHoursTarget === null}
                                        onChange={e => setFormData({ ...formData, weeklyHoursTarget: parseInt(e.target.value) || 0 })}
                                        placeholder="設定なし"
                                        className={`flex-1 px-5 py-3 border rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold ${formData.weeklyHoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                                    />
                                    <span className="text-xs text-slate-500 font-bold">時間</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                                <Calendar className="w-3.5 h-3.5 mr-2" />
                                利用可能な時間パターン
                            </label>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 min-h-[200px] flex flex-wrap gap-2 content-start">
                                {timePatterns.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">パターンがありません</p>
                                ) : (
                                    timePatterns.map(p => {
                                        const isSelected = formData.patternIds.includes(p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => togglePattern(p.id)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-2 ${isSelected
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                                                <span>{p.name}</span>
                                            </button>
                                        );
                                    })
                                )}
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
                                <span>保存</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoleEditModal;

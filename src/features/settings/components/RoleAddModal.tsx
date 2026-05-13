import { Loader2, Target, Calendar, CheckCircle, X } from 'lucide-react';
import type { ShiftTimePattern } from '../../../types';

interface NewRoleForm {
    name: string;
    hoursTarget: number | null;
    weeklyHoursTarget: number | null;
    patternIds: string[];
}

interface RoleAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    newRole: NewRoleForm;
    setNewRole: React.Dispatch<React.SetStateAction<NewRoleForm>>;
    timePatterns: ShiftTimePattern[];
    isSubmitting: boolean;
}

const RoleAddModal = ({ isOpen, onClose, onSubmit, newRole, setNewRole, timePatterns, isSubmitting }: RoleAddModalProps) => {
    if (!isOpen) return null;

    return (
        <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/30">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                        新しいスタッフ区分
                    </h3>
                    <button onClick={onClose} aria-label="閉じる" className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-8 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="new-role-name" className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                    スタッフ区分名 <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    id="new-role-name"
                                    type="text"
                                    required
                                    placeholder="例: 正社員, パート, リーダー..."
                                    value={newRole.name}
                                    onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                    className="w-full px-5 py-3.5 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center">
                                        <Target className="w-3.5 h-3.5 mr-2" />
                                        月間労働時間 (目安)
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-bold text-slate-500">{newRole.hoursTarget === null ? '制限なし' : '設定する'}</span>
                                        <label aria-label="月間労働時間を設定する" className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={newRole.hoursTarget !== null}
                                                onChange={(e) => setNewRole({ ...newRole, hoursTarget: e.target.checked ? 160 : null })}
                                            />
                                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        value={newRole.hoursTarget === null ? '' : newRole.hoursTarget}
                                        disabled={newRole.hoursTarget === null}
                                        onChange={e => setNewRole({ ...newRole, hoursTarget: parseInt(e.target.value) || 0 })}
                                        placeholder="設定なし"
                                        className={`flex-1 px-5 py-3.5 border rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold ${newRole.hoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                                    />
                                    <span className="text-xs text-slate-500 font-bold">時間</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center">
                                        <Calendar className="w-3.5 h-3.5 mr-2" />
                                        週間労働時間 (目安)
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-bold text-slate-500">{newRole.weeklyHoursTarget === null ? '制限なし' : '設定する'}</span>
                                        <label aria-label="週間労働時間を設定する" className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={newRole.weeklyHoursTarget !== null}
                                                onChange={(e) => setNewRole({ ...newRole, weeklyHoursTarget: e.target.checked ? 40 : null })}
                                            />
                                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        value={newRole.weeklyHoursTarget === null ? '' : newRole.weeklyHoursTarget}
                                        disabled={newRole.weeklyHoursTarget === null}
                                        onChange={e => setNewRole({ ...newRole, weeklyHoursTarget: parseInt(e.target.value) || 0 })}
                                        placeholder="設定なし"
                                        className={`flex-1 px-5 py-3.5 border rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold ${newRole.weeklyHoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                                    />
                                    <span className="text-xs text-slate-500 font-bold">時間</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                    利用可能な時間パターン
                                </p>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 min-h-[200px]">
                                    <div className="flex flex-wrap gap-2">
                                        {timePatterns.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">まずは勤務パターンを登録してください</p>
                                        ) : (
                                            timePatterns.map(p => {
                                                const isSelected = newRole.patternIds.includes(p.id);
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const nextIds = isSelected
                                                                ? newRole.patternIds.filter(id => id !== p.id)
                                                                : [...newRole.patternIds, p.id];
                                                            setNewRole({ ...newRole, patternIds: nextIds });
                                                        }}
                                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                                    >
                                                        {isSelected && <CheckCircle className="w-3 h-3" />}
                                                        <span>{p.name}</span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 min-w-0 px-4 py-4 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] min-w-0 px-4 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none transition-all font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                                    <span>登録中...</span>
                                </>
                            ) : (
                                <span>スタッフ区分を登録</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoleAddModal;

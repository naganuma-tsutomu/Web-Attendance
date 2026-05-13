import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X, Edit2, CheckCircle2, CalendarX, Clock, BookOpen } from 'lucide-react';
import type { Staff } from '../../../types';
import type { DayStatus } from '../types';

interface DateEditModalProps {
    editingDateIndex: number;
    preferences: DayStatus[];
    selectedStaff: Staff | undefined;
    isEditingModalMode: boolean;
    setIsEditingModalMode: (v: boolean) => void;
    editStartTime: string;
    editEndTime: string;
    setEditStartTime: (v: string) => void;
    setEditEndTime: (v: string) => void;
    applyDatePreference: (type: 'full' | 'partial' | 'clear' | 'training') => void;
    setEditingDateIndex: (v: number | null) => void;
}

const DateEditModal = ({
    editingDateIndex,
    preferences,
    selectedStaff,
    isEditingModalMode,
    setIsEditingModalMode,
    editStartTime,
    editEndTime,
    setEditStartTime,
    setEditEndTime,
    applyDatePreference,
    setEditingDateIndex,
}: DateEditModalProps) => {
    const day = preferences[editingDateIndex];
    if (!day) return null;

    const status = day.status;
    const isTraining = day.type === 'training';
    const isPartial = status === 'unavailable' && !!day.startTime && !isTraining;

    return (
        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 id="date-edit-title" className="text-base font-black text-slate-800 dark:text-white">
                    {format(new Date(day.dateStr), 'M月d日 (E)', { locale: ja })}
                    <span className="text-sm font-medium text-slate-400 ml-2">{selectedStaff?.name}</span>
                </h3>
                <button
                    onClick={() => setEditingDateIndex(null)}
                    aria-label="閉じる"
                    className="bg-white dark:bg-slate-700 p-1.5 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {!isEditingModalMode ? (
                /* 現在の状態表示 */
                <div className="px-5 py-5 flex flex-col items-center">
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] mb-4 uppercase">Current Status</div>

                    {status === 'available' && (
                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mb-3 shadow-[0_0_2rem_-0.5rem_#10b981] dark:shadow-none ring-4 ring-emerald-50 dark:ring-emerald-900/10">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <div className="text-xl font-black text-slate-800 dark:text-white tracking-wide">就業可能</div>
                            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">シフトに入ることができます</p>
                        </div>
                    )}

                    {isTraining && (
                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center mb-3 shadow-[0_0_2rem_-0.5rem_#fbbf24] dark:shadow-none ring-4 ring-amber-50 dark:ring-amber-900/10">
                                <BookOpen className="w-7 h-7" />
                            </div>
                            <div className="text-xl font-black text-slate-800 dark:text-white tracking-wide">研修</div>
                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-1">1日研修のためシフトに入りません</p>
                        </div>
                    )}

                    {status === 'unavailable' && !isPartial && !isTraining && (
                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-3 shadow-[0_0_2rem_-0.5rem_#ef4444] dark:shadow-none ring-4 ring-red-50 dark:ring-red-900/10">
                                <CalendarX className="w-7 h-7" />
                            </div>
                            <div className="text-xl font-black text-slate-800 dark:text-white tracking-wide">終日不可</div>
                            <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1">1日を通してシフトに入れません</p>
                        </div>
                    )}

                    {isPartial && (
                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-3 shadow-[0_0_2rem_-0.5rem_#ef4444] dark:shadow-none ring-4 ring-red-50 dark:ring-red-900/10">
                                <Clock className="w-7 h-7" />
                            </div>
                            <div className="text-xl font-black text-slate-800 dark:text-white tracking-wide mb-2">一部不可</div>
                            <div className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-4 py-2 rounded-2xl font-bold flex items-center gap-2">
                                <span className="font-mono">{day.startTime}</span>
                                <span className="text-red-400">〜</span>
                                <span className="font-mono">{day.endTime}</span>
                            </div>
                        </div>
                    )}

                    <div className="w-full mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <button
                            onClick={() => setIsEditingModalMode(true)}
                            className="w-full flex items-center justify-center gap-2.5 px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all border border-transparent hover:border-slate-300 dark:hover:border-slate-600 shadow-sm"
                        >
                            <Edit2 className="w-4 h-4" />
                            <span>設定を変更する</span>
                        </button>
                    </div>
                </div>
            ) : (
                /* 編集モード */
                <div className="p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <button
                        onClick={() => applyDatePreference('full')}
                        className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-bold rounded-2xl transition-colors border border-red-200 dark:border-red-800/50 flex items-center justify-center gap-2"
                    >
                        <span>終日不可</span>
                        <span className="text-xs font-medium opacity-70">1日中シフトに入れない</span>
                    </button>

                    <button
                        onClick={() => applyDatePreference('training')}
                        className="w-full px-4 py-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold rounded-2xl transition-colors border border-amber-200 dark:border-amber-800/50 flex items-center justify-center gap-2"
                    >
                        <span>研修</span>
                        <span className="text-xs font-medium opacity-70">1日研修のためシフトに入れない</span>
                    </button>

                    <div className="p-3 bg-indigo-50 hover:bg-indigo-100/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl transition-colors">
                        <div className="text-center font-bold text-indigo-700 dark:text-indigo-400 mb-2 text-sm">一部の時間だけ不可</div>
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-3">
                            <input
                                type="time"
                                value={editStartTime}
                                onChange={e => setEditStartTime(e.target.value)}
                                className="flex-1 min-w-0 px-2 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-base text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <span className="font-bold text-slate-400 text-xs shrink-0">〜</span>
                            <input
                                type="time"
                                value={editEndTime}
                                onChange={e => setEditEndTime(e.target.value)}
                                className="flex-1 min-w-0 px-2 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-base text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => applyDatePreference('partial')}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                        >
                            この時間帯を不可にする
                        </button>
                    </div>

                    <button
                        onClick={() => applyDatePreference('clear')}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                    >
                        就業可能（クリア）
                    </button>

                    <button
                        onClick={() => setIsEditingModalMode(false)}
                        className="w-full py-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-semibold"
                    >
                        キャンセル
                    </button>
                </div>
            )}
        </div>
    );
};

export default DateEditModal;

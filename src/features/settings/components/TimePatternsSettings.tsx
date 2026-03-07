import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Loader2 } from 'lucide-react';
import { createTimePattern, deleteTimePattern } from '../../../../lib/api';
import type { ShiftTimePattern } from '../../../../types';

interface TimePatternsSettingsProps {
    patterns: ShiftTimePattern[];
    loading: boolean;
    onUpdate: () => void;
    showMessage: (msg: string) => void;
}

const TimePatternsSettings = ({ patterns, loading, onUpdate, showMessage }: TimePatternsSettingsProps) => {
    const [newPattern, setNewPattern] = useState({ name: '', startTime: '09:00', endTime: '18:00' });

    const handleAddPattern = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createTimePattern(newPattern);
            setNewPattern({ name: '', startTime: '09:00', endTime: '18:00' });
            showMessage('パターンを追加しました');
            onUpdate();
        } catch (err) { console.error(err); }
    };

    const handleDeletePattern = async (id: string) => {
        if (!confirm('このパターンを削除しますか？')) return;
        try {
            await deleteTimePattern(id);
            onUpdate();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <span>勤務時間パターン設定</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    シフト作成時に選択可能な勤務時間帯を定義します。
                </p>
            </div>

            {/* Pattern form */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 text-sm uppercase tracking-wide">新規作成</h4>
                <form onSubmit={handleAddPattern} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">パターン名 (必須)</label>
                        <input
                            type="text"
                            required
                            placeholder="例: 早番, 遅番, Aシフト..."
                            value={newPattern.name}
                            onChange={e => setNewPattern({ ...newPattern, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">開始時間</label>
                        <input
                            type="time"
                            required
                            value={newPattern.startTime}
                            onChange={e => setNewPattern({ ...newPattern, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">終了時間</label>
                        <input
                            type="time"
                            required
                            value={newPattern.endTime}
                            onChange={e => setNewPattern({ ...newPattern, endTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                        />
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all h-[38px] flex items-center justify-center space-x-2 sm:col-span-4 md:col-span-1 md:col-start-4 mt-2 md:mt-0 w-full">
                        <Plus className="w-4 h-4" />
                        <span>追加</span>
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
                            <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all group">
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm border border-indigo-100 dark:border-indigo-800">
                                        {p.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                                            <Clock className="w-3 h-3" />
                                            <span>{p.startTime} 〜 {p.endTime}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeletePattern(p.id)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="削除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimePatternsSettings;

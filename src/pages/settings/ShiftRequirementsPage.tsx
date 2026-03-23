import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { getClasses, getShiftRequirements, saveShiftRequirements } from '../../lib/api';
import type { ShiftClass, ShiftRequirement } from '../../types';

// 曜日パターンの選択肢
const dayOfWeekOptions = [
    { value: 7, label: '平日（月〜金）' },
    { value: 1, label: '月曜日' },
    { value: 2, label: '火曜日' },
    { value: 3, label: '水曜日' },
    { value: 4, label: '木曜日' },
    { value: 5, label: '金曜日' },
    { value: 6, label: '土曜日' },
    { value: 0, label: '日曜日' },
];

// 優先度の選択肢
const priorityOptions = [
    { value: 1, label: '低', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700' },
    { value: 2, label: '中低', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' },
    { value: 3, label: '中', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30' },
    { value: 4, label: '中高', color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30' },
    { value: 5, label: '高', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' },
];

// 新規要件の初期値を生成
const createEmptyRequirement = (): ShiftRequirement => ({
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    classId: '',
    dayOfWeek: 7,
    startTime: '09:00',
    endTime: '18:00',
    minStaffCount: 1,
    priority: 3,
});

const ShiftRequirementsPage = () => {
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [requirements, setRequirements] = useState<ShiftRequirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [selectedClass, setSelectedClass] = useState<string>('');

    // 初期データ読み込み
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setLoadingError(null);
            try {
                // クラス一覧を取得
                const classesData = await getClasses();
                setClasses(classesData);

                // 必要人数設定を取得
                const requirementsData = await getShiftRequirements();
                setRequirements(requirementsData);

                // 最初のクラスを選択状態に
                if (classesData.length > 0) {
                    setSelectedClass(classesData[0].id);
                }
            } catch (err) {
                console.error('Failed to load data', err);
                setLoadingError('データの読み込みに失敗しました。');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // データ再読み込み
    const handleRetry = () => {
        const fetchData = async () => {
            setLoading(true);
            setLoadingError(null);
            try {
                const classesData = await getClasses();
                setClasses(classesData);
                const requirementsData = await getShiftRequirements();
                setRequirements(requirementsData);
                if (classesData.length > 0) {
                    setSelectedClass(classesData[0].id);
                }
            } catch (err) {
                console.error('Failed to load data', err);
                setLoadingError('データの読み込みに失敗しました。');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    };

    // メッセージ表示（自動非表示）
    const showMessage = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    // エラー表示（自動非表示）
    const showError = (msg: string) => {
        setError(msg);
        setTimeout(() => setError(''), 5000);
    };

    // 新しいタイムスロットを追加
    const addTimeSlot = () => {
        if (!selectedClass) {
            showError('クラスを選択してください');
            return;
        }

        const newRequirement = createEmptyRequirement();
        newRequirement.classId = selectedClass;
        setRequirements([...requirements, newRequirement]);
    };

    // タイムスロットを削除
    const deleteTimeSlot = (id: string) => {
        setRequirements(requirements.filter(r => r.id !== id));
    };

    // 要件を更新
    const updateRequirement = (id: string, updates: Partial<ShiftRequirement>) => {
        setRequirements(requirements.map(r => 
            r.id === id ? { ...r, ...updates } : r
        ));
    };

    // 時間の重複チェック
    const hasOverlappingSlots = (): boolean => {
        const sorted = [...requirements].sort((a, b) => {
            if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
            return a.startTime.localeCompare(b.startTime);
        });

        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            // 同じ曜日パターンで重複チェック
            if (current.classId === next.classId && current.dayOfWeek === next.dayOfWeek) {
                if (current.endTime > next.startTime && current.startTime < next.endTime) {
                    return true;
                }
            }
        }
        return false;
    };

    // 保存処理
    const handleSave = async () => {
        // バリデーション
        const invalidRequirements = requirements.filter(r => 
            !r.classId || !r.startTime || !r.endTime || r.minStaffCount < 1
        );

        if (invalidRequirements.length > 0) {
            showError('未入力の項目があります');
            return;
        }

        // 時間の妥当性チェック
        const invalidTimeRanges = requirements.filter(r => r.startTime >= r.endTime);
        if (invalidTimeRanges.length > 0) {
            showError('終了時間は開始時間より後に設定してください');
            return;
        }

        // 重複チェック
        if (hasOverlappingSlots()) {
            showError('時間帯が重複しています');
            return;
        }

        setSaving(true);
        setError('');
        try {
            await saveShiftRequirements(requirements);
            showMessage('保存しました');
        } catch (err) {
            console.error('Failed to save', err);
            showError('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    // フィルタリングされた要件を取得
    const filteredRequirements = selectedClass
        ? requirements.filter(r => r.classId === selectedClass)
        : [];

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 md:p-8 flex items-center justify-center">
                <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="font-medium">読み込み中...</span>
                </div>
            </div>
        );
    }

    if (loadingError) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 md:p-8 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 flex flex-col items-center animate-in fade-in">
                        <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-3" />
                        <p className="text-red-800 dark:text-red-300 font-medium mb-4">{loadingError}</p>
                        <button
                            onClick={handleRetry}
                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                        >
                            <Loader2 className="w-4 h-4" />
                            再試行
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center space-x-3 mb-6">
                    <Users className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">必要人数設定</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            クラスと時間帯ごとの必要スタッフ数を設定します。
                        </p>
                    </div>
                </div>

                {/* Toast Messages */}
                {message && (
                    <div className="fixed top-20 right-4 z-50 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-right-4 shadow-lg">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{message}</span>
                    </div>
                )}

                {error && (
                    <div className="fixed top-20 right-4 z-50 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-right-4 shadow-lg">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {/* Class Selector */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        クラスを選択
                    </label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    >
                        <option value="">クラスを選択してください</option>
                        {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Time Slots List */}
                {selectedClass && <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                            時間帯設定
                        </h3>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {filteredRequirements.length} 件の設定
                        </span>
                    </div>

                    {filteredRequirements.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>時間帯の設定がありません</p>
                            <p className="text-sm mt-1">「時間帯を追加」ボタンから設定を追加してください</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredRequirements.map((req, index) => (
                                <div 
                                    key={req.id} 
                                    className="p-4 md:p-6 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* 連番 */}
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-semibold">
                                            {index + 1}
                                        </div>

                                        {/* 曜日パターン */}
                                        <div className="flex-shrink-0 w-full lg:w-44">
                                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 lg:hidden">
                                                曜日パターン
                                            </label>
                                            <select
                                                value={req.dayOfWeek}
                                                onChange={(e) => updateRequirement(req.id, { dayOfWeek: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            >
                                                {dayOfWeekOptions.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 時間範囲 */}
                                        <div className="flex items-center gap-2 flex-1">
                                            <div className="flex-1">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 lg:hidden">
                                                    開始時間
                                                </label>
                                                <input
                                                    type="time"
                                                    value={req.startTime}
                                                    onChange={(e) => updateRequirement(req.id, { startTime: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                />
                                            </div>
                                            <span className="text-slate-400 hidden sm:block">〜</span>
                                            <div className="flex-1">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 lg:hidden">
                                                    終了時間
                                                </label>
                                                <input
                                                    type="time"
                                                    value={req.endTime}
                                                    onChange={(e) => updateRequirement(req.id, { endTime: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        {/* 必要人数 */}
                                        <div className="w-full sm:w-28">
                                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 lg:hidden">
                                                必要人数
                                            </label>
                                            <div className="flex items-center">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={20}
                                                    value={req.minStaffCount}
                                                    onChange={(e) => updateRequirement(req.id, { minStaffCount: parseInt(e.target.value) || 1 })}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                                                />
                                                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">名</span>
                                            </div>
                                        </div>

                                        {/* 優先度 */}
                                        <div className="w-full sm:w-28">
                                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 lg:hidden">
                                                優先度
                                            </label>
                                            <select
                                                value={req.priority}
                                                onChange={(e) => updateRequirement(req.id, { priority: parseInt(e.target.value) })}
                                                className={`w-full px-3 py-2 rounded-lg border-0 text-sm font-medium text-center cursor-pointer ${
                                                    priorityOptions.find(p => p.value === req.priority)?.color || priorityOptions[2].color
                                                }`}
                                            >
                                                {priorityOptions.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 削除ボタン */}
                                        <button
                                            onClick={() => deleteTimeSlot(req.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                                            title="削除"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Button */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <button
                            onClick={addTimeSlot}
                            disabled={!selectedClass}
                            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-transparent"
                        >
                            <Plus className="w-5 h-5" />
                            <span>時間帯を追加</span>
                        </button>
                    </div>
                </div>}

                {/* Save Button */}
                {selectedClass && <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>保存中...</span>
                            </>
                        ) : (
                            <span>保存</span>
                        )}
                    </button>
                </div>}
            </div>
        </div>
    );
};

export default ShiftRequirementsPage;

import { FileSpreadsheet, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useExcelSettings, useUpdateExcelSettings, useStaffList } from '../../../lib/hooks';
import type { ExcelHighlightRule } from '../../../types';

const ExcelSettings = () => {
    const { data: settings, isLoading: isLoadingSettings } = useExcelSettings();
    const { data: staffs = [] } = useStaffList();
    const updateSettingsMutation = useUpdateExcelSettings();

    const [excludeHolidayStaffOnSaturdays, setExcludeHolidayStaffOnSaturdays] = useState(false);
    const [highlightRules, setHighlightRules] = useState<ExcelHighlightRule[]>([]);
    const [modified, setModified] = useState(false);

    useEffect(() => {
        if (settings) {
            setExcludeHolidayStaffOnSaturdays(settings.excludeHolidayStaffOnSaturdays);
            setHighlightRules(settings.highlightRules || []);
            setModified(false);
        }
    }, [settings]);

    const handleToggleSaturdayOff = () => {
        setExcludeHolidayStaffOnSaturdays(!excludeHolidayStaffOnSaturdays);
        setModified(true);
    };

    const addRule = () => {
        const newRule: ExcelHighlightRule = {
            staffId: staffs[0]?.id || '',
            regularStartTime: '16:00',
            regularEndTime: '17:00',
            highlightColor: 'FFFFCCE5', // ピンク
        };
        setHighlightRules([...highlightRules, newRule]);
        setModified(true);
    };

    const updateRule = (index: number, updates: Partial<ExcelHighlightRule>) => {
        const newRules = [...highlightRules];
        newRules[index] = { ...newRules[index], ...updates };
        setHighlightRules(newRules);
        setModified(true);
    };

    const removeRule = (index: number) => {
        setHighlightRules(highlightRules.filter((_, i) => i !== index));
        setModified(true);
    };

    const handleSave = async () => {
        try {
            await updateSettingsMutation.mutateAsync({
                excludeHolidayStaffOnSaturdays,
                highlightRules,
            });
            toast.success('Excel出力設定を保存しました');
            setModified(false);
        } catch (err) {
            toast.error('保存に失敗しました');
        }
    };

    if (isLoadingSettings) {
        return <div className="p-8 text-center text-slate-500">読み込み中...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 土曜日の表示設定 */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-green-600 mt-1" />
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-lg">Excel出力の表示制御</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Excel出力時の特定曜日の表示内容をカスタマイズします。
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-200">土曜日の休日スタッフを非表示にする</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ONにすると、土曜日の行には出勤スタッフのみが表示されます。</p>
                        </div>
                        <button
                            onClick={handleToggleSaturdayOff}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${excludeHolidayStaffOnSaturdays ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${excludeHolidayStaffOnSaturdays ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* スタッフ別ハイライト設定 */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-start justify-between mb-8">
                    <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-indigo-500 mt-1" />
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-lg">スタッフ別シフトハイライト</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                特定のスタッフが通常の勤務時間以外のシフトに入った際、Excel上で色付けします。
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={addRule}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-400 rounded-xl text-sm font-bold transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        ルールを追加
                    </button>
                </div>

                <div className="space-y-4">
                    {highlightRules.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                            <p className="text-sm text-slate-400">ハイライトルールはまだ設定されていません。</p>
                        </div>
                    ) : (
                        highlightRules.map((rule, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-1">
                                <div className="flex-1 w-full sm:w-auto">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 block">スタッフ</label>
                                    <select
                                        value={rule.staffId}
                                        onChange={(e) => updateRule(idx, { staffId: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        {staffs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1 w-full sm:w-auto">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 block">通常の勤務時間</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={rule.regularStartTime}
                                            onChange={(e) => updateRule(idx, { regularStartTime: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <span className="text-slate-400">〜</span>
                                        <input
                                            type="time"
                                            value={rule.regularEndTime}
                                            onChange={(e) => updateRule(idx, { regularEndTime: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="w-full sm:w-24">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 block">背景色</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={`#${rule.highlightColor.slice(2)}`}
                                            onChange={(e) => updateRule(idx, { highlightColor: 'FF' + e.target.value.slice(1).toUpperCase() })}
                                            className="w-10 h-9 p-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                                        />
                                        <div className="sm:hidden text-xs text-slate-500">色を選択</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeRule(idx)}
                                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors sm:mt-5"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed italic">
                        ※ ここで設定された「通常の勤務時間」と **一致しない** シフトが組まれた場合、Excel出力時に該当行が指定した色で塗りつぶされます。
                    </p>
                </div>
            </div>

            {/* 保存ボタン */}
            {modified && (
                <div className="sticky bottom-6 flex justify-end animate-in slide-in-from-bottom-4 pt-4">
                    <button
                        onClick={handleSave}
                        disabled={updateSettingsMutation.isPending}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {updateSettingsMutation.isPending ? '保存中...' : '設定を保存'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExcelSettings;

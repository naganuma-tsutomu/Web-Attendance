import { useState, useEffect } from 'react';
import { Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useExcelSettings, useUpdateExcelSettings, useRoles } from '../../../lib/hooks';

const DutyNumberSection = () => {
    const { data: excelSettingsData } = useExcelSettings();
    const updateExcelSettingsMutation = useUpdateExcelSettings();
    const { data: roles = [] } = useRoles();
    const [showDutyNumbers, setShowDutyNumbers] = useState(false);
    const [leaderRoleId, setLeaderRoleId] = useState<string | null>(null);
    const [dutyModified, setDutyModified] = useState(false);

    useEffect(() => {
        if (excelSettingsData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowDutyNumbers(excelSettingsData.showDutyNumbers ?? false);
            setLeaderRoleId(excelSettingsData.leaderRoleId ?? null);
            setDutyModified(false);
        }
    }, [excelSettingsData]);

    const handleSaveDutySettings = async () => {
        if (!excelSettingsData) return;
        try {
            await updateExcelSettingsMutation.mutateAsync({
                ...excelSettingsData,
                showDutyNumbers,
                leaderRoleId,
            });
            toast.success('当番番号設定を保存しました');
            setDutyModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <Hash className="w-5 h-5 text-indigo-500" />
                <div>
                    <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">当番番号</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">シフト作成画面とExcel出力に番号カラムを表示します。</p>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">番号カラムを表示する</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">シフト作成画面とExcel出力の両方に当番番号（1, 2, 3...）の列を表示します。</p>
                    </div>
                    <button
                        onClick={() => { setShowDutyNumbers(v => !v); setDutyModified(true); }}
                        role="switch"
                        aria-checked={showDutyNumbers}
                        aria-label="当番番号カラムを表示する"
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${showDutyNumbers ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showDutyNumbers ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">1番を特定区分のみで回す</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">選択した区分のスタッフのみでリーダー番号（1番）をローテーションします。「制限なし」の場合は全スタッフ対象です。</p>
                    </div>
                    <select
                        value={leaderRoleId ?? ''}
                        onChange={e => { setLeaderRoleId(e.target.value || null); setDutyModified(true); }}
                        className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">制限なし</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            {dutyModified && (
                <div className="flex justify-end mt-6 animate-in slide-in-from-bottom-2">
                    <button
                        onClick={handleSaveDutySettings}
                        disabled={updateExcelSettingsMutation.isPending}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {updateExcelSettingsMutation.isPending ? '保存中...' : '当番番号設定を保存'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DutyNumberSection;

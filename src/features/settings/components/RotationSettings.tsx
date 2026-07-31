import { RefreshCw, Users, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRotationSettings, useUpdateRotationSettings, useRoles, useTimePatterns } from '../../../lib/hooks';
import type { RotationSettings as RotationSettingsType } from '../../../types';

const DEFAULT_SETTINGS: RotationSettingsType = {
    enabled: false,
    roleId: '',
    earlyPatternId: '',
    latePatternId: '',
    weekdayEarlyCount: 1,
    weekdayLateCount: 2,
    saturdayEnabled: true,
    saturdayCount: 1,
    saturdayPreferFridayLate: true,
    saturdayPatternId: '',
};

const RotationSettings = () => {
    const { data: savedSettings, isLoading } = useRotationSettings();
    const { data: roles = [] } = useRoles();
    const { data: timePatterns = [] } = useTimePatterns();
    const updateMutation = useUpdateRotationSettings();

    const [settings, setSettings] = useState<RotationSettingsType>(DEFAULT_SETTINGS);
    const [modified, setModified] = useState(false);

    useEffect(() => {
        if (savedSettings) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSettings(savedSettings);
            setModified(false);
        }
    }, [savedSettings]);

    const update = (partial: Partial<RotationSettingsType>) => {
        setSettings(prev => ({ ...prev, ...partial }));
        setModified(true);
    };

    const handleSave = async () => {
        if (settings.enabled) {
            if (!settings.roleId || !settings.earlyPatternId || !settings.latePatternId) {
                toast.error('有効化するには全ての項目を設定してください');
                return;
            }
            if (settings.earlyPatternId === settings.latePatternId) {
                toast.error('早番と遅番には異なるパターンを選択してください');
                return;
            }
            if (settings.saturdayEnabled && !settings.saturdayPatternId) {
                toast.error('土曜日が有効な場合、土曜日のパターンを選択してください');
                return;
            }
        }
        try {
            await updateMutation.mutateAsync(settings);
            toast.success('ローテーション設定を保存しました');
            setModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">読み込み中...</div>;
    }

    const selectedRole = roles.find(r => r.id === settings.roleId);
    const rolePatterns = selectedRole?.patterns || timePatterns;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 有効/無効 */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <RefreshCw className="w-5 h-5 text-indigo-600 shrink-0 mt-1" />
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-lg">ローテーション機能</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                有効にすると、指定したスタッフ区分に対して早番・遅番のローテーションルールが適用されます。
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => update({ enabled: !settings.enabled })}
                        role="switch"
                        aria-checked={settings.enabled}
                        aria-label="ローテーション設定を有効にする"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                            settings.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            </div>

            {settings.enabled && (
                <>
                    {/* 対象ロール・パターン・クラス */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                        <div className="flex gap-3 items-center">
                            <Users className="w-5 h-5 text-indigo-600 shrink-0" />
                            <p className="font-bold text-slate-800 dark:text-white text-lg">基本設定</p>
                        </div>

                        {/* 対象ロール */}
                        <div>
                            <label htmlFor="rotation-role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                対象スタッフ区分
                            </label>
                            <select
                                id="rotation-role"
                                value={settings.roleId}
                                onChange={e => update({ roleId: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2"
                            >
                                <option value="">選択してください</option>
                                {roles.map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* 早番パターン */}
                        <div>
                            <label htmlFor="rotation-early" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                早番パターン
                            </label>
                            <select
                                id="rotation-early"
                                value={settings.earlyPatternId}
                                onChange={e => update({ earlyPatternId: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2"
                            >
                                <option value="">選択してください</option>
                                {rolePatterns.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.startTime}〜{p.endTime})</option>
                                ))}
                            </select>
                        </div>

                        {/* 遅番パターン */}
                        <div>
                            <label htmlFor="rotation-late" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                遅番パターン
                            </label>
                            <select
                                id="rotation-late"
                                value={settings.latePatternId}
                                onChange={e => update({ latePatternId: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2"
                            >
                                <option value="">選択してください</option>
                                {rolePatterns.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.startTime}〜{p.endTime})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 平日体制 */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                        <div className="flex gap-3 items-center">
                            <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
                            <p className="font-bold text-slate-800 dark:text-white text-lg">平日体制（月〜金）</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="rotation-weekday-early" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    早番人数
                                </label>
                                <input
                                    id="rotation-weekday-early"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={settings.weekdayEarlyCount}
                                    onChange={e => update({
                                        weekdayEarlyCount: Math.min(100, Math.max(0, Number.parseInt(e.target.value) || 0))
                                    })}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2"
                                />
                            </div>
                            <div>
                                <label htmlFor="rotation-weekday-late" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    遅番人数
                                </label>
                                <input
                                    id="rotation-weekday-late"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={settings.weekdayLateCount}
                                    onChange={e => update({
                                        weekdayLateCount: Math.min(100, Math.max(0, Number.parseInt(e.target.value) || 0))
                                    })}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2"
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                            <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-indigo-700 dark:text-indigo-300">
                                前日の遅番スタッフが翌日の早番に、前日の早番スタッフが翌日の遅番にローテーションします。
                                休みなどでローテーションが維持できない場合は、累計時間バランスで自動調整されます。
                            </p>
                        </div>
                    </div>

                    {/* 土曜日設定 */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                        <div className="flex items-start justify-between">
                            <div className="flex gap-3 items-center">
                                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="font-bold text-slate-800 dark:text-white text-lg">土曜日設定</p>
                            </div>
                            <button
                                onClick={() => update({ saturdayEnabled: !settings.saturdayEnabled })}
                                role="switch"
                                aria-checked={settings.saturdayEnabled}
                                aria-label="土曜日設定を有効にする"
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                                    settings.saturdayEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    settings.saturdayEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        {settings.saturdayEnabled && (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="rotation-saturday-count" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        土曜日の出勤人数
                                    </label>
                                    <input
                                        id="rotation-saturday-count"
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={settings.saturdayCount}
                                        onChange={e => update({
                                            saturdayCount: Math.min(100, Math.max(0, Number.parseInt(e.target.value) || 0))
                                        })}
                                        className="w-full max-w-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="rotation-saturday-pattern" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        土曜日のパターン
                                    </label>
                                    <select
                                        id="rotation-saturday-pattern"
                                        value={settings.saturdayPatternId ?? ''}
                                        onChange={e => update({ saturdayPatternId: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2"
                                    >
                                        <option value="">選択してください</option>
                                        {rolePatterns.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.startTime}〜{p.endTime})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-start gap-3">
                                    <button
                                        onClick={() => update({ saturdayPreferFridayLate: !settings.saturdayPreferFridayLate })}
                                        role="switch"
                                        aria-checked={settings.saturdayPreferFridayLate}
                                        aria-label="金曜日の遅番を土曜に優先する"
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 mt-0.5 ${
                                            settings.saturdayPreferFridayLate ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            settings.saturdayPreferFridayLate ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                    </button>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            金曜遅番を土曜に優先配置
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            金曜日に遅番だったスタッフを土曜日の出勤に優先的に割り当てます。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 保存ボタン */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={!modified || updateMutation.isPending}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                        modified
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                >
                    {updateMutation.isPending ? '保存中...' : '保存'}
                </button>
            </div>
        </div>
    );
};

export default RotationSettings;

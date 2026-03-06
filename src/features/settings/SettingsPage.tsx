import { useState, useEffect } from 'react';
import { Save, Clock, Loader2, CheckCircle } from 'lucide-react';
import { getRoleSettings, updateRoleSetting } from '../../lib/api';
import type { RoleSetting } from '../../types';

const SettingsPage = () => {
    const [settings, setSettings] = useState<RoleSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const data = await getRoleSettings();
            setSettings(data);
        } catch (err) {
            console.error('Failed to load settings', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleChange = (role: string, field: 'defaultStartTime' | 'defaultEndTime', value: string) => {
        setSettings(prev => prev.map(s => s.role === role ? { ...s, [field]: value } : s));
    };

    const handleSave = async (setting: RoleSetting) => {
        setSaving(true);
        try {
            await updateRoleSetting(setting.role, {
                defaultStartTime: setting.defaultStartTime,
                defaultEndTime: setting.defaultEndTime
            });
            setMessage(`${setting.role}の設定を保存しました。`);
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error(err);
            alert('保存に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">マスター設定</h2>
                <p className="text-slate-500 mt-1">雇用形態ごとの基本シフト時間を設定します。自動作成時にこの時間が使用されます。</p>
            </div>

            {message && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{message}</span>
                </div>
            )}

            <div className="grid gap-6">
                {settings.map((item) => (
                    <div key={item.role} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                        <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                                ${item.role === '正社員' ? 'bg-blue-100 text-blue-600' : ''}
                                ${item.role === '準社員' ? 'bg-indigo-100 text-indigo-600' : ''}
                                ${item.role === 'パート' ? 'bg-emerald-100 text-emerald-600' : ''}
                                ${item.role === '特殊スタッフ' ? 'bg-amber-100 text-amber-600' : ''}
                            `}>
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{item.role}</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Default Shift pattern</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="time"
                                    value={item.defaultStartTime}
                                    onChange={e => handleChange(item.role, 'defaultStartTime', e.target.value)}
                                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-medium"
                                />
                                <span className="text-slate-400">〜</span>
                                <input
                                    type="time"
                                    value={item.defaultEndTime}
                                    onChange={e => handleChange(item.role, 'defaultEndTime', e.target.value)}
                                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-medium"
                                />
                            </div>
                            <button
                                onClick={() => handleSave(item)}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
                            >
                                <Save className="w-4 h-4" />
                                <span>保存</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SettingsPage;

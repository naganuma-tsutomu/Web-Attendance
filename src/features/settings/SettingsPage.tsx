import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Loader2, CheckCircle, Settings2, Moon, Sun } from 'lucide-react';
import { getTimePatterns, createTimePattern, deleteTimePattern, getRoles, createRole, deleteRole, updateRolePatterns, updateRole } from '../../lib/api';
import type { ShiftTimePattern, DynamicRole } from '../../types';

const SettingsPage = () => {
    // State for Time Patterns
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [loadingPatterns, setLoadingPatterns] = useState(true);
    const [newPattern, setNewPattern] = useState({ name: '', startTime: '09:00', endTime: '18:00' });

    // State for Roles
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [newRoleName, setNewRoleName] = useState('');

    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'patterns' | 'roles' | 'appearance'>('patterns');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const fetchData = async () => {
        setLoadingPatterns(true);
        setLoadingRoles(true);
        try {
            const [patternsData, rolesData] = await Promise.all([
                getTimePatterns(),
                getRoles()
            ]);
            setTimePatterns(patternsData);
            setRoles(rolesData);
        } catch (err) {
            console.error('Failed to load settings', err);
        } finally {
            setLoadingPatterns(false);
            setLoadingRoles(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const showMessage = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    // --- Time Pattern Handlers ---
    const handleAddPattern = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createTimePattern(newPattern);
            setNewPattern({ name: '', startTime: '09:00', endTime: '18:00' });
            showMessage('パターンを追加しました');
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleDeletePattern = async (id: string) => {
        if (!confirm('このパターンを削除しますか？')) return;
        try {
            await deleteTimePattern(id);
            fetchData();
        } catch (err) { console.error(err); }
    };

    // --- Role Handlers ---
    const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createRole(newRoleName, 0); // 初期目標時間は0
            setNewRoleName('');
            showMessage('役職を追加しました');
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleUpdateRoleHours = async (roleId: string, hours: number) => {
        try {
            await updateRole(roleId, { targetHours: hours });
            setRoles(prev => prev.map(r => r.id === roleId ? { ...r, targetHours: hours } : r));
            showMessage('目標時間を更新しました');
        } catch (err) { console.error(err); }
    };

    const handleDeleteRole = async (id: string) => {
        if (!confirm('この役職を削除しますか？スタッフの割り当ては解除されませんが、新規選択はできなくなります。')) return;
        try {
            await deleteRole(id);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleTogglePattern = async (roleId: string, patternId: string, currentPatterns: ShiftTimePattern[]) => {
        const isAssigned = currentPatterns.some(p => p.id === patternId);
        const newPatternIds = isAssigned
            ? currentPatterns.filter(p => p.id !== patternId).map(p => p.id)
            : [...currentPatterns.map(p => p.id), patternId];

        try {
            await updateRolePatterns(roleId, newPatternIds);
            // Local update for UI responsiveness
            setRoles(prev => prev.map(r => r.id === roleId ? {
                ...r,
                patterns: isAssigned
                    ? r.patterns.filter(p => p.id !== patternId)
                    : [...r.patterns, timePatterns.find(tp => tp.id === patternId)!]
            } : r));
        } catch (err) { console.error(err); }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                    <Settings2 className="w-7 h-7 text-indigo-500" />
                    <span>設定</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">勤務時間の種類と、役職ごとの利用可能パターンを定義します。</p>
            </div>

            {message && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{message}</span>
                </div>
            )}

            {/* Tab navigation */}
            <div className="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('patterns')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'patterns' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    勤務時間パターン
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'roles' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    役職管理
                </button>
                <button
                    onClick={() => setActiveTab('appearance')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'appearance' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    外観設定
                </button>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {activeTab === 'patterns' ? (
                    <div className="space-y-6">
                        {/* Pattern form */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center space-x-2">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                <span>パターンの新規作成</span>
                            </h3>
                            <form onSubmit={handleAddPattern} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">パターン名 (必須)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="例: 早番"
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
                                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all h-[38px] flex items-center justify-center space-x-2">
                                    <Plus className="w-4 h-4" />
                                    <span>追加</span>
                                </button>
                            </form>
                        </div>

                        {/* Patterns list */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">パターン一覧</h3>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {loadingPatterns ? (
                                    <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                                ) : timePatterns.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">パターンが登録されていません。</div>
                                ) : (
                                    timePatterns.map(p => (
                                        <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold">
                                                    {p.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{p.startTime} 〜 {p.endTime}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeletePattern(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'roles' ? (
                    <div className="space-y-6">
                        {/* Role form */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4">役職の追加</h3>
                            <form onSubmit={handleAddRole} className="flex space-x-3 items-end max-w-md">
                                <div className="space-y-1 flex-1">
                                    <input
                                        type="text"
                                        required
                                        placeholder="例: パートB"
                                        value={newRoleName}
                                        onChange={e => setNewRoleName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                                    />
                                </div>
                                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm h-[38px]">
                                    追加
                                </button>
                            </form>
                        </div>

                        {loadingRoles ? (
                            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {roles.map(role => (
                                    <div key={role.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                                                <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight">{role.name}</h4>
                                            </div>
                                            <button onClick={() => handleDeleteRole(role.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-5 flex-1 space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-widest block pl-1">月間目標時間</label>
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="number"
                                                        value={role.targetHours}
                                                        onChange={(e) => handleUpdateRoleHours(role.id, parseInt(e.target.value) || 0)}
                                                        className="w-24 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white font-bold"
                                                    />
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">時間</span>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest pl-1">可用パターン</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {timePatterns.length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic">まずはパターンを作成してください</p>
                                                    ) : (
                                                        timePatterns.map(p => {
                                                            const isAssigned = role.patterns.some(rp => rp.id === p.id);
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => handleTogglePattern(role.id, p.id, role.patterns)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1.5
                                                                        ${isAssigned
                                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500'}`}
                                                                >
                                                                    {isAssigned && <CheckCircle className="w-3 h-3" />}
                                                                    <span>{p.name} ({p.startTime})</span>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-2xl">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center space-x-2">
                            <Moon className="w-5 h-5 text-indigo-500" />
                            <span>外観設定</span>
                        </h3>

                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">カラーテーマ</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">アプリ全体の配色を切り替えます。</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        <Sun className="w-4 h-4" />
                                        <span>ライト</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'dark' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        <Moon className="w-4 h-4" />
                                        <span>ダーク</span>
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                                    ※ 現時点ではダークモードは一部の画面で正しく表示されない場合があります。順次対応中です。
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;

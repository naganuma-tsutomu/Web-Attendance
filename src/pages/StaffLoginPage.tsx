import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, User, ArrowLeft, ChevronDown } from 'lucide-react';
import { getStaffNameList } from '../lib/api';

const StaffLoginPage = () => {
    const [name, setName] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingStaffs, setFetchingStaffs] = useState(true);
    const [staffList, setStaffList] = useState<{ id: string, name: string }[]>([]);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStaffs = async () => {
            try {
                const list = await getStaffNameList();
                setStaffList(list);
            } catch (err) {
                console.error('Failed to fetch staff list:', err);
                setError('従業員リストの取得に失敗しました');
            } finally {
                setFetchingStaffs(false);
            }
        };
        fetchStaffs();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/staff-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, accessKey }),
            });

            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || 'ログインに失敗しました');
            }

            const staff = await response.json();
            // 簡易的なセッション管理として localStorage を使用
            localStorage.setItem('staff_session', JSON.stringify(staff));
            navigate('/staff/preference');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 shrink-0">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 border border-white dark:border-slate-800 animate-in zoom-in-95 duration-300 relative">
                <button
                    onClick={() => navigate('/')}
                    className="absolute left-8 top-8 p-3 bg-slate-50 dark:bg-slate-950 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl transition-all border border-slate-100 dark:border-slate-800 group cursor-pointer"
                    title="戻る"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </button>

                <div className="text-center space-y-2 mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-2">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">従業員ログイン</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">名前と4桁のアクセスキーを入力してください</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">お名前</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                                <div className="relative">
                                    <select
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        disabled={fetchingStaffs}
                                        className="w-full pl-12 pr-10 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 dark:text-white transition-all appearance-none disabled:opacity-50"
                                    >
                                        <option value="" disabled>{fetchingStaffs ? '読み込み中...' : 'お名前を選択してください'}</option>
                                        {staffList.map(staff => (
                                            <option key={staff.id} value={staff.name}>
                                                {staff.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">アクセスキー</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    required
                                    maxLength={4}
                                    pattern="\d{4}"
                                    value={accessKey}
                                    onChange={e => setAccessKey(e.target.value.replace(/\D/g, ''))}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold tracking-[0.5em] text-slate-700 dark:text-white transition-all"
                                    placeholder="••••"
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold text-center animate-in shake duration-300">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all font-bold uppercase tracking-widest flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>ログイン</span>}
                    </button>
                    
                    <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 font-medium">
                        ※ アクセキーがわからない場合は管理者に確認してください
                    </p>
                </form>
            </div>
        </div>
    );
};

export default StaffLoginPage;

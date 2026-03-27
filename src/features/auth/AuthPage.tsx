import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

const AuthPage = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(password);
        } catch (err: any) {
            setError(err.message || 'ログインに失敗しました。');
        } finally {
            setIsLoading(false);
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
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">管理者ログイン</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">管理者パスワードを入力してください</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">パスワード</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 dark:text-white transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold text-center animate-in shake duration-300">
                            {error}
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all font-bold uppercase tracking-widest flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                            <span>{isLoading ? 'ログイン中...' : 'ログイン'}</span>
                        </button>

                    </div>
                </form>
            </div>
        </div>
    );
};

export default AuthPage;

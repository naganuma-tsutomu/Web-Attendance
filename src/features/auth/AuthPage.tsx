import React, { useState } from 'react';
import { Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

const AuthPage = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(password);
            // On successful login, AuthContext state changes, triggering AuthRoute redirect
        } catch (err: any) {
            setError(err.message || 'ログインに失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            await login('admin'); // デフォルトのパスワードを使用してログイン
        } catch (err: any) {
            setError('テストログインに失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center transform rotate-3 shadow-lg">
                        <span className="text-white text-3xl font-bold">星</span>
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    星空児童館
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    シフト管理システム
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-100 dark:border-slate-700">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                管理者パスワード
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 dark:border-slate-600 rounded-md py-3 bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
                                    placeholder="システムパスワードを入力"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4 border border-red-100 dark:border-red-800">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{error}</h3>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <LogIn className="w-5 h-5 mr-2" />
                                )}
                                {isLoading ? 'ログイン中...' : 'ログイン'}
                            </button>

                            <button
                                type="button"
                                onClick={handleTestLogin}
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                【検証用】パスワードなしでログイン
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;

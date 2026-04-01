import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEffect } from 'react';
import { ShieldCheck, UserCircle2, ArrowRight } from 'lucide-react';

const Logo = () => (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="18" height="18" rx="4" className="fill-indigo-500" />
        <rect x="26" y="4" width="18" height="18" rx="4" className="fill-indigo-300 dark:fill-indigo-700" />
        <rect x="4" y="26" width="18" height="18" rx="4" className="fill-indigo-300 dark:fill-indigo-700" />
        <rect x="26" y="26" width="18" height="18" rx="4" className="fill-indigo-500" />
    </svg>
);

const LandingPage = () => {
    const { currentUser, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;
        // admin セッションを優先
        if (currentUser) {
            navigate('/admin');
            return;
        }
        // admin セッションがない場合のみ staff セッションをチェック
        fetch('/api/auth/staff-me')
            .then(res => res.ok ? res.json() : null)
            .then((data: { authenticated: boolean } | null) => {
                if (data?.authenticated) {
                    navigate('/staff/preference');
                }
            })
            .catch(() => {});
    }, [currentUser, loading, navigate]);

    if (loading) return null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 py-12 px-6">
            {/* ロゴ・タイトル */}
            <div className="flex flex-col items-center mb-14 animate-in fade-in slide-in-from-top-4 duration-500">
                <Logo />
                <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                    Web Attendance
                </h1>
                <p className="mt-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
                    Management System
                </p>
            </div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 animate-in fade-in zoom-in-95 duration-500">

                {/* 管理者用入口 */}
                <button
                    onClick={() => navigate('/login')}
                    className="group relative bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-2xl shadow-indigo-100 dark:shadow-none border border-white dark:border-slate-800 text-left transition-all hover:-translate-y-2 hover:ring-2 hover:ring-indigo-500 cursor-pointer"
                >
                    <div className="flex items-center gap-3 sm:gap-4 md:gap-5 mb-6 sm:mb-8">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 flex-shrink-0">
                            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight lowercase">Admin</h2>
                    </div>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium mb-6 sm:mb-8 leading-relaxed">
                        シフトの作成、スタッフの登録、スタッフ区分やクラスの設定など、システム全般の管理を行います。
                    </p>
                    <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest text-xs sm:text-sm">
                        <span className="hidden sm:inline">Management Portal</span>
                        <span className="sm:hidden">管理画面へ</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </div>
                </button>

                {/* 従業員用入口 */}
                <button
                    onClick={() => navigate('/staff/login')}
                    className="group relative bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-2xl shadow-indigo-100 dark:shadow-none border border-white dark:border-slate-800 text-left transition-all hover:-translate-y-2 hover:ring-2 hover:ring-emerald-500 cursor-pointer"
                >
                    <div className="flex items-center gap-3 sm:gap-4 md:gap-5 mb-6 sm:mb-8">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 flex-shrink-0">
                            <UserCircle2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight lowercase">Staff</h2>
                    </div>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium mb-6 sm:mb-8 leading-relaxed">
                        自身の休暇希望の提出や、確定した最新のシフトを確認することができます。
                    </p>
                    <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest text-xs sm:text-sm">
                        <span className="hidden sm:inline">Staff Personal Page</span>
                        <span className="sm:hidden">スタッフページへ</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </div>
                </button>

                <div className="md:col-span-2 text-center mt-4">
                    <p className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em]">
                        Web Attendance Management System v2.3.0
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;

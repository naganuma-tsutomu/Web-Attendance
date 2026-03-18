import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEffect } from 'react';
import { ShieldCheck, UserCircle2, ArrowRight } from 'lucide-react';

const LandingPage = () => {
    const { currentUser, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // すでに管理者としてログインしている場合
        if (!loading && currentUser) {
            navigate('/admin');
        }
        // 従業員セッションをチェック
        const staffSession = localStorage.getItem('staff_session');
        if (staffSession) {
            navigate('/staff/preference');
        }
    }, [currentUser, loading, navigate]);

    if (loading) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
                
                {/* 管理者用入口 */}
                <button
                    onClick={() => navigate('/login')}
                    className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-100 dark:shadow-none border border-white dark:border-slate-800 text-left transition-all hover:-translate-y-2 hover:ring-2 hover:ring-indigo-500 cursor-pointer"
                >
                    <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-4 lowercase">Admin</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                        シフトの作成、スタッフの登録、役職やクラスの設定など、システム全般の管理を行います。
                    </p>
                    <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest text-sm">
                        <span>Management Portal</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </div>
                </button>

                {/* 従業員用入口 */}
                <button
                    onClick={() => navigate('/staff/login')}
                    className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-100 dark:shadow-none border border-white dark:border-slate-800 text-left transition-all hover:-translate-y-2 hover:ring-2 hover:ring-emerald-500 cursor-pointer"
                >
                    <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                        <UserCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-4 lowercase">Staff</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                        自身の休暇希望の提出や、確定した最新のシフトを確認することができます。
                    </p>
                    <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest text-sm">
                        <span>Staff Personal Page</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </div>
                </button>

                <div className="md:col-span-2 text-center mt-4">
                    <p className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em]">
                        Web Attendance Management System v2.0
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;

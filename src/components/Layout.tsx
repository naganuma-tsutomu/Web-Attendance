import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, Settings, LogOut, Moon, Clock } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, currentUser } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/', label: 'シフト表', icon: Calendar },
        { path: '/staff', label: 'スタッフ管理', icon: Users },
        { path: '/preferences', label: '休日管理', icon: Clock },
        { path: '/settings', label: '設定', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row transition-colors duration-300">
            {/* Sidebar / Navigation */}
            <nav className="bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 w-full md:w-64 flex-shrink-0 flex flex-col">
                <div className="p-6 flex items-center justify-center border-b border-slate-100 dark:border-slate-700">
                    <Moon className="w-8 h-8 text-indigo-500 mr-3" />
                    <h1 className="text-xl font-bold tracking-wider text-slate-800 dark:text-white">星空児童館</h1>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2 flex flex-col">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'}`} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="px-4 py-2 mb-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">ログイン中</p>
                        <p className="text-sm font-medium truncate text-slate-800 dark:text-slate-200">{currentUser?.email || 'Demo User'}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 px-4 py-3 rounded-xl w-full text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>ログアウト</span>
                    </button>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;

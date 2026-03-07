import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, Settings, LogOut, Moon, Clock, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, currentUser } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // 画面遷移時にメニューを閉じる
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

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
            {/* Mobile Header */}
            <header className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center">
                    <Moon className="w-6 h-6 text-indigo-500 mr-2" />
                    <h1 className="text-lg font-bold tracking-wider text-slate-800 dark:text-white">星空児童館</h1>
                </div>
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    aria-label="メニューを開く"
                >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* Sidebar / Navigation */}
            <nav className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200
                transform transition-transform duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 md:w-64 flex-shrink-0 flex flex-col
                ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="hidden md:flex p-6 items-center justify-center border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <Moon className="w-8 h-8 text-indigo-500 mr-3" />
                    <h1 className="text-xl font-bold tracking-wider text-slate-800 dark:text-white">星空児童館</h1>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2 flex flex-col overflow-y-auto">
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

                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30 flex-shrink-0">
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
            <main className="flex-1 h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 min-w-0 flex flex-col">
                <div className="flex-1 w-full overflow-y-auto focus:outline-none">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;

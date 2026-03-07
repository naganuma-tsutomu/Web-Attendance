import { Clock, Users, GraduationCap, Palette } from 'lucide-react';

interface SettingsSidebarProps {
    activeTab: 'patterns' | 'roles' | 'classes' | 'appearance';
    setActiveTab: (tab: 'patterns' | 'roles' | 'classes' | 'appearance') => void;
}

const SettingsSidebar = ({ activeTab, setActiveTab }: SettingsSidebarProps) => {
    const menuItems = [
        { id: 'patterns' as const, label: '勤務時間パターン', icon: Clock },
        { id: 'roles' as const, label: '役職管理', icon: Users },
        { id: 'classes' as const, label: 'クラス管理', icon: GraduationCap },
        { id: 'appearance' as const, label: '外観設定', icon: Palette },
    ];

    return (
        <aside className="w-full md:w-64 bg-white dark:bg-slate-800 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex-shrink-0 md:h-full md:sticky md:top-0">
            <nav className="flex md:flex-col overflow-x-auto md:overflow-y-auto md:overflow-x-visible p-2 md:p-4 gap-2 md:gap-1 md:max-h-[calc(100vh-4rem)] settings-sidebar">
                {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`
                                flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                                md:whitespace-normal md:w-full
                                ${isActive
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-2 md:ring-0 md:border-r-2 ring-indigo-500 md:border-indigo-500 dark:md:border-indigo-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
                                }
                            `}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                            <span className="hidden sm:inline md:inline">{item.label}</span>
                            <span className="sm:hidden">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default SettingsSidebar;

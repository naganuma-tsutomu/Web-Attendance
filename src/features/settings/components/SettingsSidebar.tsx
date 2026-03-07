import { Clock, Users, School, Palette } from 'lucide-react';

interface SettingsSidebarProps {
    activeTab: 'patterns' | 'roles' | 'classes' | 'appearance';
    setActiveTab: (tab: 'patterns' | 'roles' | 'classes' | 'appearance') => void;
}

const SettingsSidebar = ({ activeTab, setActiveTab }: SettingsSidebarProps) => {
    const menuItems = [
        { id: 'patterns', label: '勤務時間パターン', icon: Clock },
        { id: 'roles', label: '役職管理', icon: Users },
        { id: 'classes', label: 'クラス管理', icon: School },
        { id: 'appearance', label: '外観設定', icon: Palette },
    ] as const;

    return (
        <aside className="w-full md:w-64 bg-white dark:bg-slate-800 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex-shrink-0">
            <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible p-2 md:p-4 gap-2 md:gap-1">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`
                            flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                            ${activeTab === item.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-b-2 md:border-b-0 md:border-r-2 border-indigo-600 dark:border-indigo-400'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                            }
                        `}
                    >
                        <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
};

export default SettingsSidebar;

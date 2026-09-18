import { Search } from 'lucide-react';
import MonthNavigation from '../../../components/ui/MonthNavigation';

type StaffListToolbarProps = {
    currentMonth: Date;
    isLoading: boolean;
    searchTerm: string;
    onMonthChange: (date: Date) => void;
    onSearchChange: (value: string) => void;
};

const StaffListToolbar = ({
    currentMonth,
    isLoading,
    searchTerm,
    onMonthChange,
    onSearchChange,
}: StaffListToolbarProps) => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
                type="text"
                placeholder="スタッフを検索..."
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
            />
        </div>

        <MonthNavigation
            date={currentMonth}
            onChange={onMonthChange}
            isLoading={isLoading}
        />
    </div>
);

export default StaffListToolbar;

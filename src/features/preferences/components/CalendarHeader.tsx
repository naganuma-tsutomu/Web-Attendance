import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Staff } from '../../../types';
import { ROLE_COLORS } from '../constants';

interface CalendarHeaderProps {
    selectedStaff: Staff | undefined;
    targetDate: Date;
}

const CalendarHeader = ({ selectedStaff, targetDate }: CalendarHeaderProps) => (
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        {/* モバイル: 縦積み / PC: 横並び */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-slate-800 dark:text-white">
                        {selectedStaff?.name}
                    </span>
                    {selectedStaff && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[selectedStaff.role] || ''}`}>
                            {selectedStaff.role}
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {format(targetDate, 'yyyy年M月', { locale: ja })} の休日設定
                </p>
            </div>
            <div className="flex items-center justify-end gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 inline-block" />固定休
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />可能
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />不可
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />研修
                </span>
            </div>
        </div>
    </div>
);

export default CalendarHeader;

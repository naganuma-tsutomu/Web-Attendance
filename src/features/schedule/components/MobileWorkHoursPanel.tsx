import { X } from 'lucide-react';
import type { Staff, Shift } from '../../../types';
import StaffWorkHoursSummary from './StaffWorkHoursSummary';

interface MobileWorkHoursPanelProps {
    isOpen: boolean;
    staffs: Staff[];
    shifts: Shift[];
    viewDate: Date;
    onClose: () => void;
}

const MobileWorkHoursPanel = ({
    isOpen,
    staffs,
    shifts,
    viewDate,
    onClose,
}: MobileWorkHoursPanelProps) => {
    if (!isOpen) return null;

    return (
        <div className="lg:hidden">
            <div
                className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                        (e.currentTarget as HTMLElement).dataset.mouseDownOnBackdrop = 'true';
                    }
                }}
                onMouseUp={(e) => {
                    if (e.target === e.currentTarget && (e.currentTarget as HTMLElement).dataset.mouseDownOnBackdrop === 'true') {
                        onClose();
                    }
                    (e.currentTarget as HTMLElement).dataset.mouseDownOnBackdrop = 'false';
                }}
            >
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-800 animate-in slide-in-from-right duration-300" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white">労働時間サマリー</h3>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <StaffWorkHoursSummary
                                staffs={staffs}
                                shifts={shifts}
                                isOpen={true}
                                viewDate={viewDate}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileWorkHoursPanel;

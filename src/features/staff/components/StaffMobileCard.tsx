import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Staff, ShiftClass } from '../../../types';
import { formatHours } from '../../../utils/timeUtils';

interface StaffMobileCardProps {
    staff: Staff;
    classes: ShiftClass[];
    onEdit?: (staff: Staff) => void;
    onDelete?: (id: string, name: string) => void;
    isOverlay?: boolean;
    getHolidayDisplay: (availableDays?: (number | { day: number, weeks?: number[] | null })[]) => string;
    currentMonthHours?: number;
}

const StaffMobileCard = ({
    staff,
    classes,
    onEdit,
    onDelete,
    isOverlay = false,
    getHolidayDisplay,
    currentMonthHours = 0
}: StaffMobileCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: staff.id, disabled: isOverlay });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
    };

    const assignedClasses = (staff.classIds || [])
        .map(classId => classes.find(cls => cls.id === classId))
        .filter((cls): cls is ShiftClass => Boolean(cls));
    const hasMonthlyTarget = staff.hoursTarget !== null && staff.hoursTarget !== undefined;
    const isOverTarget = hasMonthlyTarget && currentMonthHours > staff.hoursTarget!;
    const progress = hasMonthlyTarget && staff.hoursTarget! > 0
        ? Math.min((currentMonthHours / staff.hoursTarget!) * 100, 100)
        : 0;

    const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onEdit?.(staff);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            role={!isOverlay ? 'button' : undefined}
            tabIndex={!isOverlay ? 0 : undefined}
            onClick={!isOverlay ? () => onEdit?.(staff) : undefined}
            onKeyDown={!isOverlay ? handleCardKeyDown : undefined}
            className={`w-full rounded-xl border bg-white dark:bg-slate-800 p-4 text-left shadow-sm transition-all ${
                isOverlay
                    ? 'border-indigo-200 dark:border-indigo-700 opacity-90'
                    : 'border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700/70'
            } ${isDragging && !isOverlay ? 'outline-2 outline-indigo-200 outline-dashed' : ''}`}
            aria-label={!isOverlay ? `${staff.name} の情報を編集` : undefined}
        >
            <div className="flex items-start gap-3">
                {!isOverlay && (
                    <button
                        {...attributes}
                        {...listeners}
                        type="button"
                        aria-label="並び替え"
                        onClick={(event) => event.stopPropagation()}
                        className="mt-0.5 -ml-1 cursor-grab rounded-lg p-2 text-slate-300 transition-all hover:bg-slate-50 hover:text-indigo-500 active:cursor-grabbing dark:hover:bg-slate-700"
                    >
                        <GripVertical className="h-5 w-5" />
                    </button>
                )}

                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="truncate text-base font-bold text-slate-900 dark:text-white">{staff.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                                    {staff.role}
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {staff.accessKey || '----'}
                                </span>
                            </div>
                        </div>

                        {!isOverlay && (
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onDelete?.(staff.id, staff.name);
                                }}
                                aria-label="削除"
                                className="-mr-1 rounded-xl p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {assignedClasses.length > 0 ? (
                            assignedClasses.map(cls => (
                                <span key={cls.id} className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                    {cls.name}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs italic text-slate-400">クラス未設定</span>
                        )}
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">月間労働時間</span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                <span className={`font-bold ${isOverTarget ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                    {formatHours(currentMonthHours)}h
                                </span>
                                {hasMonthlyTarget && (
                                    <span className="ml-1 text-xs font-normal text-slate-400">/ {staff.hoursTarget}h</span>
                                )}
                            </span>
                        </div>
                        {staff.weeklyHoursTarget !== null && staff.weeklyHoursTarget !== undefined && (
                            <div className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                週目標: {staff.weeklyHoursTarget}h
                            </div>
                        )}
                        {hasMonthlyTarget && staff.hoursTarget! > 0 && (
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${isOverTarget ? 'bg-red-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-start justify-between gap-3 text-xs">
                        <span className="font-bold text-slate-500 dark:text-slate-400">固定休日</span>
                        <span className="min-w-0 text-right font-medium text-slate-600 dark:text-slate-300">
                            {getHolidayDisplay(staff.availableDays)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffMobileCard;

import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Staff, ShiftClass } from '../../../types';
import { formatHours } from '../../../utils/timeUtils';

interface StaffRowProps {
    staff: Staff;
    classes: ShiftClass[];
    onEdit?: (staff: Staff) => void;
    onDelete?: (id: string, name: string) => void;
    isOverlay?: boolean;
    getHolidayDisplay: (availableDays?: (number | { day: number, weeks?: number[] })[]) => string;
    currentMonthHours?: number;
}

const StaffRow = ({ staff, classes, onEdit, onDelete, isOverlay = false, getHolidayDisplay, currentMonthHours = 0 }: StaffRowProps) => {
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

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`${isOverlay ? 'bg-white dark:bg-slate-800 opacity-90' : 'hover:bg-slate-50/50 transition-colors'} ${isDragging && !isOverlay ? 'bg-indigo-50/50 outline-2 outline-indigo-200 outline-dashed' : ''}`}
        >
            <td className="pl-4 pr-2 py-4 w-10">
                {!isOverlay && (
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-1 rounded-lg hover:bg-white transition-all"
                    >
                        <GripVertical className="w-5 h-5" />
                    </button>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-bold text-slate-900 dark:text-white">{staff.name}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                    {staff.role}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300">
                    {staff.accessKey || '----'}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-wrap gap-1">
                    {staff.classIds && staff.classIds.length > 0 ? (
                        staff.classIds.map(cid => {
                            const cls = classes.find(c => c.id === cid);
                            return cls ? (
                                <span key={cid} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {cls.name}
                                </span>
                            ) : null;
                        })
                    ) : (
                        <span className="text-xs text-slate-400 italic">未設定</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {staff.hoursTarget !== null ? (
                            <>
                                <span className={`font-bold ${currentMonthHours > staff.hoursTarget ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                    {formatHours(currentMonthHours)}h
                                </span>
                                <span className="text-xs text-slate-400 font-normal ml-1">
                                    / {staff.hoursTarget}h
                                </span>
                            </>
                        ) : (
                            <span className="font-bold text-slate-700 dark:text-slate-200">{formatHours(currentMonthHours)}h</span>
                        )}
                    </div>
                    {staff.weeklyHoursTarget !== null && staff.weeklyHoursTarget !== undefined && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                            週目標: {staff.weeklyHoursTarget}h
                        </div>
                    )}
                    {staff.hoursTarget !== null && staff.hoursTarget > 0 && (
                        <div className="h-1.5 w-24 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${currentMonthHours > staff.hoursTarget ? 'bg-red-500' : 'bg-indigo-500'}`}
                                style={{ width: `${Math.min((currentMonthHours / staff.hoursTarget) * 100, 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                    {getHolidayDisplay(staff.availableDays)}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                {!isOverlay && (
                    <>
                        <button
                            onClick={() => onEdit?.(staff)}
                            className="text-slate-400 hover:text-indigo-600 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                        >
                            <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onDelete?.(staff.id, staff.name)}
                            className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </>
                )}
            </td>
        </tr>
    );
};

export default StaffRow;

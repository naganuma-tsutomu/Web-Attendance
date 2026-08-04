import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    defaultDropAnimationSideEffects,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ShiftClass, Staff } from '../../../types';
import { getHolidayDisplay } from '../utils/staffDisplayUtils';
import StaffRow from './StaffRow';

type StaffDesktopTableProps = {
    activeStaff: Staff | null | undefined;
    classes: ShiftClass[];
    isLoading: boolean;
    shiftTotals: Record<string, number>;
    staffs: Staff[];
    onDelete: (id: string, name: string) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onDragStart: (event: DragStartEvent) => void;
    onEdit: (staff: Staff) => void;
};

const StaffDesktopTable = ({
    activeStaff,
    classes,
    isLoading,
    shiftTotals,
    staffs,
    onDelete,
    onDragEnd,
    onDragStart,
    onEdit,
}: StaffDesktopTableProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    return (
        <div className="hidden flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden sm:flex flex-col">
            <div className="overflow-x-auto flex-1 -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                        accessibility={{ screenReaderInstructions: { draggable: '' } }}
                    >
                        <SortableContext items={staffs.map(staff => staff.id)} strategy={verticalListSortingStrategy}>
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th aria-label="並び替え" className="w-8 sm:w-12 px-2 sm:px-4 py-3 sm:py-4" />
                                        <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">名前</th>
                                        <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">スタッフ区分</th>
                                        <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">アクセスキー</th>
                                        <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">所属クラス</th>
                                        <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">月間労働時間</th>
                                        <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">固定休日</th>
                                        <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                    {isLoading ? (
                                        /* eslint-disable jsx-a11y/control-has-associated-label */
                                        Array.from({ length: 5 }).map((_, index) => (
                                            <tr key={index} aria-hidden="true" className="animate-pulse border-b border-slate-50 dark:border-slate-700">
                                                <td className="pl-4 pr-2 py-4 w-10"><div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-md" /></td>
                                                <td className="px-6 py-4"><div className="h-5 w-24 sm:w-32 bg-slate-200 dark:bg-slate-700 rounded-md" /></td>
                                                <td className="px-6 py-4"><div className="h-6 w-20 sm:w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" /></td>
                                                <td className="px-6 py-4"><div className="h-5 w-16 sm:w-20 bg-slate-200 dark:bg-slate-700 rounded-md" /></td>
                                                <td className="px-6 py-4"><div className="flex gap-1"><div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded-sm" /><div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded-sm" /></div></td>
                                                <td className="px-6 py-4"><div className="h-4 w-12 sm:w-16 bg-slate-200 dark:bg-slate-700 rounded-md mb-2" /><div className="h-1.5 w-20 sm:w-24 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                                                <td className="px-6 py-4"><div className="h-6 w-12 sm:w-16 bg-slate-200 dark:bg-slate-700 rounded-md" /></td>
                                                <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" /><div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" /></div></td>
                                            </tr>
                                        ))
                                        /* eslint-enable jsx-a11y/control-has-associated-label */
                                    ) : staffs.length === 0 ? (
                                        <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">該当するスタッフが見つかりません</td></tr>
                                    ) : staffs.map(staff => (
                                        <StaffRow
                                            key={staff.id}
                                            staff={staff}
                                            classes={classes}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            getHolidayDisplay={getHolidayDisplay}
                                            currentMonthHours={shiftTotals[staff.id] || 0}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </SortableContext>

                        <DragOverlay dropAnimation={{
                            sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.3' } } }),
                        }}>
                            {activeStaff ? (
                                <div className="rounded-xl overflow-hidden shadow-2xl ring-2 ring-indigo-500 bg-white dark:bg-slate-800 opacity-90">
                                    <table className="w-full border-collapse"><tbody><StaffRow
                                        staff={activeStaff}
                                        classes={classes}
                                        isOverlay
                                        getHolidayDisplay={getHolidayDisplay}
                                        currentMonthHours={shiftTotals[activeStaff.id] || 0}
                                    /></tbody></table>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>
        </div>
    );
};

export default StaffDesktopTable;

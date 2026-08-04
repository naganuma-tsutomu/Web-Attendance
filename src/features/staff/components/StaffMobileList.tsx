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
import StaffMobileCard from './StaffMobileCard';

type StaffMobileListProps = {
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

const StaffMobileList = ({
    activeStaff,
    classes,
    isLoading,
    shiftTotals,
    staffs,
    onDelete,
    onDragEnd,
    onDragStart,
    onEdit,
}: StaffMobileListProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    return (
        <div className="sm:hidden">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                modifiers={[restrictToVerticalAxis]}
                accessibility={{ screenReaderInstructions: { draggable: '' } }}
            >
                <SortableContext items={staffs.map(staff => staff.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} aria-hidden="true" className="animate-pulse rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <div className="flex gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700" />
                                        <div className="min-w-0 flex-1 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-2">
                                                    <div className="h-5 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
                                                    <div className="h-5 w-36 rounded-lg bg-slate-200 dark:bg-slate-700" />
                                                </div>
                                                <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-700" />
                                            </div>
                                            <div className="flex gap-1.5">
                                                <div className="h-5 w-14 rounded bg-slate-200 dark:bg-slate-700" />
                                                <div className="h-5 w-14 rounded bg-slate-200 dark:bg-slate-700" />
                                            </div>
                                            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                                                <div className="mb-2 h-4 w-full rounded-md bg-slate-200 dark:bg-slate-700" />
                                                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : staffs.length === 0 ? (
                            <div className="rounded-xl border border-slate-100 bg-white px-6 py-12 text-center font-medium text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                該当するスタッフが見つかりません
                            </div>
                        ) : staffs.map(staff => (
                            <StaffMobileCard
                                key={staff.id}
                                staff={staff}
                                classes={classes}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                getHolidayDisplay={getHolidayDisplay}
                                currentMonthHours={shiftTotals[staff.id] || 0}
                            />
                        ))}
                    </div>
                </SortableContext>

                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.3' } } }),
                }}>
                    {activeStaff ? (
                        <StaffMobileCard
                            staff={activeStaff}
                            classes={classes}
                            isOverlay
                            getHolidayDisplay={getHolidayDisplay}
                            currentMonthHours={shiftTotals[activeStaff.id] || 0}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default StaffMobileList;

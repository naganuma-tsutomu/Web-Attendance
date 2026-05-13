import { Loader2 } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    DragOverlay,
    defaultDropAnimationSideEffects,
    type DragEndEvent,
    type DragStartEvent,
    type SensorDescriptor,
    type SensorOptions,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { DynamicRole } from '../../../types';
import SortableRoleItem from './SortableRoleItem';

interface RolesListProps {
    roles: DynamicRole[];
    loading: boolean;
    sensors: SensorDescriptor<SensorOptions>[];
    activeRole: DynamicRole | null;
    activeId: string | null;
    onDragStart: (event: DragStartEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onDelete: (id: string) => void;
    onEdit: (role: DynamicRole) => void;
}

const RolesList = ({
    roles,
    loading,
    sensors,
    activeRole,
    activeId,
    onDragStart,
    onDragEnd,
    onDelete,
    onEdit,
}: RolesListProps) => (
    <div className="space-y-4 max-w-4xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-4 flex justify-between items-center">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider flex items-center">
                <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                登録済みスタッフ区分
            </h4>
            <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full shadow-sm">
                {roles.length}
            </span>
        </div>

        {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>
        ) : (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                modifiers={[restrictToVerticalAxis]}
            >
                <SortableContext items={roles.map(r => r.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-4">
                        {roles.map((role, index) => (
                            <SortableRoleItem
                                key={role.id}
                                role={role}
                                index={index}
                                onDelete={onDelete}
                                onEdit={() => onEdit(role)}
                            />
                        ))}
                    </div>
                </SortableContext>
                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: { active: { opacity: '0.3' } }
                    })
                }}>
                    {activeRole ? (
                        <SortableRoleItem
                            role={activeRole}
                            index={roles.findIndex(r => r.id === activeId)}
                            isOverlay
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
        )}
    </div>
);

export default RolesList;

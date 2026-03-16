import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, Search, AlertCircle, Loader2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { calculateTotalHours } from '../../utils/timeUtils';
import { saveActiveMonth, loadActiveMonth } from '../../utils/dateUtils';
import { useStaffList, useRoles, useClasses, useShiftsByMonth, useCreateStaff, useUpdateStaff, useDeleteStaff, useUpdateStaffOrder } from '../../lib/hooks';
import type { Staff } from '../../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StaffRow from './components/StaffRow';
import StaffFormModal from './components/StaffFormModal';

const StaffPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(() => loadActiveMonth());

    const [formData, setFormData] = useState<Omit<Staff, 'id'>>({
        name: '',
        role: '',
        hoursTarget: null,
        weeklyHoursTarget: null,
        classIds: []
    });

    // --- React Query Hooks ---
    const { data: staffList = [], isLoading: isStaffLoading, isError: isStaffError, refetch: refetchStaff } = useStaffList();
    const { data: roles = [], isLoading: isRolesLoading, isError: isRolesError, refetch: refetchRoles } = useRoles();
    const { data: classes = [], isLoading: isClassesLoading, isError: isClassesError, refetch: refetchClasses } = useClasses();

    const monthStr = format(currentMonth, 'yyyy-MM');
    const { data: shifts = [], isLoading: loadingShifts, isFetching: isShiftsFetching, refetch: refetchShifts } = useShiftsByMonth(monthStr);

    const createStaffMut = useCreateStaff();
    const updateStaffMut = useUpdateStaff();
    const deleteStaffMut = useDeleteStaff();
    const updateOrderMut = useUpdateStaffOrder();

    const shiftTotals = useMemo(() => calculateTotalHours(shifts), [shifts]);

    const loading = isStaffLoading || isRolesLoading || isClassesLoading;
    const error = (isStaffError || isRolesError || isClassesError) ? 'データの読み込みに失敗しました。' : '';
    const isSubmitting = createStaffMut.isPending || updateStaffMut.isPending;

    const handleRetry = () => {
        refetchStaff();
        refetchRoles();
        refetchClasses();
        refetchShifts();
    };

    // Update active month when currentMonth changes
    useMemo(() => saveActiveMonth(currentMonth), [currentMonth]);

    const handleDeleteClick = (id: string, name: string) => {
        setDeleteConfirm({ id, name });
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;
        setIsDeleting(true);
        try {
            await deleteStaffMut.mutateAsync(deleteConfirm.id);
            setDeleteConfirm(null);
            toast.success("スタッフを削除しました。");
        } catch (err) {
            console.error(err);
            toast.error("削除に失敗しました。");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOpenAddModal = () => {
        const defaultRole = roles[0];
        setEditingStaff(null);
        setFormData({
            name: '',
            role: defaultRole?.name || '',
            hoursTarget: defaultRole?.targetHours ?? null,
            weeklyHoursTarget: defaultRole?.weeklyHoursTarget ?? null,
            defaultWorkingHoursStart: '',
            defaultWorkingHoursEnd: '',
            isHelpStaff: false,
            availableDays: [1, 2, 3, 4, 5, 6],
            classIds: []
        });
        setIsModalOpen(true);
    };

    const handleRoleChange = (roleName: string) => {
        const selectedRole = roles.find(r => r.name === roleName);
        setFormData(prev => ({
            ...prev,
            role: roleName,
            hoursTarget: selectedRole ? (selectedRole.targetHours ?? null) : prev.hoursTarget,
            weeklyHoursTarget: selectedRole ? (selectedRole.weeklyHoursTarget ?? null) : prev.weeklyHoursTarget
        }));
    };

    const handleOpenEditModal = (staff: Staff) => {
        setEditingStaff(staff);
        setFormData({
            name: staff.name,
            role: staff.role,
            hoursTarget: staff.hoursTarget ?? null,
            weeklyHoursTarget: staff.weeklyHoursTarget ?? null,
            isHelpStaff: staff.isHelpStaff || false,
            availableDays: staff.availableDays || [1, 2, 3, 4, 5, 6],
            defaultWorkingHoursStart: staff.defaultWorkingHoursStart || '',
            defaultWorkingHoursEnd: staff.defaultWorkingHoursEnd || '',
            classIds: staff.classIds || []
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingStaff) {
                await updateStaffMut.mutateAsync({ id: editingStaff.id, data: formData });
            } else {
                await createStaffMut.mutateAsync(formData);
            }
            setIsModalOpen(false);
            toast.success(editingStaff ? "スタッフ情報を更新しました。" : "スタッフを追加しました。");
        } catch (err) {
            console.error(err);
            toast.error("保存に失敗しました。");
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (over && active.id !== over.id) {
            const oldIndex = staffList.findIndex((i) => i.id === active.id);
            const newIndex = staffList.findIndex((i) => i.id === over.id);
            const newList = arrayMove(staffList, oldIndex, newIndex);

            const orders = newList.map((s, idx) => ({ id: s.id, order: idx + 1 }));
            
            // 楽観的更新のためにキャッシュを直接操作することも可能だが、ここでは再フェッチに任せるか直接mutationを実行
            updateOrderMut.mutate(orders, {
                onError: (err) => {
                    console.error("Failed to save order", err);
                    toast.error("並び替えの保存に失敗しました。");
                }
            });
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const getHolidayDisplay = (availableDays?: (number | { day: number, weeks?: number[] })[]) => {
        if (!availableDays || availableDays.length === 0) return '設定なし';
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const allDays = [1, 2, 3, 4, 5, 6];

        const holidayNames = allDays
            .filter(d => !availableDays.some(ad => ad && (typeof ad === 'number' ? ad : ad.day) === d))
            .map(d => dayNames[d]);

        const partialHolidays = availableDays
            .filter(ad => typeof ad === 'object' && ad.weeks && ad.weeks.length < 5)
            .map(ad => {
                const day = (ad as { day: number, weeks: number[] }).day;
                const weeks = (ad as { day: number, weeks: number[] }).weeks;
                const offWeeks = [1, 2, 3, 4, 5].filter(w => !weeks.includes(w));
                return `${dayNames[day]} (第${offWeeks.join(',')})`;
            });

        const result = [...holidayNames, ...partialHolidays].join(', ');
        return result || '設定なし';
    };

    const filteredStaff = staffList.filter(s => s.name.includes(searchTerm));
    const activeStaff = activeId ? staffList.find(s => s.id === activeId) : null;

    return (
        <div className="space-y-6 max-w-5xl mx-auto w-full p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">スタッフ管理</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">スタッフの登録情報と役職の割り当てを管理します</p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all font-bold"
                >
                    <Plus className="w-5 h-5" />
                    <span>スタッフ追加</span>
                </button>
            </div>

            {error && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start justify-between gap-3 animate-in fade-in" role="alert">
                    <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-amber-800 font-medium dark:text-amber-300">{error}</span>
                    </div>
                    <button
                        onClick={handleRetry}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        再試行
                    </button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0 mb-6">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="スタッフを検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                    />
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
                    <button
                        onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                        className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500"
                        title="前月"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="px-3 py-1 flex items-center gap-2 min-w-[120px] justify-center">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {format(currentMonth, 'yyyy年M月', { locale: ja })}
                        </span>
                        {(loadingShifts || isShiftsFetching) && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
                    </div>
                    <button
                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                        className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500"
                        title="次月"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                        accessibility={{ screenReaderInstructions: { draggable: '' } }}
                    >
                        <SortableContext
                            items={filteredStaff.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="w-12 px-4 py-4"></th>
                                        <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">名前</th>
                                        <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">役職</th>
                                        <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">アクセスキー</th>
                                        <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">所属クラス</th>
                                        <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">月間労働時間</th>
                                        <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">固定休日</th>
                                        <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center">
                                                <div className="flex justify-center">
                                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                                                該当するスタッフが見つかりません
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStaff.map((staff) => (
                                            <StaffRow
                                                key={staff.id}
                                                staff={staff}
                                                classes={classes}
                                                onEdit={handleOpenEditModal}
                                                onDelete={handleDeleteClick}
                                                getHolidayDisplay={getHolidayDisplay}
                                                currentMonthHours={shiftTotals[staff.id] || 0}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </SortableContext>

                        <DragOverlay dropAnimation={{
                            sideEffects: defaultDropAnimationSideEffects({
                                styles: {
                                    active: {
                                        opacity: '0.3',
                                    },
                                },
                            }),
                        }}>
                            {activeStaff ? (
                                <div className="p-0 border-none shadow-none">
                                    <table className="w-full">
                                        <tbody>
                                            <StaffRow
                                                staff={activeStaff}
                                                classes={classes}
                                                isOverlay
                                                getHolidayDisplay={getHolidayDisplay}
                                                currentMonthHours={shiftTotals[activeStaff.id] || 0}
                                            />
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>

            <StaffFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                editingStaff={editingStaff}
                formData={formData}
                setFormData={setFormData}
                roles={roles}
                classes={classes}
                isSubmitting={isSubmitting}
                handleRoleChange={handleRoleChange}
            />

            <ConfirmModal
                isOpen={!!deleteConfirm}
                title="スタッフの削除"
                message={`${deleteConfirm?.name} さんを削除してもよろしいですか？この操作は取り消せません。`}
                confirmLabel="削除する"
                cancelLabel="キャンセル"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirm(null)}
                isLoading={isDeleting}
                variant="danger"
            />
        </div>
    );
};

export default StaffPage;

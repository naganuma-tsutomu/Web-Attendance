import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, Loader2, GripVertical } from 'lucide-react';
import { getStaffList, deleteStaff, createStaff, updateStaff, getRoles, updateStaffOrder } from '../../lib/api';
import type { Staff, DynamicRole } from '../../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// --- Sortable Row Component ---
const SortableRow = ({ staff, onEdit, onDelete, children }: {
    staff: Staff,
    onEdit: (staff: Staff) => void,
    onDelete: (id: string, name: string) => void,
    children: React.ReactNode
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: staff.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-slate-50/50 transition-colors ${isDragging ? 'bg-indigo-50/50 outline-2 outline-indigo-200 outline-dashed' : ''}`}
        >
            <td className="pl-4 pr-2 py-4 w-10">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-1 rounded-lg hover:bg-white transition-all"
                >
                    <GripVertical className="w-5 h-5" />
                </button>
            </td>
            {children}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button
                    onClick={() => onEdit(staff)}
                    className="text-slate-400 hover:text-indigo-600 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                >
                    <Edit2 className="w-5 h-5" />
                </button>
                <button
                    onClick={() => onDelete(staff.id, staff.name)}
                    className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </td>
        </tr>
    );
};

const StaffPage = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState<Omit<Staff, 'id'>>({
        name: '',
        role: '',
        hoursTarget: null,
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [staffData, rolesData] = await Promise.all([
                getStaffList(),
                getRoles()
            ]);
            setStaffList(staffData);
            setRoles(rolesData);

            // Default role for new staff if roles exist
            if (rolesData.length > 0 && !formData.role) {
                setFormData(prev => ({ ...prev, role: rolesData[0].name }));
            }

            setError('');
        } catch (err) {
            console.error("Fetch error", err);
            setError('データの読み込みに失敗しました。設定で役職が登録されているか確認してください。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`${name}さんを削除してもよろしいですか？`)) return;
        try {
            await deleteStaff(id);
            setStaffList(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error(err);
            alert("削除に失敗しました。");
        }
    };

    const handleOpenAddModal = () => {
        const defaultRole = roles[0];
        setEditingStaff(null);
        setFormData({
            name: '',
            role: defaultRole?.name || '',
            hoursTarget: defaultRole?.targetHours ?? null,
            defaultWorkingHoursStart: '',
            defaultWorkingHoursEnd: '',
            isHelpStaff: false,
            availableDays: [1, 2, 3, 4, 5, 6]
        });
        setIsModalOpen(true);
    };

    const handleRoleChange = (roleName: string) => {
        const selectedRole = roles.find(r => r.name === roleName);
        setFormData(prev => ({
            ...prev,
            role: roleName,
            hoursTarget: selectedRole ? (selectedRole.targetHours ?? null) : prev.hoursTarget
        }));
    };

    const handleOpenEditModal = (staff: Staff) => {
        setEditingStaff(staff);
        setFormData({
            name: staff.name,
            role: staff.role,
            hoursTarget: staff.hoursTarget,
            isHelpStaff: staff.isHelpStaff,
            availableDays: staff.availableDays,
            defaultWorkingHoursStart: staff.defaultWorkingHoursStart,
            defaultWorkingHoursEnd: staff.defaultWorkingHoursEnd,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingStaff) {
                await updateStaff(editingStaff.id, formData);
            } else {
                await createStaff(formData);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("保存に失敗しました。");
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setStaffList((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                const newList = arrayMove(items, oldIndex, newIndex);

                // Update orders in background
                const orders = newList.map((s, idx) => ({ id: s.id, order: idx + 1 }));
                updateStaffOrder(orders).catch(err => {
                    console.error("Failed to save order", err);
                    alert("並び替えの保存に失敗しました。");
                });

                return newList;
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
        const allDays = [1, 2, 3, 4, 5, 6]; // 1-6 (月-土)

        // 出勤日でない（＝休み）日を抽出
        const holidayNames = allDays
            .filter(d => !availableDays.some(ad => (typeof ad === 'number' ? ad : ad.day) === d))
            .map(d => dayNames[d]);

        // 部分的な休み（特定週のみ出勤）を抽出
        const partialHolidays = availableDays
            .filter(ad => typeof ad === 'object' && ad.weeks && ad.weeks.length < 5)
            .map(ad => {
                const day = (ad as any).day;
                const weeks = (ad as any).weeks;
                const offWeeks = [1, 2, 3, 4, 5].filter(w => !weeks.includes(w));
                return `${dayNames[day]}(第${offWeeks.join(',')})`;
            });

        const result = [...holidayNames, ...partialHolidays].join(', ');
        return result || '設定なし';
    };

    const filteredStaff = staffList.filter(s => s.name.includes(searchTerm));

    return (
        <div className="space-y-6">
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
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-800 font-medium dark:text-amber-300">{error}</span>
                </div>
            )}

            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="名前で検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white shadow-sm transition-all"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                        <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                            <tr>
                                <th className="w-10 px-4"></th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    名前
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    月間労働時間
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    固定休日
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-300" />
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                                        該当するスタッフが見つかりません
                                    </td>
                                </tr>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                    modifiers={[restrictToVerticalAxis]}
                                >
                                    <SortableContext
                                        items={filteredStaff.map(s => s.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {filteredStaff.map((staff) => (
                                            <SortableRow
                                                key={staff.id}
                                                staff={staff}
                                                onEdit={handleOpenEditModal}
                                                onDelete={handleDelete}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{staff.name}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                                                        {staff.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                    {staff.hoursTarget !== null ? `${staff.hoursTarget} h` : '設定なし'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                                                        {getHolidayDisplay(staff.availableDays)}
                                                    </span>
                                                </td>
                                            </SortableRow>
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {
                isModalOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setIsModalOpen(false);
                        }}
                    >
                        <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                            <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/30">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                    {editingStaff ? '情報を更新' : 'スタッフ登録'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                                    <Plus className="w-5 h-5 transform rotate-45" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5 pl-1">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">氏名</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white"
                                            placeholder="山田 太郎"
                                        />
                                    </div>
                                    <div className="space-y-1.5 pl-1">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">役職マスタから選ぶ</label>
                                        <select
                                            value={formData.role}
                                            onChange={e => handleRoleChange(e.target.value)}
                                            className="w-full px-4 py-3 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white appearance-none"
                                        >
                                            {roles.length === 0 && <option value="">役職を登録してください</option>}
                                            {roles.map(role => <option key={role.id} value={role.name}>{role.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-3 pl-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">月間労働時間 (h/月)</label>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formData.hoursTarget === null ? '設定なし' : '設定する'}</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={formData.hoursTarget !== null}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFormData({ ...formData, hoursTarget: checked ? 160 : null });
                                                        }}
                                                    />
                                                    <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                                </label>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            required
                                            value={formData.hoursTarget === null ? '' : formData.hoursTarget}
                                            disabled={formData.hoursTarget === null}
                                            onChange={e => setFormData({ ...formData, hoursTarget: parseInt(e.target.value) || 0 })}
                                            placeholder="設定されていません"
                                            className={`w-full px-4 py-3 border rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium transition-all
                                                ${formData.hoursTarget === null
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">固定休日設定</label>
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 space-y-4">
                                        {['月', '火', '水', '木', '金', '土'].map((label, idx) => {
                                            const dayNum = idx + 1;
                                            const config = formData.availableDays?.find(d =>
                                                (typeof d === 'number' ? d : d.day) === dayNum
                                            );
                                            const isPartialWorking = typeof config === 'object';
                                            const isHolidayEveryWeek = !config;
                                            const isHoliday = isHolidayEveryWeek || isPartialWorking;

                                            return (
                                                <div key={dayNum} className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-8">{label}曜</span>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={isHoliday}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked;
                                                                        let newAvailableDays = [...(formData.availableDays || [1, 2, 3, 4, 5, 6])];
                                                                        if (checked) {
                                                                            newAvailableDays = newAvailableDays.filter(d => (typeof d === 'number' ? d : d.day) !== dayNum);
                                                                        } else {
                                                                            newAvailableDays = newAvailableDays.filter(d => (typeof d === 'number' ? d : d.day) !== dayNum);
                                                                            newAvailableDays.push(dayNum);
                                                                        }
                                                                        setFormData({ ...formData, availableDays: newAvailableDays });
                                                                    }}
                                                                />
                                                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 dark:peer-checked:bg-red-600"></div>
                                                                <span className="ms-3 text-xs font-bold text-slate-500 dark:text-slate-400">{isHoliday ? '休み' : '出勤'}</span>
                                                            </label>
                                                        </div>

                                                        {isHoliday && (
                                                            <div className="flex space-x-1">
                                                                {[1, 2, 3, 4, 5].map(week => {
                                                                    let isWeekHoliday = false;
                                                                    if (isHolidayEveryWeek) {
                                                                        isWeekHoliday = true;
                                                                    } else if (isPartialWorking) {
                                                                        isWeekHoliday = !(config as any).weeks.includes(week);
                                                                    }

                                                                    return (
                                                                        <button
                                                                            key={week}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                let newAvailableDays = [...(formData.availableDays || [1, 2, 3, 4, 5, 6])];
                                                                                const currentConfig = newAvailableDays.find(d => (typeof d === 'number' ? d : d.day) === dayNum);
                                                                                let availableWeeks = [1, 2, 3, 4, 5];
                                                                                if (typeof currentConfig === 'object') {
                                                                                    availableWeeks = [...(currentConfig.weeks || [])];
                                                                                } else if (!currentConfig) {
                                                                                    availableWeeks = [];
                                                                                }
                                                                                if (isWeekHoliday) {
                                                                                    availableWeeks.push(week);
                                                                                } else {
                                                                                    availableWeeks = availableWeeks.filter(w => w !== week);
                                                                                }
                                                                                availableWeeks.sort();
                                                                                newAvailableDays = newAvailableDays.filter(d => (typeof d === 'number' ? d : d.day) !== dayNum);
                                                                                if (availableWeeks.length === 5) {
                                                                                    newAvailableDays.push(dayNum);
                                                                                } else if (availableWeeks.length > 0) {
                                                                                    newAvailableDays.push({ day: dayNum, weeks: availableWeeks });
                                                                                }
                                                                                setFormData({ ...formData, availableDays: newAvailableDays });
                                                                            }}
                                                                            className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition-all ${isWeekHoliday
                                                                                ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 shadow-sm'
                                                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                                                                }`}
                                                                            title={`第${week}週`}
                                                                        >
                                                                            {week}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic">※ 数字ボタンが赤色の週が休みになります。クリックして切り替えられます。</p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <input
                                        type="checkbox"
                                        id="isHelpStaff"
                                        checked={formData.isHelpStaff || false}
                                        onChange={e => setFormData({ ...formData, isHelpStaff: e.target.checked })}
                                        className="rounded-lg border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 h-5 w-5 bg-white dark:bg-slate-800"
                                    />
                                    <label htmlFor="isHelpStaff" className="text-sm font-bold text-slate-600 dark:text-slate-400 cursor-pointer">ヘルプ要員（不足時の補完に使用）</label>
                                </div>

                                <div className="flex space-x-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all font-bold uppercase tracking-widest text-xs"
                                    >
                                        Confirm & Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default StaffPage;

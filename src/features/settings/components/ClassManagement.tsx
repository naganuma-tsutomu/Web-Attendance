import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, UserCheck, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
    createClass, deleteClass, updateClass,
    saveShiftRequirements,
} from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import { useShiftRequirements, QUERY_KEYS } from '../../../lib/hooks';
import type { ShiftClass, Staff, ShiftRequirement } from '../../../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import ClassColorPicker, { CLASS_COLORS } from './ClassColorPicker';
import SortableRequirementRow from './SortableRequirementRow';
import NewClassModal from './NewClassModal';
import { SHIFT_DAY } from '../../../constants';

const createEmptyRequirement = (classId: string): ShiftRequirement => ({
    id: `temp-${crypto.randomUUID()}`,
    classId,
    dayOfWeek: SHIFT_DAY.WEEKDAYS,
    startTime: '09:00',
    endTime: '18:00',
    minStaffCount: 1,
    priority: 3,
});

interface ClassManagementProps {
    classes: ShiftClass[];
    staffs: Staff[];
    loading: boolean;
    onUpdate: () => void;
    setClasses: React.Dispatch<React.SetStateAction<ShiftClass[]>>;
}

const ClassManagement = ({ classes, staffs, loading, onUpdate }: ClassManagementProps) => {
    const queryClient = useQueryClient();
    const [selectedClassId, setSelectedClassId] = useState<string>('');

    // basic info inline form
    const [basicForm, setBasicForm] = useState({ name: '', color: CLASS_COLORS[0], auto_allocate: 1 });
    const [savedBasicForm, setSavedBasicForm] = useState({ name: '', color: CLASS_COLORS[0], auto_allocate: 1 });
    const [isSavingBasic, setIsSavingBasic] = useState(false);

    // new class modal
    const [showNewModal, setShowNewModal] = useState(false);
    const [newForm, setNewForm] = useState({ name: '', color: CLASS_COLORS[0], auto_allocate: 1 });
    const [isCreating, setIsCreating] = useState(false);

    // delete confirm
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // shift requirements
    const [requirements, setRequirements] = useState<ShiftRequirement[]>([]);
    const [savedRequirements, setSavedRequirements] = useState<ShiftRequirement[]>([]);
    const [saving, setSaving] = useState(false);
    const [deleteReqId, setDeleteReqId] = useState<string | null>(null);

    const { data: requirementsData, isLoading: reqLoading } = useShiftRequirements();

    useEffect(() => {
        if (!requirementsData) return;
        setRequirements(requirementsData);
        setSavedRequirements(requirementsData);
    }, [requirementsData]);

    useEffect(() => {
        if (classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);

    useEffect(() => {
        const cls = classes.find(c => c.id === selectedClassId);
        if (cls) {
            const form = { name: cls.name, color: cls.color || CLASS_COLORS[0], auto_allocate: cls.auto_allocate };
            setBasicForm(form);
            setSavedBasicForm(form);
        }
    }, [selectedClassId, classes]);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const staffCount = staffs.filter(s => s.classIds?.includes(selectedClassId)).length;
    const isBasicDirty = JSON.stringify(basicForm) !== JSON.stringify(savedBasicForm);

    const filteredRequirements = selectedClassId
        ? requirements.filter(r => r.classId === selectedClassId)
        : [];
    const isReqDirty = JSON.stringify(requirements) !== JSON.stringify(savedRequirements);

    const reqSensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // ── handlers: basic info ───────────────────────────────────────────────

    const handleSaveBasic = async () => {
        if (!selectedClassId || !basicForm.name.trim() || isSavingBasic) return;
        setIsSavingBasic(true);
        try {
            await updateClass(selectedClassId, basicForm);
            setSavedBasicForm(basicForm);
            toast.success('クラス情報を更新しました');
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classes });
            onUpdate();
        } catch (err) {
            handleApiError(err, '保存に失敗しました');
        } finally {
            setIsSavingBasic(false);
        }
    };

    const handleDeleteClass = async () => {
        if (!deleteConfirm || isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteClass(deleteConfirm.id);
            toast.success(`クラス「${deleteConfirm.name}」を削除しました`);
            setDeleteConfirm(null);
            setSelectedClassId('');
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classes });
            onUpdate();
        } catch (err) {
            handleApiError(err, '削除に失敗しました');
        } finally {
            setIsDeleting(false);
        }
    };

    // ── handlers: new class ────────────────────────────────────────────────

    const handleCreateClass = async () => {
        if (!newForm.name.trim() || isCreating) return;
        setIsCreating(true);
        try {
            await createClass(newForm.name, newForm.auto_allocate, newForm.color);
            toast.success(`クラス「${newForm.name}」を追加しました`);
            setShowNewModal(false);
            setNewForm({ name: '', color: CLASS_COLORS[0], auto_allocate: 1 });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classes });
            onUpdate();
        } catch (err) {
            handleApiError(err, '追加に失敗しました');
        } finally {
            setIsCreating(false);
        }
    };

    // ── handlers: requirements ─────────────────────────────────────────────

    const addTimeSlot = () => {
        if (!selectedClassId) return;
        setRequirements(prev => [...prev, createEmptyRequirement(selectedClassId)]);
    };

    const updateRequirement = (id: string, updates: Partial<ShiftRequirement>) => {
        setRequirements(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const filtered = requirements.filter(r => r.classId === selectedClassId);
        const others = requirements.filter(r => r.classId !== selectedClassId);
        const oldIndex = filtered.findIndex(r => r.id === active.id);
        const newIndex = filtered.findIndex(r => r.id === over.id);
        setRequirements([...others, ...arrayMove(filtered, oldIndex, newIndex)]);
    };

    const hasOverlappingSlots = (): boolean => {
        const sorted = [...requirements].sort((a, b) => {
            if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
            return a.startTime.localeCompare(b.startTime);
        });
        for (let i = 0; i < sorted.length - 1; i++) {
            const cur = sorted[i], nxt = sorted[i + 1];
            if (cur.classId === nxt.classId && cur.dayOfWeek === nxt.dayOfWeek) {
                if (cur.endTime > nxt.startTime && cur.startTime < nxt.endTime) return true;
            }
        }
        return false;
    };

    const handleSaveRequirements = async () => {
        const invalid = requirements.filter(r => !r.classId || !r.startTime || !r.endTime || r.minStaffCount < 1);
        if (invalid.length > 0) { toast.error('未入力の項目があります'); return; }
        const badTime = requirements.filter(r => r.startTime >= r.endTime);
        if (badTime.length > 0) { toast.error('終了時間は開始時間より後に設定してください'); return; }
        if (hasOverlappingSlots()) { toast.error('時間帯が重複しています'); return; }
        setSaving(true);
        try {
            await saveShiftRequirements(requirements);
            setSavedRequirements(requirements);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftRequirements });
            toast.success('保存しました');
        } catch (err) {
            handleApiError(err, '保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    // ── render ─────────────────────────────────────────────────────────────

    if (loading || reqLoading) {
        return (
            <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-sm font-medium">読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ① Class selector + add button */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                    {classes.length === 0 ? (
                        <p className="text-sm text-slate-400 dark:text-slate-500">クラスがまだ登録されていません</p>
                    ) : (
                        classes.map((cls) => {
                            const isActive = selectedClassId === cls.id;
                            const count = requirements.filter(r => r.classId === cls.id).length;
                            return (
                                <button
                                    key={cls.id}
                                    onClick={() => setSelectedClassId(cls.id)}
                                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                                        isActive
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <span
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: cls.color || '#818cf8' }}
                                    />
                                    <span>{cls.name}</span>
                                    {count > 0 && (
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                            isActive
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                        }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                    <button
                        onClick={() => { setNewForm({ name: '', color: CLASS_COLORS[0], auto_allocate: 1 }); setShowNewModal(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>新規追加</span>
                    </button>
                </div>
            </div>

            {selectedClass && (
                <>
                    {/* ② Basic info inline */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: basicForm.color }}
                            >
                                {basicForm.name.charAt(0) || selectedClass.name.charAt(0)}
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white">基本情報</h3>
                            {staffCount > 0 && (
                                <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg gap-1 ml-auto">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>所属スタッフ {staffCount}名</span>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-8 sm:px-10 space-y-8">
                            <div className="space-y-2.5">
                                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">クラス名</label>
                                <input
                                    type="text"
                                    value={basicForm.name}
                                    onChange={e => setBasicForm({ ...basicForm, name: e.target.value })}
                                    className="w-full sm:max-w-sm px-4 py-3.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-base dark:text-white transition-all outline-none font-bold"
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveBasic(); }}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">クラスカラー</label>
                                <ClassColorPicker value={basicForm.color} onChange={c => setBasicForm({ ...basicForm, color: c })} />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">自動割り当て</label>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setBasicForm({ ...basicForm, auto_allocate: basicForm.auto_allocate === 1 ? 0 : 1 })}
                                        className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 flex-shrink-0 ${
                                            basicForm.auto_allocate === 1 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                        role="switch"
                                        aria-checked={basicForm.auto_allocate === 1}
                                        aria-label="自動割り当てを有効にする"
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                                            basicForm.auto_allocate === 1 ? 'translate-x-7' : 'translate-x-1'
                                        }`} />
                                    </button>
                                    <span className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                                        {basicForm.auto_allocate === 1
                                            ? 'ON：シフト自動生成の対象になります'
                                            : 'OFF：手動配置専用（自動生成でスキップ）'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 pb-8 sm:px-10 flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm({ id: selectedClass.id, name: selectedClass.name })}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                削除
                            </button>
                            <button
                                onClick={handleSaveBasic}
                                disabled={isSavingBasic || !isBasicDirty || !basicForm.name.trim()}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                {isSavingBasic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                保存
                            </button>
                        </div>
                    </div>

                    {/* ③ Shift requirements section */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">必要人数設定</h3>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{filteredRequirements.length} 件</span>
                        </div>

                        {filteredRequirements.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                <p className="text-sm">時間帯の設定がありません</p>
                                <p className="text-xs mt-1 text-slate-400">「時間帯を追加」ボタンから設定を追加してください</p>
                            </div>
                        ) : (
                            <DndContext sensors={reqSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={filteredRequirements.map(r => r.id)} strategy={verticalListSortingStrategy}>
                                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {filteredRequirements.map((req, index) => (
                                            <SortableRequirementRow key={req.id} req={req} index={index}
                                                onUpdate={updateRequirement} onDeleteRequest={setDeleteReqId} />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}

                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <button onClick={addTimeSlot}
                                className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2">
                                <Plus className="w-5 h-5" /><span>時間帯を追加</span>
                            </button>
                        </div>
                    </div>

                    {/* requirements save */}
                    <div className="flex justify-end gap-3">
                        {isReqDirty && (
                            <button onClick={() => setRequirements(savedRequirements)} disabled={saving}
                                className="px-6 py-3 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                                キャンセル
                            </button>
                        )}
                        <button onClick={handleSaveRequirements} disabled={saving || !isReqDirty}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2">
                            {saving ? <><Loader2 className="w-5 h-5 animate-spin" /><span>保存中...</span></> : <span>必要人数を保存</span>}
                        </button>
                    </div>
                </>
            )}

            {/* ④ New class modal */}
            <NewClassModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                newForm={newForm}
                setNewForm={setNewForm}
                isCreating={isCreating}
                onSubmit={handleCreateClass}
            />

            {/* Delete class confirm */}
            <ConfirmModal
                isOpen={!!deleteConfirm}
                title="クラスの削除"
                message={`クラス「${deleteConfirm?.name}」を削除してもよろしいですか？この操作は取り消せません。`}
                confirmLabel="削除する"
                cancelLabel="キャンセル"
                onConfirm={handleDeleteClass}
                onCancel={() => setDeleteConfirm(null)}
                isLoading={isDeleting}
                variant="danger"
            />

            {/* Delete req confirm */}
            {deleteReqId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteReqId(null)} />
                    <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-white">時間帯を削除</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">この操作は取り消せません</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">この時間帯設定を削除しますか？</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteReqId(null)}
                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                キャンセル
                            </button>
                            <button onClick={() => { setRequirements(prev => prev.filter(r => r.id !== deleteReqId)); setDeleteReqId(null); }}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                                削除する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassManagement;

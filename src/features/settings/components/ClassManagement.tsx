import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
    createClass, deleteClass, updateClass,
    saveShiftRequirements,
} from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import { useShiftRequirements, QUERY_KEYS } from '../../../lib/hooks';
import type { ShiftClass, Staff, ShiftRequirement } from '../../../types';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { CLASS_COLORS } from './classColors';
import NewClassModal from './NewClassModal';
import ClassSelector from './ClassSelector';
import ClassBasicInfoCard from './ClassBasicInfoCard';
import ClassRequirementsCard from './ClassRequirementsCard';
import DeleteRequirementConfirm from './DeleteRequirementConfirm';
import RequirementTemplateManager from './RequirementTemplateManager';
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
    const [showDeleteAllRequirements, setShowDeleteAllRequirements] = useState(false);

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
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classes }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftRequirements }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftRequirementTemplates }),
            ]);
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

            <ClassSelector
                classes={classes}
                requirements={requirements}
                selectedClassId={selectedClassId}
                onSelect={setSelectedClassId}
                onAdd={() => {
                    setNewForm({ name: '', color: CLASS_COLORS[0], auto_allocate: 1 });
                    setShowNewModal(true);
                }}
            />

            <RequirementTemplateManager hasUnsavedChanges={isReqDirty} />

            {selectedClass && (
                <>
                    <ClassBasicInfoCard
                        selectedClass={selectedClass}
                        staffCount={staffCount}
                        form={basicForm}
                        setForm={setBasicForm}
                        isDirty={isBasicDirty}
                        isSaving={isSavingBasic}
                        onSave={handleSaveBasic}
                        onDelete={() => setDeleteConfirm({ id: selectedClass.id, name: selectedClass.name })}
                    />

                    <ClassRequirementsCard
                        requirements={filteredRequirements}
                        isDirty={isReqDirty}
                        isSaving={saving}
                        onAdd={addTimeSlot}
                        onUpdate={updateRequirement}
                        onDeleteRequest={setDeleteReqId}
                        onDeleteAllRequest={() => setShowDeleteAllRequirements(true)}
                        onDragEnd={handleDragEnd}
                        onCancel={() => setRequirements(savedRequirements)}
                        onSave={handleSaveRequirements}
                    />
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
            <DeleteRequirementConfirm
                isOpen={!!deleteReqId}
                onCancel={() => setDeleteReqId(null)}
                onConfirm={() => {
                    setRequirements(prev => prev.filter(r => r.id !== deleteReqId));
                    setDeleteReqId(null);
                }}
            />

            <ConfirmModal
                isOpen={showDeleteAllRequirements}
                title="必要人数設定の一括削除"
                message={`クラス「${selectedClass?.name ?? ''}」の必要人数設定 ${filteredRequirements.length}件をすべて削除します。続けますか？`}
                confirmLabel="一括削除する"
                cancelLabel="キャンセル"
                onConfirm={() => {
                    setRequirements(prev => prev.filter(r => r.classId !== selectedClassId));
                    setShowDeleteAllRequirements(false);
                }}
                onCancel={() => setShowDeleteAllRequirements(false)}
                variant="danger"
            />
        </div>
    );
};

export default ClassManagement;

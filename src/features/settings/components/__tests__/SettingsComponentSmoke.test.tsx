import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ClassBasicInfoCard, { type ClassBasicForm } from '../ClassBasicInfoCard';
import ClassRequirementsCard from '../ClassRequirementsCard';
import ClassSelector from '../ClassSelector';
import DisplayPreferencesSection from '../DisplayPreferencesSection';
import type { ShiftClass, ShiftRequirement } from '../../../../types';

const classes: ShiftClass[] = [
    { id: 'early', name: '早番', color: '#60a5fa', auto_allocate: 1, display_order: 1 },
    { id: 'late', name: '遅番', color: '#f87171', auto_allocate: 1, display_order: 2 },
];

const requirements: ShiftRequirement[] = [
    {
        id: 'req-1',
        classId: 'early',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        minStaffCount: 2,
        priority: 3,
    },
];

describe('settings component smoke tests', () => {
    it('renders class selector and routes selection/add actions', () => {
        const onSelect = vi.fn();
        const onAdd = vi.fn();

        render(
            <ClassSelector
                classes={classes}
                requirements={requirements}
                selectedClassId="early"
                onSelect={onSelect}
                onAdd={onAdd}
            />
        );

        expect(screen.getByText('早番')).toBeInTheDocument();
        expect(screen.getByText('遅番')).toBeInTheDocument();

        fireEvent.click(screen.getByText('遅番'));
        expect(onSelect).toHaveBeenCalledWith('late');

        fireEvent.click(screen.getByText('新規追加'));
        expect(onAdd).toHaveBeenCalled();
    });

    it('renders class basic info and wires edit/save/delete controls', () => {
        const onSave = vi.fn();
        const onDelete = vi.fn();
        const setForm = vi.fn();
        const form: ClassBasicForm = { name: '早番', color: '#60a5fa', auto_allocate: 1 };

        render(
            <ClassBasicInfoCard
                selectedClass={classes[0]}
                staffCount={3}
                form={form}
                setForm={setForm}
                isDirty={true}
                isSaving={false}
                onSave={onSave}
                onDelete={onDelete}
            />
        );

        expect(screen.getByText('基本情報')).toBeInTheDocument();
        expect(screen.getByText('所属スタッフ 3名')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('クラス名'), { target: { value: '中番' } });
        expect(setForm).toHaveBeenCalledWith({ ...form, name: '中番' });

        fireEvent.click(screen.getByText('保存'));
        expect(onSave).toHaveBeenCalled();

        fireEvent.click(screen.getByText('削除'));
        expect(onDelete).toHaveBeenCalled();
    });

    it('renders an empty requirements card and routes add/save actions', () => {
        const onAdd = vi.fn();
        const onSave = vi.fn();

        render(
            <ClassRequirementsCard
                requirements={[]}
                isDirty={true}
                isSaving={false}
                onAdd={onAdd}
                onUpdate={vi.fn()}
                onDeleteRequest={vi.fn()}
                onDragEnd={vi.fn()}
                onCancel={vi.fn()}
                onSave={onSave}
            />
        );

        expect(screen.getByText('必要人数設定')).toBeInTheDocument();
        expect(screen.getByText('時間帯の設定がありません')).toBeInTheDocument();

        fireEvent.click(screen.getByText('時間帯を追加'));
        expect(onAdd).toHaveBeenCalled();

        fireEvent.click(screen.getByText('必要人数を保存'));
        expect(onSave).toHaveBeenCalled();
    });

    it('renders display preferences and routes theme/week/save actions', () => {
        const onThemeChange = vi.fn();
        const onWeekStartsOnChange = vi.fn();
        const onSave = vi.fn();

        render(
            <DisplayPreferencesSection
                theme="light"
                weekStartsOn={1}
                autoOpenGenerationReport={true}
                modified={true}
                onThemeChange={onThemeChange}
                onWeekStartsOnChange={onWeekStartsOnChange}
                onAutoOpenGenerationReportChange={vi.fn()}
                onSave={onSave}
            />
        );

        expect(screen.getByText('カラーテーマ')).toBeInTheDocument();
        expect(screen.getByText('週の開始日')).toBeInTheDocument();

        fireEvent.click(screen.getByText('ダーク'));
        expect(onThemeChange).toHaveBeenCalledWith('dark');

        fireEvent.click(screen.getByText('日曜日'));
        expect(onWeekStartsOnChange).toHaveBeenCalledWith(0);

        fireEvent.click(screen.getByText('表示設定を保存'));
        expect(onSave).toHaveBeenCalled();
    });
});

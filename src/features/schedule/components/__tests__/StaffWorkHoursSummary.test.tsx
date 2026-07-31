import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffWorkHoursSummary from '../StaffWorkHoursSummary';
import type { Shift, Staff } from '../../../../types';

vi.mock('../../../../lib/hooks', () => ({
    useBreakSettings: () => ({ data: undefined }),
}));

const staff: Staff = {
    id: 'staff-1',
    name: 'テスト職員',
    role: 'role-1',
    classIds: [],
    hoursTarget: 160,
    weeklyHoursTarget: 40,
};

const sundayShift: Shift = {
    id: 'shift-1',
    date: '2025-05-04',
    staffId: staff.id,
    startTime: '09:00',
    endTime: '17:00',
    classType: 'class-1',
    isError: false,
};

describe('StaffWorkHoursSummary', () => {
    beforeEach(() => localStorage.clear());

    it('日曜開始設定では同じ週の日曜シフトを週間合計に含める', () => {
        localStorage.setItem('weekStartsOn', '0');
        render(
            <StaffWorkHoursSummary
                staffs={[staff]}
                shifts={[sundayShift]}
                isOpen
                viewDate={new Date('2025-05-07T00:00:00')}
            />
        );

        expect(screen.getByText('8.0h / 40h')).toBeInTheDocument();
    });

    it('月曜開始設定では前日曜のシフトを週間合計に含めない', () => {
        localStorage.setItem('weekStartsOn', '1');
        render(
            <StaffWorkHoursSummary
                staffs={[staff]}
                shifts={[sundayShift]}
                isOpen
                viewDate={new Date('2025-05-07T00:00:00')}
            />
        );

        expect(screen.getByText('0.0h / 40h')).toBeInTheDocument();
    });
});

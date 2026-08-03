import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PreferenceTab from './PreferenceTab';
import type { BusinessDayOverride, Holiday } from '../../../types';

const renderTab = (businessDayOverrides: BusinessDayOverride[], holidays: Holiday[] = []) => render(
    <PreferenceTab
        staff={{ id: 'staff-1', name: 'テストスタッフ' }}
        currentMonth={new Date(2026, 7, 1)}
        days={[new Date(2026, 7, 2), new Date(2026, 7, 3), new Date(2026, 7, 11)]}
        preferences={[]}
        setPreferences={vi.fn()}
        savedPreferences={[]}
        setSavedPreferences={vi.fn()}
        setMessage={vi.fn()}
        myShifts={[]}
        holidays={holidays}
        businessDayOverrides={businessDayOverrides}
        myAvailableDays={[0, 1, 2, 3, 4, 5, 6]}
        closedDays={[0]}
    />
);

describe('PreferenceTab business day overrides', () => {
    it('個別営業にした日曜日を希望休として選択できる', () => {
        renderTab([{ id: 'open-sunday', date: '2026-08-02', status: 'open', name: '臨時営業' }]);

        expect(screen.getByText('2').closest('button')).not.toBeDisabled();
    });

    it('個別休業日は設定名を表示して選択できない', () => {
        renderTab([{ id: 'summer-close', date: '2026-08-03', status: 'closed', name: '夏季休業' }]);

        expect(screen.getByText('夏季休業')).toBeInTheDocument();
        expect(screen.getByText('夏季休業').closest('button')).toBeDisabled();
    });

    it('祝日を個別営業日にしても赤色で表示する', () => {
        renderTab(
            [{ id: 'open-holiday', date: '2026-08-11', status: 'open', name: '祝日営業' }],
            [{ id: 'holiday', date: '2026-08-11', name: '山の日', type: 'national', isWorkday: false }]
        );

        const button = screen.getByText('11').closest('button');
        expect(button).not.toBeDisabled();
        expect(button).toHaveClass('text-red-600');
        expect(button).toHaveTextContent('祝日営業');
    });
});

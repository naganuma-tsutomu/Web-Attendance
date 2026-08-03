import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CalendarGrid from './CalendarGrid';
import type { DayStatus } from '../types';

const days: DayStatus[] = [
    { dateStr: '2026-08-02', dayOfWeek: '日', isHoliday: true, status: 'available' },
    { dateStr: '2026-08-03', dayOfWeek: '月', isHoliday: true, holidayName: '夏季休業', status: 'available' },
    { dateStr: '2026-08-04', dayOfWeek: '火', isHoliday: false, status: 'available' },
    { dateStr: '2026-08-11', dayOfWeek: '火', isHoliday: false, isNationalHoliday: true, holidayName: '祝日営業', businessDayStatus: 'open', businessDayReason: 'override', status: 'available' },
];

describe('CalendarGrid', () => {
    it('日曜日を含め、施設休業日は理由付きで表示する', () => {
        render(<CalendarGrid preferences={days} prefLoading={false} handleDateClick={vi.fn()} />);

        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('2').closest('button')).toBeDisabled();
        expect(screen.getByTitle('夏季休業')).toHaveTextContent('夏季休業');
        expect(screen.getByTitle('夏季休業')).toBeDisabled();
        expect(screen.getByText('4').closest('button')).not.toBeDisabled();
    });

    it('祝日を個別営業日にしても日付は赤色で表示する', () => {
        render(<CalendarGrid preferences={days} prefLoading={false} handleDateClick={vi.fn()} />);

        const openHoliday = screen.getByTitle('祝日営業');
        expect(openHoliday).not.toBeDisabled();
        expect(openHoliday).toHaveTextContent('営業');
        expect(screen.getByText('11')).toHaveClass('text-red-500');
    });
});

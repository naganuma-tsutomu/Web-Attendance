import { describe, expect, it } from 'vitest';
import { resolveBusinessDay } from '../businessDayUtils';
import type { BusinessDayOverride, Holiday } from '../../types';

const date = new Date(2026, 7, 2); // Sunday
const holiday: Holiday = { id: 'h1', date: '2026-08-02', name: '祝日', type: 'national', isWorkday: false };
const override = (status: 'open' | 'closed'): BusinessDayOverride => ({ id: 'o1', date: '2026-08-02', status, name: status === 'open' ? '臨時営業' : '夏季休業' });

describe('resolveBusinessDay', () => {
    it('returns normal weekdays as open', () => {
        expect(resolveBusinessDay({ date: new Date(2026, 7, 3), dateStr: '2026-08-03', closedDays: [0] }).isOpen).toBe(true);
    });
    it('returns weekly closed days as closed', () => {
        expect(resolveBusinessDay({ date, dateStr: '2026-08-02', closedDays: [0] }).reason).toBe('weekly_closed');
    });
    it('respects the holiday closed-day setting', () => {
        expect(resolveBusinessDay({ date, dateStr: '2026-08-02', closedDays: [7], holiday }).isOpen).toBe(false);
        expect(resolveBusinessDay({ date, dateStr: '2026-08-02', closedDays: [], holiday }).isOpen).toBe(true);
    });
    it('allows an override to open a weekly closed holiday', () => {
        expect(resolveBusinessDay({ date, dateStr: '2026-08-02', closedDays: [0, 7], holiday, override: override('open') }).isOpen).toBe(true);
    });
    it('allows an override to close a normal business day', () => {
        expect(resolveBusinessDay({ date: new Date(2026, 7, 3), dateStr: '2026-08-03', closedDays: [], override: override('closed') }).isOpen).toBe(false);
    });
});

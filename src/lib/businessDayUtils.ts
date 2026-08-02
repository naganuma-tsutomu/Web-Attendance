import type { BusinessDayOverride, Holiday } from '../types';

export interface BusinessDayResolution {
    isOpen: boolean;
    reason: 'override' | 'holiday' | 'weekly_closed' | 'normal';
    label?: string;
    override?: BusinessDayOverride;
    holiday?: Holiday;
}

export const createBusinessDayOverrideMap = (overrides: BusinessDayOverride[]): Map<string, BusinessDayOverride> =>
    new Map(overrides.map(item => [item.date, item]));

export function resolveBusinessDay(params: {
    date: Date;
    dateStr: string;
    closedDays: number[];
    holiday?: Holiday;
    override?: BusinessDayOverride;
}): BusinessDayResolution {
    const { date, closedDays, holiday, override } = params;
    if (override) {
        return { isOpen: override.status === 'open', reason: 'override', label: override.name, override, holiday };
    }
    if (holiday && !holiday.isWorkday && closedDays.includes(7)) {
        return { isOpen: false, reason: 'holiday', label: holiday.name, holiday };
    }
    if (closedDays.includes(date.getDay())) {
        return { isOpen: false, reason: 'weekly_closed', label: '固定休館日', holiday };
    }
    return { isOpen: true, reason: 'normal', holiday };
}

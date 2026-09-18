import type { Env } from '../types';
import { createValidationError, handleServerError, validateYearMonth } from '../utils/validation';
import { onRequestGet as getStaffs } from './staffs/index';
import { onRequestGet as getClasses } from './settings/classes/index';
import { onRequestGet as getTimePatterns } from './settings/time-patterns/index';
import { onRequestGet as getRoles } from './settings/roles/index';
import { onRequestGet as getShiftRequirements } from './settings/shift-requirements/index';
import { onRequestGet as getBusinessHours } from './settings/business-hours';
import { onRequestGet as getExcelSettings } from './settings/excel-settings';
import { onRequestGet as getBreakSettings } from './settings/break-rules';
import { onRequestGet as getSchedulePreferences } from './settings/schedule-preferences';
import { onRequestGet as getShifts } from './shifts/index';
import { onRequestGet as getPreferences } from './preferences/index';
import { onRequestGet as getFixedDates } from './fixed-dates/index';
import { onRequestGet as getHolidays } from './settings/holidays/index';
import { onRequestGet as getBusinessDayOverrides } from './settings/business-day-overrides/index';

type GetHandler = PagesFunction<Env>;
type GetContext = Parameters<GetHandler>[0];

const invokeJsonGet = async (
    context: GetContext,
    handler: GetHandler,
    path: string,
): Promise<unknown> => {
    const response = await handler({
        ...context,
        request: new Request(new URL(path, context.request.url), context.request),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`${path} returned ${response.status}: ${body.slice(0, 300)}`);
    }
    return response.json();
};

/**
 * GET /api/schedule-bootstrap?month=YYYY-MM[&month=YYYY-MM]
 *
 * スケジュール初期表示に必要な既存GET群をサーバー側で集約する。
 * 各GETハンドラーを再利用し、個別APIと同じ正規化・デフォルト値を維持する。
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const requestedMonths = url.searchParams.getAll('month');
        if (requestedMonths.length === 0 || requestedMonths.length > 3) {
            return createValidationError('monthは1〜3件指定してください');
        }

        const months = Array.from(new Set(requestedMonths));
        for (const month of months) {
            const error = validateYearMonth(month);
            if (error) return createValidationError(error);
        }
        const years = Array.from(new Set(months.map(month => Number(month.slice(0, 4)))));

        // 1つのWorker内でD1クエリを過剰に並列化しないよう、小分けに取得する。
        const [staffs, classes, timePatterns] = await Promise.all([
            invokeJsonGet(context, getStaffs, '/api/staffs'),
            invokeJsonGet(context, getClasses, '/api/settings/classes'),
            invokeJsonGet(context, getTimePatterns, '/api/settings/time-patterns'),
        ]);
        const [roles, businessHours, excelSettings] = await Promise.all([
            invokeJsonGet(context, getRoles, '/api/settings/roles'),
            invokeJsonGet(context, getBusinessHours, '/api/settings/business-hours'),
            invokeJsonGet(context, getExcelSettings, '/api/settings/excel-settings'),
        ]);
        const [breakSettings, schedulePreferences, shiftRequirements] = await Promise.all([
            invokeJsonGet(context, getBreakSettings, '/api/settings/break-rules'),
            invokeJsonGet(context, getSchedulePreferences, '/api/settings/schedule-preferences'),
            invokeJsonGet(context, getShiftRequirements, '/api/settings/shift-requirements'),
        ]);

        const monthEntries: Array<[string, unknown]> = [];
        for (const month of months) {
            const encodedMonth = encodeURIComponent(month);
            const [shifts, preferences, fixedDates, businessDayOverrides] = await Promise.all([
                invokeJsonGet(context, getShifts, `/api/shifts?yearMonth=${encodedMonth}`),
                invokeJsonGet(context, getPreferences, `/api/preferences?yearMonth=${encodedMonth}`),
                invokeJsonGet(context, getFixedDates, `/api/fixed-dates?yearMonth=${encodedMonth}`),
                invokeJsonGet(context, getBusinessDayOverrides, `/api/settings/business-day-overrides?yearMonth=${encodedMonth}`),
            ]);
            monthEntries.push([month, { shifts, preferences, fixedDates, businessDayOverrides }]);
        }

        const holidayEntries: Array<readonly [string, unknown]> = [];
        for (const year of years) {
            holidayEntries.push([
                String(year),
                await invokeJsonGet(context, getHolidays, `/api/settings/holidays?year=${year}`),
            ]);
        }

        return Response.json({
            references: {
                staffs,
                classes,
                timePatterns,
                roles,
                businessHours,
                excelSettings,
                breakSettings,
                schedulePreferences,
                shiftRequirements,
            },
            months: Object.fromEntries(monthEntries),
            holidays: Object.fromEntries(holidayEntries),
        }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        return handleServerError(error, 'GET /schedule-bootstrap');
    }
};

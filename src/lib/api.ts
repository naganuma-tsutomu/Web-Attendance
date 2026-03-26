import { z } from 'zod';
import type { Staff, ShiftPreference, Shift, ShiftTimePattern, DynamicRole, ShiftClass, ShiftRequirement, Holiday, BusinessHours, ExcelSettings } from '../types';
import { 
    StaffSchema, ShiftPreferenceSchema, ShiftSchema, ShiftTimePatternSchema, 
    DynamicRoleSchema, ShiftClassSchema, ShiftRequirementSchema, HolidaySchema, BusinessHoursSchema, ExcelSettingsSchema
} from '../types/schemas';
import { getLastHolidaySyncDate, setLastHolidaySyncDate } from '../utils/dateUtils';

const API_BASE = '/api';

type ParseableSchema = {
    safeParse(data: unknown): { success: boolean; data?: unknown; error?: { format(): unknown } };
};

/**
 * 共通のAPIリクエスト関数
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}, schema?: ParseableSchema): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) return {} as T;
    
    const data = await response.json();
    
    if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
            const formatted = result.error?.format();
            if (import.meta.env.DEV) {
                // 開発環境ではエラーをスローして即座に気づけるようにする
                console.error(`[API Validation Error] ${endpoint}:`, formatted);
                throw new Error(`API レスポンスの型が不正です: ${endpoint}`);
            } else {
                // 本番環境では警告のみに留め、UIを壊さない
                console.warn(`[API Validation Error] ${endpoint}:`, formatted);
            }
            return data as T;
        }
        // パース成功時は Zod が正規化した値を返す（型安全）
        return result.data as T;
    }
    
    return data as T;
}

// ==========================================
// Staff API
// ==========================================

export const getStaffList = async (): Promise<Staff[]> => {
    return apiFetch<Staff[]>('/staffs', {}, z.array(StaffSchema));
};

export const getStaffNameList = async (): Promise<{ id: string, name: string }[]> => {
    return apiFetch<{ id: string, name: string }[]>('/staffs/list');
};

export const createStaff = async (staffData: Omit<Staff, 'id'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/staffs', {
        method: 'POST',
        body: JSON.stringify(staffData)
    });
    return id;
};

export const updateStaff = async (staffId: string, staffData: Partial<Staff>): Promise<void> => {
    await apiFetch(`/staffs/${staffId}`, {
        method: 'PUT',
        body: JSON.stringify(staffData)
    });
};

export const deleteStaff = async (staffId: string): Promise<void> => {
    await apiFetch(`/staffs/${staffId}`, {
        method: 'DELETE'
    });
};

export const updateStaffOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    await apiFetch('/staffs/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    });
};

// ==========================================
// ShiftPreference API
// ==========================================

export const getPreferencesByMonth = async (yearMonth: string): Promise<ShiftPreference[]> => {
    return apiFetch<ShiftPreference[]>(`/preferences?yearMonth=${yearMonth}`, {}, z.array(ShiftPreferenceSchema));
};

export const savePreference = async (preference: Omit<ShiftPreference, 'id'>): Promise<void> => {
    await apiFetch('/preferences', {
        method: 'POST',
        body: JSON.stringify(preference)
    });
};

export const updatePreferences = async (data: Omit<ShiftPreference, 'id'>): Promise<void> => {
    await apiFetch('/preferences', {
        method: 'POST',
        body: JSON.stringify(data)
    });
};

// ==========================================
// Shifts API
// ==========================================

export const getShiftsByMonth = async (yearMonth: string): Promise<Shift[]> => {
    return apiFetch<Shift[]>(`/shifts?yearMonth=${yearMonth}`, {}, z.array(ShiftSchema));
};

export const saveShiftsBatch = async (shifts: Omit<Shift, 'id'>[]): Promise<void> => {
    await apiFetch('/shifts', {
        method: 'POST',
        body: JSON.stringify(shifts)
    });
};

export const deleteShiftsByMonth = async (yearMonth: string, exceptDates: string[] = []): Promise<void> => {
    await apiFetch('/shifts/clear', {
        method: 'POST',
        body: JSON.stringify({ yearMonth, exceptDates })
    });
};

export const updateShift = async (id: string, shiftData: Partial<Shift>): Promise<void> => {
    await apiFetch(`/shifts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(shiftData)
    });
};

export const deleteShift = async (id: string): Promise<void> => {
    await apiFetch(`/shifts/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

// ==========================================
// Shift Time Patterns API (勤務時間パターン)
// ==========================================

export const getTimePatterns = async (): Promise<ShiftTimePattern[]> => {
    return apiFetch<ShiftTimePattern[]>('/settings/time-patterns', {}, z.array(ShiftTimePatternSchema));
};

export const createTimePattern = async (pattern: Omit<ShiftTimePattern, 'id'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/time-patterns', {
        method: 'POST',
        body: JSON.stringify(pattern)
    });
    return id;
};

export const deleteTimePattern = async (id: string): Promise<void> => {
    await apiFetch(`/settings/time-patterns/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const updateTimePattern = async (id: string, pattern: Partial<ShiftTimePattern>): Promise<void> => {
    await apiFetch(`/settings/time-patterns/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(pattern)
    });
};

export const updateTimePatternOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    await apiFetch('/settings/time-patterns/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    });
};

// ==========================================
// Roles API (動的スタッフ区分管理)
// ==========================================

export const getRoles = async (): Promise<DynamicRole[]> => {
    return apiFetch<DynamicRole[]>('/settings/roles', {}, z.array(DynamicRoleSchema));
};

export const createRole = async (name: string, targetHours: number | null = null, patternIds: string[] = [], weeklyHoursTarget: number | null = null): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/roles', {
        method: 'POST',
        body: JSON.stringify({ name, targetHours, patternIds, weeklyHoursTarget })
    });
    return id;
};

export const updateRole = async (roleId: string, data: { name?: string, targetHours?: number | null, weeklyHoursTarget?: number | null, patternIds?: string[] }): Promise<void> => {
    await apiFetch(`/settings/roles/${encodeURIComponent(roleId)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const deleteRole = async (id: string): Promise<void> => {
    await apiFetch(`/settings/roles/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const updateRolePatterns = async (roleId: string, patternIds: string[]): Promise<void> => {
    return updateRole(roleId, { patternIds });
};

export const updateRoleOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    await apiFetch('/settings/roles/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    });
};

// ==========================================
// Classes API (クラス管理)
// ==========================================

export const getClasses = async (): Promise<ShiftClass[]> => {
    return apiFetch<ShiftClass[]>('/settings/classes', {}, z.array(ShiftClassSchema));
};

export const createClass = async (name: string, autoAllocate: number = 1, color?: string): Promise<{ id: string }> => {
    return apiFetch<{ id: string }>('/settings/classes', {
        method: 'POST',
        body: JSON.stringify({ name, auto_allocate: autoAllocate, color })
    });
};

export const updateClass = async (id: string, data: { name?: string, display_order?: number, auto_allocate?: number, color?: string }): Promise<void> => {
    await apiFetch(`/settings/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const updateClassOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    await apiFetch('/settings/classes/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    });
};

export const deleteClass = async (id: string): Promise<void> => {
    await apiFetch(`/settings/classes/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

// ==========================================
// Shift Requirements API (必要人数設定)
// ==========================================

export const getShiftRequirements = async (): Promise<ShiftRequirement[]> => {
    return apiFetch<ShiftRequirement[]>('/settings/shift-requirements', {}, z.array(ShiftRequirementSchema));
};

export const saveShiftRequirements = async (requirements: ShiftRequirement[]): Promise<void> => {
    await apiFetch('/settings/shift-requirements', {
        method: 'POST',
        body: JSON.stringify(requirements)
    });
};

export const deleteShiftRequirement = async (id: string): Promise<void> => {
    await apiFetch(`/settings/shift-requirements/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

// ==========================================
// Holidays API (祝日管理)
// ==========================================

export const getHolidays = async (year?: number): Promise<Holiday[]> => {
    const url = year
        ? `/settings/holidays?year=${year}`
        : '/settings/holidays';
    return apiFetch<Holiday[]>(url, {}, z.array(HolidaySchema));
};

export const createHoliday = async (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/holidays', {
        method: 'POST',
        body: JSON.stringify(holiday)
    });
    return id;
};

export const updateHoliday = async (id: string, data: Partial<Holiday>): Promise<void> => {
    await apiFetch(`/settings/holidays/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const deleteHoliday = async (id: string): Promise<void> => {
    await apiFetch(`/settings/holidays/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const syncHolidays = async (year?: number): Promise<{ success: boolean; message: string; synced: number; skipped: number }> => {
    const url = year
        ? `/settings/holidays/sync?year=${year}`
        : '/settings/holidays/sync';
    return apiFetch<{ success: boolean; message: string; synced: number; skipped: number }>(url);
};

export const syncHolidaysIfNeeded = async (): Promise<void> => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastSyncStr = getLastHolidaySyncDate();
        if (lastSyncStr === todayStr) {
            return;
        }
        
        await syncHolidays();
        setLastHolidaySyncDate(todayStr);
    } catch (err) {
        console.error('Failed to sync holidays during daily background check', err);
    }
};

// ==========================================
// Fixed Dates API (シフト固定状態管理)
// ==========================================

export const getFixedDates = async (yearMonth: string): Promise<string[]> => {
    return apiFetch<string[]>(`/fixed-dates?yearMonth=${yearMonth}`);
};

export const saveFixedDates = async (yearMonth: string, dates: string[]): Promise<void> => {
    await apiFetch('/fixed-dates', {
        method: 'POST',
        body: JSON.stringify({ yearMonth, dates })
    });
};

// ==========================================
// Business Hours API (営業時間設定)
// ==========================================

export const getBusinessHours = async (): Promise<BusinessHours> => {
    return apiFetch<BusinessHours>('/settings/business-hours', {}, BusinessHoursSchema);
};

export const updateBusinessHours = async (data: BusinessHours): Promise<void> => {
    await apiFetch('/settings/business-hours', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

// ==========================================
// Excel Settings API (Excel出力設定)
// ==========================================

export const getExcelSettings = async (): Promise<ExcelSettings> => {
    return apiFetch<ExcelSettings>('/settings/excel-settings', {}, ExcelSettingsSchema);
};

export const updateExcelSettings = async (data: ExcelSettings): Promise<void> => {
    await apiFetch('/settings/excel-settings', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

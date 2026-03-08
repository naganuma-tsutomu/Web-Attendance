import type { Staff, ShiftPreference, Shift, ShiftTimePattern, DynamicRole, ShiftClass, ShiftRequirement, Holiday } from '../types';

const API_BASE = '/api';

/**
 * 共通のAPIリクエスト関数
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
        throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    // 共通のパース処理
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {} as T;
    } catch (e) {
        // JSONでない場合はテキストをそのまま返すか、空オブジェクトを返す
        return { message: text } as unknown as T;
    }
}

// ==========================================
// Staff API
// ==========================================

export const getStaffList = async (): Promise<Staff[]> => {
    return apiFetch<Staff[]>('/staffs');
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
    return apiFetch<ShiftPreference[]>(`/preferences?yearMonth=${yearMonth}`);
};

export const savePreference = async (preference: Omit<ShiftPreference, 'id'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/preferences', {
        method: 'POST',
        body: JSON.stringify(preference)
    });
    return id;
};

// ==========================================
// Shifts API
// ==========================================

export const getShiftsByMonth = async (yearMonth: string): Promise<Shift[]> => {
    return apiFetch<Shift[]>(`/shifts?yearMonth=${yearMonth}`);
};

export const saveShiftsBatch = async (shifts: Omit<Shift, 'id'>[]): Promise<void> => {
    await apiFetch('/shifts', {
        method: 'POST',
        body: JSON.stringify(shifts)
    });
};

export const deleteShiftsByMonth = async (yearMonth: string): Promise<void> => {
    await apiFetch(`/shifts?yearMonth=${yearMonth}`, {
        method: 'DELETE',
        credentials: 'include'
    } as RequestInit);
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
    return apiFetch<ShiftTimePattern[]>('/settings/time-patterns', { credentials: 'include' } as RequestInit);
};

export const createTimePattern = async (pattern: Omit<ShiftTimePattern, 'id'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/time-patterns', {
        method: 'POST',
        body: JSON.stringify(pattern),
        credentials: 'include'
    } as RequestInit);
    return id;
};

export const deleteTimePattern = async (id: string): Promise<void> => {
    await apiFetch(`/settings/time-patterns/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    } as RequestInit);
};

export const updateTimePattern = async (id: string, pattern: Partial<Omit<ShiftTimePattern, 'id'>>): Promise<void> => {
    await apiFetch(`/settings/time-patterns/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(pattern),
        credentials: 'include'
    } as RequestInit);
};

// ==========================================
// Roles API (動的役職管理)
// ==========================================

export const getRoles = async (): Promise<DynamicRole[]> => {
    return apiFetch<DynamicRole[]>('/settings/roles', { credentials: 'include' } as RequestInit);
};

export const createRole = async (name: string, targetHours: number | null = null, patternIds: string[] = []): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/roles', {
        method: 'POST',
        body: JSON.stringify({ name, targetHours, patternIds }),
        credentials: 'include'
    } as RequestInit);
    return id;
};

export const updateRole = async (roleId: string, data: { name?: string, targetHours?: number | null, patternIds?: string[] }): Promise<void> => {
    await apiFetch(`/settings/roles/${encodeURIComponent(roleId)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        credentials: 'include'
    } as RequestInit);
};

export const deleteRole = async (id: string): Promise<void> => {
    await apiFetch(`/settings/roles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    } as RequestInit);
};

export const updateRolePatterns = async (roleId: string, patternIds: string[]): Promise<void> => {
    return updateRole(roleId, { patternIds });
};

// ==========================================
// Classes API (クラス管理)
// ==========================================

export const getClasses = async (): Promise<ShiftClass[]> => {
    return apiFetch<ShiftClass[]>('/settings/classes');
};

export const createClass = async (name: string, autoAllocate: number = 1): Promise<{ id: string }> => {
    return apiFetch<{ id: string }>('/settings/classes', {
        method: 'POST',
        body: JSON.stringify({ name, auto_allocate: autoAllocate })
    });
};

export const updateClass = async (id: string, data: { name?: string, display_order?: number, auto_allocate?: number }): Promise<void> => {
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
        method: 'DELETE',
        credentials: 'include'
    } as RequestInit);
};

// ==========================================
// Shift Requirements API (必要人数設定)
// ==========================================

export const getShiftRequirements = async (): Promise<ShiftRequirement[]> => {
    const res = await fetch(`${API_BASE}/settings/shift-requirements`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch shift requirements');
    return res.json();
};

export const saveShiftRequirements = async (requirements: ShiftRequirement[]): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/shift-requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requirements),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to save shift requirements');
};

export const deleteShiftRequirement = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/shift-requirements/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete shift requirement');
};

// ==========================================
// Holidays API (祝日管理)
// ==========================================

export const getHolidays = async (year?: number): Promise<Holiday[]> => {
    const url = year
        ? `${API_BASE}/settings/holidays?year=${year}`
        : `${API_BASE}/settings/holidays`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch holidays');
    return res.json();
};

export const createHoliday = async (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    const res = await fetch(`${API_BASE}/settings/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holiday),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to create holiday');
    const { id } = await res.json();
    return id;
};

export const updateHoliday = async (id: string, data: Partial<Holiday>): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/holidays/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to update holiday');
};

export const deleteHoliday = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/holidays/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete holiday');
};

export const syncHolidays = async (year?: number): Promise<{ success: boolean; message: string; synced: number; skipped: number }> => {
    const url = year
        ? `${API_BASE}/settings/holidays/sync?year=${year}`
        : `${API_BASE}/settings/holidays/sync`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to sync holidays');
    return res.json();
};

import type { Staff, ShiftPreference, Shift, ShiftTimePattern, DynamicRole, ShiftClass, ShiftRequirement } from '../types';

const API_BASE = '/api';

// ==========================================
// Staff API
// ==========================================

export const getStaffList = async (): Promise<Staff[]> => {
    const res = await fetch(`${API_BASE}/staffs`);
    if (!res.ok) throw new Error('Failed to fetch staffs');
    return res.json();
};

export const createStaff = async (staffData: Omit<Staff, 'id'>): Promise<string> => {
    const res = await fetch(`${API_BASE}/staffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
    });
    if (!res.ok) throw new Error('Failed to create staff');
    const { id } = await res.json();
    return id;
};

export const updateStaff = async (staffId: string, staffData: Partial<Staff>): Promise<void> => {
    const res = await fetch(`${API_BASE}/staffs/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
    });
    if (!res.ok) throw new Error('Failed to update staff');
};

export const deleteStaff = async (staffId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/staffs/${staffId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete staff');
};

export const updateStaffOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    const res = await fetch(`${API_BASE}/staffs/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
    });
    if (!res.ok) throw new Error('Failed to update staff order');
};

// ==========================================
// ShiftPreference API
// ==========================================

export const getPreferencesByMonth = async (yearMonth: string): Promise<ShiftPreference[]> => {
    const res = await fetch(`${API_BASE}/preferences?yearMonth=${yearMonth}`);
    if (!res.ok) throw new Error('Failed to fetch preferences');
    return res.json();
};

export const savePreference = async (preference: Omit<ShiftPreference, 'id'>): Promise<string> => {
    const res = await fetch(`${API_BASE}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preference)
    });
    if (!res.ok) throw new Error('Failed to save preference');
    const { id } = await res.json();
    return id;
};

// ==========================================
// Shifts API
// ==========================================

export const getShiftsByMonth = async (yearMonth: string): Promise<Shift[]> => {
    const res = await fetch(`${API_BASE}/shifts?yearMonth=${yearMonth}`);
    if (!res.ok) throw new Error('Failed to fetch shifts');
    return res.json();
};

export const saveShiftsBatch = async (shifts: Omit<Shift, 'id'>[]): Promise<void> => {
    const res = await fetch(`${API_BASE}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shifts)
    });
    if (!res.ok) throw new Error('Failed to batch insert shifts');
};

export const deleteShiftsByMonth = async (yearMonth: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/shifts?yearMonth=${yearMonth}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete shifts');
};

export const updateShift = async (id: string, shiftData: Partial<Shift>): Promise<void> => {
    const res = await fetch(`${API_BASE}/shifts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
    });
    if (!res.ok) throw new Error('Failed to update shift');
};

export const deleteShift = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/shifts/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete shift');
};

// ==========================================
// Shift Time Patterns API (勤務時間パターン)
// ==========================================

export const getTimePatterns = async (): Promise<ShiftTimePattern[]> => {
    const res = await fetch(`${API_BASE}/settings/time-patterns`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch time patterns');
    return res.json();
};

export const createTimePattern = async (pattern: Omit<ShiftTimePattern, 'id'>): Promise<string> => {
    const res = await fetch(`${API_BASE}/settings/time-patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to create time pattern');
    const { id } = await res.json();
    return id;
};

export const deleteTimePattern = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/time-patterns/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete time pattern');
};

// ==========================================
// Roles API (動的役職管理)
// ==========================================

export const getRoles = async (): Promise<DynamicRole[]> => {
    const res = await fetch(`${API_BASE}/settings/roles`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch roles');
    return res.json();
};

export const createRole = async (name: string, targetHours: number | null = null, patternIds: string[] = []): Promise<string> => {
    const res = await fetch(`${API_BASE}/settings/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targetHours, patternIds }),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to create role');
    const { id } = await res.json();
    return id;
};

export const updateRole = async (roleId: string, data: { name?: string, targetHours?: number | null, patternIds?: string[] }): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/roles/${encodeURIComponent(roleId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to update role');
};

export const deleteRole = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/roles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete role');
};

export const updateRolePatterns = async (roleId: string, patternIds: string[]): Promise<void> => {
    return updateRole(roleId, { patternIds });
};

// ==========================================
// Classes API (クラス管理)
// ==========================================

export const getClasses = async (): Promise<ShiftClass[]> => {
    const res = await fetch('/api/settings/classes');
    if (!res.ok) throw new Error('Failed to fetch classes');
    return res.json();
};

export const createClass = async (name: string, autoAllocate: number = 1): Promise<{ id: string }> => {
    const res = await fetch('/api/settings/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, auto_allocate: autoAllocate })
    });
    if (!res.ok) throw new Error('Failed to create class');
    return res.json();
};

export const updateClass = async (id: string, data: { name?: string, display_order?: number, auto_allocate?: number }): Promise<void> => {
    const res = await fetch(`/api/settings/classes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update class');
};

export const updateClassOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/classes/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
    });
    if (!res.ok) throw new Error('Failed to update class order');
};

export const deleteClass = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/classes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete class');
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

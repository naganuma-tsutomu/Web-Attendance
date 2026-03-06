import type { Staff, ShiftPreference, Shift } from '../types';

const API_BASE = '/api';

// ==========================================
// Staff API
// ==========================================

export const getStaffList = async (): Promise<Staff[]> => {
    const res = await fetch(`${API_BASE}/staffs`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch staffs');
    return res.json();
};

export const createStaff = async (staffData: Omit<Staff, 'id'>): Promise<string> => {
    const res = await fetch(`${API_BASE}/staffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to create staff');
    const { id } = await res.json();
    return id;
};

export const updateStaff = async (staffId: string, staffData: Partial<Staff>): Promise<void> => {
    const res = await fetch(`${API_BASE}/staffs/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to update staff');
};

export const deleteStaff = async (staffId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/staffs/${staffId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete staff');
};

// ==========================================
// ShiftPreference API
// ==========================================

export const getPreferencesByMonth = async (yearMonth: string): Promise<ShiftPreference[]> => {
    const res = await fetch(`${API_BASE}/preferences?yearMonth=${yearMonth}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch preferences');
    return res.json();
};

export const savePreference = async (preference: Omit<ShiftPreference, 'id'>): Promise<string> => {
    const res = await fetch(`${API_BASE}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preference),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to save preference');
    const { id } = await res.json();
    return id;
};

// ==========================================
// Shifts API
// ==========================================

export const getShiftsByMonth = async (yearMonth: string): Promise<Shift[]> => {
    const res = await fetch(`${API_BASE}/shifts?yearMonth=${yearMonth}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch shifts');
    return res.json();
};

export const saveShiftsBatch = async (shifts: Omit<Shift, 'id'>[]): Promise<void> => {
    const res = await fetch(`${API_BASE}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shifts),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to batch insert shifts');
};

export const updateShift = async (shiftId: string, shiftData: Partial<Shift>): Promise<void> => {
    const res = await fetch(`${API_BASE}/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to update shift');
};

// ==========================================
// Settings API
// ==========================================

export const getRoleSettings = async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/settings/roles`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch role settings');
    return res.json();
};

export const updateRoleSetting = async (role: string, settings: { defaultStartTime: string, defaultEndTime: string }): Promise<void> => {
    const res = await fetch(`${API_BASE}/settings/roles/${encodeURIComponent(role)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to update role setting');
};

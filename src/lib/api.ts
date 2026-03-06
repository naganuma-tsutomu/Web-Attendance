import type { Staff, ShiftPreference, Shift } from '../types';

const isDummy = import.meta.env.VITE_FIREBASE_API_KEY?.includes('Dummy');
const API_BASE = '/api';

// ==========================================
// Staff API
// ==========================================

export const getStaffList = async (): Promise<Staff[]> => {
    if (isDummy) {
        // Fallback for UI standalone testing without Wrangler
        return [
            { id: '1', name: '山田 太郎 (デモ)', role: '正社員', hoursTarget: 160 },
            { id: '2', name: '佐藤 花子 (デモ)', role: '準社員', hoursTarget: 135 },
        ];
    }
    const res = await fetch(`${API_BASE}/staffs`);
    if (!res.ok) throw new Error('Failed to fetch staffs');
    return res.json();
};

export const createStaff = async (staffData: Omit<Staff, 'id'>): Promise<string> => {
    if (isDummy) return `mock_staff_${Date.now()}`;
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
    if (isDummy) return;
    const res = await fetch(`${API_BASE}/staffs/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
    });
    if (!res.ok) throw new Error('Failed to update staff');
};

export const deleteStaff = async (staffId: string): Promise<void> => {
    if (isDummy) return;
    const res = await fetch(`${API_BASE}/staffs/${staffId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete staff');
};

// ==========================================
// ShiftPreference API
// ==========================================

export const getPreferencesByMonth = async (yearMonth: string): Promise<ShiftPreference[]> => {
    if (isDummy) return [];
    const res = await fetch(`${API_BASE}/preferences?yearMonth=${yearMonth}`);
    if (!res.ok) throw new Error('Failed to fetch preferences');
    return res.json();
};

export const savePreference = async (preference: Omit<ShiftPreference, 'id'>): Promise<string> => {
    if (isDummy) return `mock_pref_${Date.now()}`;
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
    if (isDummy) return [];
    const res = await fetch(`${API_BASE}/shifts?yearMonth=${yearMonth}`);
    if (!res.ok) throw new Error('Failed to fetch shifts');
    return res.json();
};

export const saveShiftsBatch = async (shifts: Omit<Shift, 'id'>[]): Promise<void> => {
    if (isDummy) return;
    const res = await fetch(`${API_BASE}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shifts)
    });
    if (!res.ok) throw new Error('Failed to batch insert shifts');
};

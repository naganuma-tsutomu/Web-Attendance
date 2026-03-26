import { format, parse, isValid } from 'date-fns';

// ==========================================
// localStorage キー定数 (Single Source of Truth)
// ==========================================
export const STORAGE_KEYS = {
    WEEK_STARTS_ON: 'weekStartsOn',
    ACTIVE_MONTH: 'active_working_month',
    THEME: 'theme',
    STAFF_SESSION: 'staff_session',
    LAST_HOLIDAY_SYNC: 'lastHolidaySyncDate',
} as const;

// ==========================================
// 週の開始日
// ==========================================
export const getWeekStartsOn = (): 0 | 1 => {
    return (parseInt(localStorage.getItem(STORAGE_KEYS.WEEK_STARTS_ON) || '0') as 0 | 1);
};

export const setWeekStartsOn = (value: 0 | 1): void => {
    localStorage.setItem(STORAGE_KEYS.WEEK_STARTS_ON, value.toString());
};

// ==========================================
// 月の保存 / 読み込み
// ==========================================
export const saveActiveMonth = (date: Date): void => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MONTH, format(date, 'yyyy-MM'));
};

export const loadActiveMonth = (): Date => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_MONTH);
    if (!saved) return new Date();

    try {
        const parsed = parse(saved, 'yyyy-MM', new Date());
        if (!isValid(parsed)) return new Date();
        return parsed;
    } catch (e) {
        console.error('Failed to parse saved month', e);
        return new Date();
    }
};

// ==========================================
// スタッフセッション
// ==========================================
export const getStaffSession = <T = unknown>(): T | null => {
    const data = localStorage.getItem(STORAGE_KEYS.STAFF_SESSION);
    if (!data) return null;
    try { return JSON.parse(data) as T; } catch { return null; }
};

export const setStaffSession = (staff: unknown): void => {
    localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(staff));
};

export const clearStaffSession = (): void => {
    localStorage.removeItem(STORAGE_KEYS.STAFF_SESSION);
};

// ==========================================
// 祝日同期日
// ==========================================
export const getLastHolidaySyncDate = (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.LAST_HOLIDAY_SYNC);
};

export const setLastHolidaySyncDate = (dateStr: string): void => {
    localStorage.setItem(STORAGE_KEYS.LAST_HOLIDAY_SYNC, dateStr);
};

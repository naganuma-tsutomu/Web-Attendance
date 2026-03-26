import { describe, it, expect, beforeEach } from 'vitest';
import {
    STORAGE_KEYS,
    getWeekStartsOn,
    setWeekStartsOn,
    getStaffSession,
    setStaffSession,
    clearStaffSession,
    getLastHolidaySyncDate,
    setLastHolidaySyncDate,
    saveActiveMonth,
    loadActiveMonth,
} from '../dateUtils';
import { format } from 'date-fns';

describe('dateUtils - STORAGE_KEYS', () => {
    it('すべてのキーが定義されている', () => {
        expect(STORAGE_KEYS.WEEK_STARTS_ON).toBe('weekStartsOn');
        expect(STORAGE_KEYS.ACTIVE_MONTH).toBe('active_working_month');
        expect(STORAGE_KEYS.THEME).toBe('theme');
        expect(STORAGE_KEYS.STAFF_SESSION).toBe('staff_session');
        expect(STORAGE_KEYS.LAST_HOLIDAY_SYNC).toBe('lastHolidaySyncDate');
    });
});

describe('dateUtils - weekStartsOn', () => {
    beforeEach(() => localStorage.clear());

    it('デフォルトは0（日曜日）', () => {
        expect(getWeekStartsOn()).toBe(0);
    });

    it('1（月曜日）に設定できる', () => {
        setWeekStartsOn(1);
        expect(getWeekStartsOn()).toBe(1);
    });

    it('0（日曜日）に戻せる', () => {
        setWeekStartsOn(1);
        setWeekStartsOn(0);
        expect(getWeekStartsOn()).toBe(0);
    });
});

describe('dateUtils - saveActiveMonth / loadActiveMonth', () => {
    beforeEach(() => localStorage.clear());

    it('指定した日付の年月を保存・読み込みできる', () => {
        const date = new Date(2025, 5, 15);
        saveActiveMonth(date);
        expect(format(loadActiveMonth(), 'yyyy-MM')).toBe('2025-06');
    });

    it('保存されていない場合は現在の日付を返す', () => {
        const date = loadActiveMonth();
        expect(format(date, 'yyyy-MM')).toBe(format(new Date(), 'yyyy-MM'));
    });

    it('不正なフォーマットの場合は現在の日付を返す', () => {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_MONTH, 'invalid');
        const date = loadActiveMonth();
        expect(format(date, 'yyyy-MM')).toBe(format(new Date(), 'yyyy-MM'));
    });
});

describe('dateUtils - staffSession', () => {
    beforeEach(() => localStorage.clear());

    it('セッションがない場合は null を返す', () => {
        expect(getStaffSession()).toBeNull();
    });

    it('セッションを保存・取得できる', () => {
        const staff = { id: 's1', name: '田中太郎' };
        setStaffSession(staff);
        expect(getStaffSession<{ id: string; name: string }>()).toEqual(staff);
    });

    it('セッションをクリアできる', () => {
        setStaffSession({ id: 's1', name: '田中太郎' });
        clearStaffSession();
        expect(getStaffSession()).toBeNull();
    });

    it('不正な JSON の場合は null を返す', () => {
        localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, 'not-json');
        expect(getStaffSession()).toBeNull();
    });
});

describe('dateUtils - lastHolidaySyncDate', () => {
    beforeEach(() => localStorage.clear());

    it('初期状態は null', () => {
        expect(getLastHolidaySyncDate()).toBeNull();
    });

    it('日付を保存・取得できる', () => {
        setLastHolidaySyncDate('2025-06-15');
        expect(getLastHolidaySyncDate()).toBe('2025-06-15');
    });
});

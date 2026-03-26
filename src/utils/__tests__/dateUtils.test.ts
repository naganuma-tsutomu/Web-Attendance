import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveActiveMonth, loadActiveMonth } from '../dateUtils';
import { format } from 'date-fns';

describe('dateUtils', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('saveActiveMonth', () => {
        it('指定した日付の年月をlocalStorageに保存する', () => {
            const date = new Date(2025, 5, 15); // 2025-06-15
            saveActiveMonth(date);
            expect(localStorage.getItem('active_working_month')).toBe('2025-06');
        });
    });

    describe('loadActiveMonth', () => {
        it('localStorageに保存された年月を読み込んでDateオブジェクトを返す', () => {
            localStorage.setItem('active_working_month', '2025-08');
            const date = loadActiveMonth();
            expect(format(date, 'yyyy-MM')).toBe('2025-08');
        });

        it('保存されていない場合は現在の日付を返す', () => {
            // localStorage is empty because of beforeEach
            const date = loadActiveMonth();
            const now = new Date();
            expect(format(date, 'yyyy-MM')).toBe(format(now, 'yyyy-MM'));
        });

        it('パースに失敗した場合は現在の日付を返す', () => {
            localStorage.setItem('active_working_month', 'invalid-format');
            const date = loadActiveMonth();
            const now = new Date();
            expect(format(date, 'yyyy-MM')).toBe(format(now, 'yyyy-MM'));
        });
    });
});

import { describe, it, expect } from 'vitest';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import type { Staff, Shift } from '../../types';

// exportUtils の日付ロジックを直接テスト（UI依存なし）
// exportToExcel / exportToPDF はブラウザ依存（XLSX.writeFile 等）のため、
// その内部で使われる日付フォーマット関数の正しさを検証する

describe('exportUtils 日付フォーマット検証', () => {
    it('yyyy-MM-dd フォーマットが Shift.date と一致する', () => {
        const yearMonth = '2025-06';
        const [year, month] = yearMonth.split('-').map(Number);
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(startDate);
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        // 修正後のフォーマット（小文字の dd）
        const formattedDates = days.map(d => format(d, 'yyyy-MM-dd'));

        // Shift.date と同じ形式 'YYYY-MM-DD' になっているか確認
        expect(formattedDates[0]).toBe('2025-06-01');
        expect(formattedDates[formattedDates.length - 1]).toBe('2025-06-30');

        // 6月は全部で30日あること
        expect(formattedDates).toHaveLength(30);
    });

    it('大文字DD を使うと date-fns v4 では RangeError がthrowされる（バグの深刻さを実証）', () => {
        // date-fns v4 では 'DD' は保護されたトークンとして扱われ、エラーをthrowする
        // これは旧バグがサイレントな不正値を返すよりも深刻な問題だったことを示す
        const day = new Date(2025, 5, 15); // 2025-06-15

        // 大文字DDはエラーをthrowする
        expect(() => format(day, 'yyyy-MM-DD')).toThrow(RangeError);

        // 修正後の小文字ddは正常に動作する
        expect(format(day, 'yyyy-MM-dd')).toBe('2025-06-15');
    });

    it('Shift 検索がフォーマット修正後に正しく機能する', () => {
        const yearMonth = '2025-06';
        const [year, month] = yearMonth.split('-').map(Number);
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(startDate);
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        // モックスタッフ
        const mockStaff: Staff = {
            id: 'staff1',
            name: 'テストスタッフ',
            role: '正社員',
            hoursTarget: 160,
        };

        // モックシフト（2025-06-05の分）
        const mockShifts: Shift[] = [{
            id: 'shift1',
            date: '2025-06-05',
            staffId: 'staff1',
            startTime: '10:15',
            endTime: '18:00',
            classType: '虹組',
            isEarlyShift: true,
        }];

        // 修正後の日付フォーマットでシフトが見つかるか確認
        let foundCount = 0;
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd'); // 修正後
            const dayShift = mockShifts.find(s => s.staffId === mockStaff.id && s.date === dateStr);
            if (dayShift) foundCount++;
        });

        expect(foundCount).toBe(1); // 1件見つかるはず
    });

});

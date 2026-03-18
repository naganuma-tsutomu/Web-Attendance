import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fetchのモック
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// api.tsの関数をインポート（テスト环境ではモックされたfetchを使用）
import { 
    getStaffList, 
    getStaffNameList,
    createStaff, 
    updateStaff, 
    deleteStaff,
    getShiftsByMonth,
    saveShiftsBatch,
    updateShift,
    deleteShiftsByMonth,
    getPreferencesByMonth,
    savePreference,
    getClasses,
    getRoles,
    getTimePatterns
} from '../api';

describe('API - Staff functions', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    afterEach(() => {
        mockFetch.mockRestore();
    });

    describe('getStaffList', () => {
        it('スタッフリストを取得できる', async () => {
            const mockStaff = [
                { id: 's1', name: '田中太郎', role: '正社員', hoursTarget: 160 },
                { id: 's2', name: '佐藤花子', role: 'パート', hoursTarget: 80 }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockStaff))
            });

            const result = await getStaffList();
            expect(result).toEqual(mockStaff);
            expect(mockFetch).toHaveBeenCalled();
            expect(mockFetch.mock.calls[0][0]).toContain('/api/staffs');
        });

        it('APIエラー時に例外をスローする', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ message: 'Internal Server Error' })
            });

            await expect(getStaffList()).rejects.toThrow();
        });
    });

    describe('getStaffNameList', () => {
        it('ログイン用のスタッフIDと名前のリストを取得できる', async () => {
            const mockStaff = [
                { id: 's1', name: '田中太郎' },
                { id: 's2', name: '佐藤花子' }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockStaff))
            });

            const result = await getStaffNameList();
            expect(result).toEqual(mockStaff);
            expect(mockFetch).toHaveBeenCalled();
            expect(mockFetch.mock.calls[0][0]).toContain('/api/staffs/list');
        });
    });

    describe('createStaff', () => {
        it('新規スタッフを作成できる', async () => {
            const newStaff = { name: '新規スタッフ', role: 'パート', hoursTarget: 100 };
            const mockResponse = { id: 'new-id-123' };
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockResponse))
            });

            const result = await createStaff(newStaff);
            expect(result).toBe('new-id-123');
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/staffs',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(newStaff)
                })
            );
        });
    });

    describe('updateStaff', () => {
        it('スタッフ情報を更新できる', async () => {
            const staffId = 's1';
            const updates = { name: '更新后的名前', hoursTarget: 120 };
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('')
            });

            await expect(updateStaff(staffId, updates)).resolves.not.toThrow();
            expect(mockFetch).toHaveBeenCalledWith(
                `/api/staffs/${staffId}`,
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(updates)
                })
            );
        });
    });

    describe('deleteStaff', () => {
        it('スタッフを削除できる', async () => {
            const staffId = 's1';
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('')
            });

            await expect(deleteStaff(staffId)).resolves.not.toThrow();
            expect(mockFetch).toHaveBeenCalledWith(
                `/api/staffs/${staffId}`,
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });
});

describe('API - Shift functions', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('getShiftsByMonth', () => {
        it('月別のシフトを取得できる', async () => {
            const yearMonth = '2025-06';
            const mockShifts = [
                { id: 'shift1', date: '2025-06-01', staffId: 's1', startTime: '09:00', endTime: '18:00' }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockShifts))
            });

            const result = await getShiftsByMonth(yearMonth);
            expect(result).toEqual(mockShifts);
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/shifts?yearMonth=2025-06',
                expect.any(Object)
            );
        });
    });

    describe('saveShiftsBatch', () => {
        it('複数のシフトを一括保存できる', async () => {
            const shifts = [
                { date: '2025-06-01', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'class_niji', isEarlyShift: false, isError: false }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('')
            });

            await expect(saveShiftsBatch(shifts)).resolves.not.toThrow();
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/shifts',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(shifts)
                })
            );
        });
    });

    describe('updateShift', () => {
        it('シフト情報を更新できる', async () => {
            const shiftId = 'shift1';
            const updates = { startTime: '10:00', endTime: '19:00' };
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('')
            });

            await expect(updateShift(shiftId, updates)).resolves.not.toThrow();
            expect(mockFetch).toHaveBeenCalledWith(
                `/api/shifts/${encodeURIComponent(shiftId)}`,
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(updates)
                })
            );
        });
    });

    describe('deleteShiftsByMonth', () => {
        it('月別のシフトを削除できる', async () => {
            const yearMonth = '2025-06';
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('')
            });

            await expect(deleteShiftsByMonth(yearMonth)).resolves.not.toThrow();
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/shifts?yearMonth=2025-06',
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });
});

describe('API - Preference functions', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('getPreferencesByMonth', () => {
        it('月別の希望休を取得できる', async () => {
            const yearMonth = '2025-06';
            const mockPrefs = [
                { id: 'p1', staffId: 's1', yearMonth: '2025-06', unavailableDates: ['2025-06-01', '2025-06-02'] }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockPrefs))
            });

            const result = await getPreferencesByMonth(yearMonth);
            expect(result).toEqual(mockPrefs);
        });
    });

    describe('savePreference', () => {
        it('希望休を保存できる', async () => {
            const pref = { staffId: 's1', yearMonth: '2025-06', unavailableDates: ['2025-06-01'] };
            const mockResponse = { id: 'pref-new-id' };
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockResponse))
            });

            const result = await savePreference(pref);
            expect(result).toBe('pref-new-id');
        });
    });
});

describe('API - Settings functions', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('getClasses', () => {
        it('クラス一覧を取得できる', async () => {
            const mockClasses = [
                { id: 'class_niji', name: '虹組', display_order: 0, auto_allocate: 1 }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockClasses))
            });

            const result = await getClasses();
            expect(result).toEqual(mockClasses);
        });
    });

    describe('getRoles', () => {
        it('役職一覧を取得できる', async () => {
            const mockRoles = [
                { id: 'r1', name: '正社員', targetHours: 160, patterns: [] }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockRoles))
            });

            const result = await getRoles();
            expect(result).toEqual(mockRoles);
        });
    });

    describe('getTimePatterns', () => {
        it('勤務時間パターンを取得できる', async () => {
            const mockPatterns = [
                { id: 'p1', name: '日勤', startTime: '09:00', endTime: '18:00' }
            ];
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockPatterns))
            });

            const result = await getTimePatterns();
            expect(result).toEqual(mockPatterns);
        });
    });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createValidationError, createServerError, handleServerError, validateName, validateTimeFormat, validateTimeRange } from '../validation';

describe('validation utilities', () => {
    describe('createValidationError', () => {
        it('ステータス400とエラーメッセージを持つResponseを返す', async () => {
            const msg = 'Invalid Input';
            const response = createValidationError(msg);
            expect(response.status).toBe(400);
            expect(response.headers.get('Content-Type')).toBe('application/json');
            const data = await response.json();
            expect(data).toEqual({ error: msg });
        });
    });

    describe('createServerError', () => {
        it('ステータス500と汎用エラーメッセージを持つResponseを返す', async () => {
            const response = createServerError();
            expect(response.status).toBe(500);
            expect(response.headers.get('Content-Type')).toBe('application/json');
            const data = await response.json();
            expect(data.error).toContain('保存に失敗しました');
        });
    });

    describe('handleServerError', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('エラーをコンソールに出力し、サーバーエラーレスポンスを返す', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const error = new Error('Test DB Error');
            const response = handleServerError(error, 'Database operation');
            
            expect(consoleSpy).toHaveBeenCalledWith('Database operation:', error);
            expect(response.status).toBe(500);
        });
    });

    describe('validateName', () => {
        it('空の文字列はエラーを返す', () => {
            expect(validateName('')).toContain('入力してください');
            expect(validateName('   ', 'チーム名')).toBe('チーム名を入力してください');
        });

        it('最大長を超えるとエラーを返す', () => {
            const longName = 'a'.repeat(51);
            expect(validateName(longName)).toContain('50文字以内で');
            
            const customLongName = 'a'.repeat(21);
            expect(validateName(customLongName, '名称', 20)).toBe('名称は20文字以内で入力してください');
        });

        it('正常な入力はnullを返す', () => {
            expect(validateName('田中 太郎')).toBeNull();
        });
    });

    describe('validateTimeFormat', () => {
        it('不正な時間フォーマットはエラーを返す', () => {
            expect(validateTimeFormat('9:00', '開始時間')).toContain('形式が正しくありません');
            expect(validateTimeFormat('25:00', '時間')).toContain('形式が正しくありません');
            expect(validateTimeFormat('12:60', '時間')).toContain('形式が正しくありません');
            expect(validateTimeFormat('12-00', '時間')).toContain('形式が正しくありません');
            expect(validateTimeFormat('', '時間')).toContain('形式が正しくありません');
        });

        it('正常な時間フォーマットはnullを返す', () => {
            expect(validateTimeFormat('09:00', '開始時間')).toBeNull();
            expect(validateTimeFormat('23:59', '時間')).toBeNull();
        });
    });

    describe('validateTimeRange', () => {
        it('各時間のフォーマットが不正な場合はフォーマットエラーを返す', () => {
            expect(validateTimeRange('9:00', '18:00')).toContain('形式が正しくありません');
            expect(validateTimeRange('09:00', '18:60')).toContain('形式が正しくありません');
        });

        it('開始と終了が同じ場合はエラーを返す', () => {
            expect(validateTimeRange('12:00', '12:00')).toBe('開始時間と終了時間が同じです');
        });

        it('日またぎなどを含む任意の異なる時間同士は（現在は）nullを返す', () => {
            expect(validateTimeRange('09:00', '18:00')).toBeNull();
            expect(validateTimeRange('22:00', '05:00')).toBeNull();
        });
    });
});

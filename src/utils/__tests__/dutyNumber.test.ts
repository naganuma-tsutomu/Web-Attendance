import { describe, it, expect } from 'vitest';
import { getEffectiveDutyNumber } from '../dutyNumber';

const date = new Date('2024-01-01');
const date2 = new Date('2024-01-02');

describe('getEffectiveDutyNumber', () => {
    describe('保存済み値の優先', () => {
        it('storedNumber が null 以外のときはその値を返す', () => {
            expect(getEffectiveDutyNumber('a', 5, date, ['a', 'b', 'c'])).toBe(5);
        });

        it('storedNumber が 0 でも優先される', () => {
            expect(getEffectiveDutyNumber('a', 0, date, ['a', 'b', 'c'])).toBe(0);
        });
    });

    describe('全員ローテーション（fullTimeGroupIds なし）', () => {
        const group = ['a', 'b', 'c'];

        it('基準日: a=1, b=2, c=3', () => {
            expect(getEffectiveDutyNumber('a', null, date, group)).toBe(1);
            expect(getEffectiveDutyNumber('b', null, date, group)).toBe(2);
            expect(getEffectiveDutyNumber('c', null, date, group)).toBe(3);
        });

        it('翌日: a=2, b=3, c=1（1日シフト）', () => {
            expect(getEffectiveDutyNumber('a', null, date2, group)).toBe(2);
            expect(getEffectiveDutyNumber('b', null, date2, group)).toBe(3);
            expect(getEffectiveDutyNumber('c', null, date2, group)).toBe(1);
        });

        it('グループに存在しないスタッフは 1 を返す', () => {
            expect(getEffectiveDutyNumber('z', null, date, group)).toBe(1);
        });

        it('グループが空のときは 1 を返す', () => {
            expect(getEffectiveDutyNumber('a', null, date, [])).toBe(1);
        });
    });

    describe('正社員グループモード（fullTimeGroupIds あり）', () => {
        const group = ['ft1', 'ft2', 'pt1', 'pt2'];
        const ftGroup = ['ft1', 'ft2'];

        it('基準日: 正社員は自グループ内ローテーション', () => {
            expect(getEffectiveDutyNumber('ft1', null, date, group, ftGroup)).toBe(1);
            expect(getEffectiveDutyNumber('ft2', null, date, group, ftGroup)).toBe(2);
        });

        it('基準日: パートは正社員数+インデックス', () => {
            expect(getEffectiveDutyNumber('pt1', null, date, group, ftGroup)).toBe(3);
            expect(getEffectiveDutyNumber('pt2', null, date, group, ftGroup)).toBe(4);
        });

        it('翌日: 正社員のみローテーションが進む', () => {
            expect(getEffectiveDutyNumber('ft1', null, date2, group, ftGroup)).toBe(2);
            expect(getEffectiveDutyNumber('ft2', null, date2, group, ftGroup)).toBe(1);
            expect(getEffectiveDutyNumber('pt1', null, date2, group, ftGroup)).toBe(3);
            expect(getEffectiveDutyNumber('pt2', null, date2, group, ftGroup)).toBe(4);
        });

        it('正社員に存在しないスタッフは 1 を返す', () => {
            expect(getEffectiveDutyNumber('unknown', null, date, group, ftGroup)).toBe(1);
        });
    });

    describe('グループ変更によるローテーション挙動', () => {
        it('末尾追加: 追加当日（dayOffset=0）の既存メンバーの番号は変わらない', () => {
            const before = ['a', 'b', 'c'];
            const after = ['a', 'b', 'c', 'd'];
            // date は基準日（dayOffset=0）
            expect(getEffectiveDutyNumber('a', null, date, before))
                .toBe(getEffectiveDutyNumber('a', null, date, after));
            expect(getEffectiveDutyNumber('b', null, date, before))
                .toBe(getEffectiveDutyNumber('b', null, date, after));
            expect(getEffectiveDutyNumber('c', null, date, before))
                .toBe(getEffectiveDutyNumber('c', null, date, after));
        });

        it('末尾追加: 翌日以降は % n が変わるためローテーションが変化する（既知の挙動）', () => {
            const before = ['a', 'b', 'c'];
            const after = ['a', 'b', 'c', 'd'];
            // DB 保存済み値がある日付には影響しない（storedNumber 優先のため）
            // この計算値はまだ確定していない未来の日付にのみ影響する
            const cBefore = getEffectiveDutyNumber('c', null, date2, before);
            const cAfter  = getEffectiveDutyNumber('c', null, date2, after);
            expect(cBefore).not.toBe(cAfter);
        });

        it('中間挿入: 挿入位置より後のメンバーは当日も番号がずれる', () => {
            const before = ['a', 'b', 'c'];
            const after = ['a', 'NEW', 'b', 'c'];
            expect(getEffectiveDutyNumber('b', null, date, before))
                .not.toBe(getEffectiveDutyNumber('b', null, date, after));
        });
    });
});

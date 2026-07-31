import { describe, it, expect } from 'vitest';
import { getEffectiveDutyNumber, getEffectiveDutyNumbers } from '../dutyNumber';

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

    describe('リセット後の視覚的重複と DB UNIQUE 制約', () => {
        // 背景: duty_number=null のシフトは DB 保存時に NULL として扱われる。
        // UNIQUE INDEX は "WHERE duty_number IS NOT NULL" 付き部分インデックスのため
        // NULL は何件でも許容される。よって、auto 計算で同じ番号に見えても保存時に衝突しない。

        it('storedNumber=null のシフトは auto 計算値を返すが、DB 保存は NULL になる', () => {
            const group = ['a', 'b', 'c'];
            // auto 計算で a=1, b=2, c=3
            expect(getEffectiveDutyNumber('a', null, date, group)).toBe(1);
            expect(getEffectiveDutyNumber('c', null, date, group)).toBe(3);
            // 両者とも storedNumber=null → DB では duty_number=NULL → UNIQUE 違反なし
        });

        it('手動設定値は storedNumber として優先され auto 計算を上書きする', () => {
            const group = ['a', 'b', 'c'];
            // b を手動で 1 に設定（a の auto 番号と衝突）
            expect(getEffectiveDutyNumber('b', 1, date, group)).toBe(1);
            // a は null のまま → auto=1 と表示されるが DB では NULL
            expect(getEffectiveDutyNumber('a', null, date, group)).toBe(1);
            // → UI 上は a=1, b=1 と見えるが DB では b.duty_number=1, a.duty_number=NULL
            //   UNIQUE 対象は b のみなので制約違反にならない
        });

        it('swap 後: targetShift が新番号を受け取り、auto と視覚的重複しても DB 問題なし', () => {
            // a=手動3, b=手動1, c=auto3 のグループで a をリセットするシナリオ
            // a のauto=1, b のauto=2, c のauto=3
            const group = ['a', 'b', 'c'];
            // a をリセット → auto=1
            const aAuto = getEffectiveDutyNumber('a', null, date, group);
            expect(aAuto).toBe(1);
            // b が手動1を持っていたため swap → b=手動3（a の元の値）
            // c は手動なし → auto=3 と表示
            const cAuto = getEffectiveDutyNumber('c', null, date, group);
            expect(cAuto).toBe(3);
            // b=手動3, c=auto3 → 表示上は重複するが
            // DB 保存: b.duty_number=3, c.duty_number=NULL → UNIQUE 違反なし
        });
    });

    describe('クラス内の一括番号計算', () => {
        const entries = [
            { id: 'shift-a', staffId: 'a', storedNumber: null },
            { id: 'shift-b', staffId: 'b', storedNumber: null },
            { id: 'shift-c', staffId: 'c', storedNumber: null },
        ];

        it('自動番号だけなら1から人数までの一意な連番になる', () => {
            const numbers = [...getEffectiveDutyNumbers(entries, date).values()];
            expect([...numbers].sort()).toEqual([1, 2, 3]);
        });

        it('手動番号と自動番号が衝突しても残りを再配分する', () => {
            const numbers = getEffectiveDutyNumbers([
                entries[0],
                { ...entries[1], storedNumber: 1 },
                entries[2],
            ], date);

            expect(numbers.get('shift-b')).toBe(1);
            expect([...numbers.values()].sort()).toEqual([1, 2, 3]);
        });

        it('同じスタッフの行が複数あっても番号は重複しない', () => {
            const numbers = getEffectiveDutyNumbers([
                { id: 'shift-a1', staffId: 'a', storedNumber: null },
                { id: 'shift-a2', staffId: 'a', storedNumber: null },
                { id: 'shift-b', staffId: 'b', storedNumber: null },
            ], date);

            expect([...numbers.values()].sort()).toEqual([1, 2, 3]);
        });

        it('範囲外または重複した保存値は自動番号として補正する', () => {
            const numbers = getEffectiveDutyNumbers([
                { id: 'shift-a', staffId: 'a', storedNumber: 1 },
                { id: 'shift-b', staffId: 'b', storedNumber: 1 },
                { id: 'shift-c', staffId: 'c', storedNumber: 99 },
            ], date);

            expect([...numbers.values()].sort()).toEqual([1, 2, 3]);
        });
    });
});

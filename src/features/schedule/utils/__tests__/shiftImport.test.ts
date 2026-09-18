import { describe, expect, it } from 'vitest';
import type { Shift, ShiftClass, Staff } from '../../../../types';
import {
    buildShiftImportPreview, MAX_CSV_ROWS, parseShiftImportCsv, toImportedShift,
    type ParsedImportRow,
} from '../shiftImport';

const staffList: Staff[] = [
    { id: 's1', name: '山田 太郎', role: '常勤', hoursTarget: 160, weeklyHoursTarget: 40 },
    { id: 's2', name: '佐藤 花子', role: '常勤', hoursTarget: 160, weeklyHoursTarget: 40 },
];
const classes: ShiftClass[] = [
    { id: 'c1', name: '虹組', display_order: 1, auto_allocate: 1 },
    { id: 'c2', name: '空組', display_order: 2, auto_allocate: 1 },
];
const row = (overrides: Partial<ParsedImportRow> = {}): ParsedImportRow => ({
    rowNumber: 2,
    date: '2026-08-01',
    staffName: '山田 太郎',
    className: '虹組',
    startTime: '09:00',
    endTime: '18:00',
    dutyNumber: '',
    ...overrides,
});

describe('parseShiftImportCsv', () => {
    it('BOM、日本語ヘッダー、引用符内のカンマと改行を解析する', () => {
        const result = parseShiftImportCsv(
            '\uFEFF日付,氏名,クラス,開始時刻,終了時刻,当番番号\r\n' +
            '2026-08-01,"山田, 太郎",虹組,09:00,18:00,1\r\n' +
            '2026-08-02,"佐藤\n花子",空組,10:00,17:00,'
        );

        expect(result.error).toBeNull();
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]).toMatchObject({ rowNumber: 2, staffName: '山田, 太郎', dutyNumber: '1' });
        expect(result.rows[1]).toMatchObject({ rowNumber: 3, staffName: '佐藤\n花子' });
    });

    it.each([
        ['date,staffName,className,startTime\n2026-08-01,山田,虹組,09:00', '必須列が不足しています'],
        ['date,staffName,className,startTime,endTime\n"2026-08-01,山田,虹組,09:00,18:00', '引用符が閉じられていません'],
        ['date,staffName,className,startTime,endTime\n2026-08-01,山田,\uFFFD,09:00,18:00', '文字コードをUTF-8にして'],
        ['date,staffName,className,startTime,endTime', 'ヘッダー行とデータ行が必要です'],
    ])('不正なCSVを明示的に拒否する', (csv, message) => {
        const result = parseShiftImportCsv(csv);
        expect(result.rows).toEqual([]);
        expect(result.error).toContain(message);
    });

    it('API上限を超える行数を取込前に拒否する', () => {
        const header = 'date,staffName,className,startTime,endTime';
        const data = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, index) =>
            `2026-08-01,スタッフ${index},虹組,09:00,18:00`).join('\n');

        expect(parseShiftImportCsv(`${header}\n${data}`).error).toBe(`一度に取り込めるのは${MAX_CSV_ROWS}件までです`);
    });
});

describe('buildShiftImportPreview', () => {
    const preview = (
        rows: ParsedImportRow[],
        options: { existingShifts?: Shift[]; fixedDates?: Set<string>; mode?: 'append' | 'replace' } = {},
    ) => buildShiftImportPreview({
        rows,
        yearMonth: '2026-08',
        staffList,
        classes,
        existingShifts: options.existingShifts ?? [],
        fixedDates: options.fixedDates ?? new Set(),
        mode: options.mode ?? 'append',
    });

    it('有効な行をIDへ解決してシフトに変換する', () => {
        const [result] = preview([row({ dutyNumber: '3' })]);
        expect(result).toMatchObject({ staffId: 's1', classId: 'c1', errors: [], skipped: false });
        expect(toImportedShift(result)).toMatchObject({ staffId: 's1', classType: 'c1', duty_number: 3 });
    });

    it('存在しない日付、対象月外、時刻、クラス、当番番号を検証する', () => {
        const results = preview([
            row({ rowNumber: 2, date: '2026-02-30' }),
            row({ rowNumber: 3, date: '2026-09-01' }),
            row({ rowNumber: 4, startTime: '9:00', endTime: '9:00', className: '不存在', dutyNumber: '0' }),
        ]);
        expect(results[0].errors).toContain('日付形式が不正です');
        expect(results[1].errors).toContain('対象月外の日付です');
        expect(results[2].errors).toEqual(expect.arrayContaining([
            'クラスが見つかりません', '開始時刻が不正です', '終了時刻が不正です', '開始と終了が同じです', '当番番号が不正です',
        ]));
    });

    it('未登録スタッフ、既存シフト、CSV内重複をスキップする', () => {
        const existing: Shift = {
            id: 'existing', date: '2026-08-01', staffId: 's1', classType: 'c1', startTime: '09:00', endTime: '18:00',
        };
        const results = preview([
            row({ rowNumber: 2, staffName: '未登録' }),
            row({ rowNumber: 3 }),
            row({ rowNumber: 4, date: '2026-08-02' }),
            row({ rowNumber: 5, date: '2026-08-02' }),
        ], { existingShifts: [existing] });
        expect(results.map(result => result.skipReason)).toEqual(['スタッフ未登録', '重複', undefined, '重複']);
    });

    it('当番番号重複を検出し、上書き時はロック日を保持する', () => {
        const results = preview([
            row({ rowNumber: 2, dutyNumber: '1' }),
            row({ rowNumber: 3, staffName: '佐藤 花子', dutyNumber: '1' }),
            row({ rowNumber: 4, date: '2026-08-03' }),
        ], { fixedDates: new Set(['2026-08-03']), mode: 'replace' });
        expect(results[0].skipped).toBe(false);
        expect(results[1].skipReason).toBe('当番番号重複');
        expect(results[2].skipReason).toBe('ロック済み日付');
    });
});

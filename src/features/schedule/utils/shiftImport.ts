import type { Shift, ShiftClass, Staff } from '../../../types';

export const MAX_CSV_FILE_BYTES = 2_000_000;
export const MAX_CSV_ROWS = 1000;

export type ImportMode = 'append' | 'replace';

export type ParsedImportRow = {
    rowNumber: number;
    date: string;
    staffName: string;
    className: string;
    startTime: string;
    endTime: string;
    dutyNumber: string;
};

export type PreviewImportRow = ParsedImportRow & {
    staffId?: string;
    classId?: string;
    skipped?: boolean;
    skipReason?: string;
    errors: string[];
};

type ImportColumn = keyof Omit<ParsedImportRow, 'rowNumber'>;

const HEADER_ALIASES: Record<ImportColumn, string[]> = {
    date: ['date', '日付'],
    staffName: ['staffname', 'staff', 'name', 'スタッフ名', '氏名', '名前'],
    className: ['classname', 'class', 'クラス', '区分', '組'],
    startTime: ['starttime', 'start', '開始', '開始時刻'],
    endTime: ['endtime', 'end', '終了', '終了時刻'],
    dutyNumber: ['dutynumber', 'duty_number', '番号', '当番番号'],
};

const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').trim().replace(/\s+/g, '').toLowerCase();

const parseCsvCells = (text: string): { rows: string[][]; error?: string } => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                index++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(field.trim());
            field = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') index++;
            row.push(field.trim());
            if (row.some(cell => cell.length > 0)) rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }

    if (inQuotes) return { rows: [], error: '引用符が閉じられていません' };
    row.push(field.trim());
    if (row.some(cell => cell.length > 0)) rows.push(row);
    return { rows };
};

const buildHeaderMap = (headers: string[]) => {
    const normalized = headers.map(normalizeHeader);
    const result = new Map<ImportColumn, number>();
    (Object.keys(HEADER_ALIASES) as ImportColumn[]).forEach(key => {
        const aliases = HEADER_ALIASES[key].map(normalizeHeader);
        const index = normalized.findIndex(header => aliases.includes(header));
        if (index >= 0) result.set(key, index);
    });
    return result;
};

export const parseShiftImportCsv = (text: string): { rows: ParsedImportRow[]; error: string | null } => {
    if (text.includes('\uFFFD') || text.includes('\0')) {
        return { rows: [], error: '文字コードをUTF-8にして保存し直してください' };
    }
    const parsed = parseCsvCells(text);
    if (parsed.error) return { rows: [], error: parsed.error };
    if (parsed.rows.length < 2) return { rows: [], error: 'ヘッダー行とデータ行が必要です' };
    if (parsed.rows.length - 1 > MAX_CSV_ROWS) {
        return { rows: [], error: `一度に取り込めるのは${MAX_CSV_ROWS}件までです` };
    }

    const headerMap = buildHeaderMap(parsed.rows[0]);
    const required: Array<Exclude<ImportColumn, 'dutyNumber'>> = ['date', 'staffName', 'className', 'startTime', 'endTime'];
    if (required.some(key => !headerMap.has(key))) {
        return { rows: [], error: '必須列が不足しています: date, staffName, className, startTime, endTime' };
    }

    const rows = parsed.rows.slice(1).map((cells, index) => ({
        rowNumber: index + 2,
        date: cells[headerMap.get('date')!] ?? '',
        staffName: cells[headerMap.get('staffName')!] ?? '',
        className: cells[headerMap.get('className')!] ?? '',
        startTime: cells[headerMap.get('startTime')!] ?? '',
        endTime: cells[headerMap.get('endTime')!] ?? '',
        dutyNumber: headerMap.has('dutyNumber') ? (cells[headerMap.get('dutyNumber')!] ?? '') : '',
    }));
    return { rows, error: null };
};

const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const buildShiftImportPreview = ({
    rows, yearMonth, staffList, classes, existingShifts, fixedDates, mode,
}: {
    rows: ParsedImportRow[];
    yearMonth: string;
    staffList: Staff[];
    classes: ShiftClass[];
    existingShifts: Shift[];
    fixedDates: Set<string>;
    mode: ImportMode;
}): PreviewImportRow[] => {
    const staffByName = new Map(staffList.map(staff => [staff.name.trim(), staff]));
    const classByName = new Map(classes.map(shiftClass => [shiftClass.name.trim(), shiftClass]));
    const fixedDateSet = new Set(Array.from(fixedDates).filter(date => date.startsWith(yearMonth)));
    const protectedShifts = mode === 'append'
        ? existingShifts.filter(shift => shift.date.startsWith(yearMonth))
        : existingShifts.filter(shift => fixedDateSet.has(shift.date));
    const existingShiftKeys = new Set(protectedShifts.map(shift =>
        `${shift.date}:${shift.staffId}:${shift.classType}:${shift.startTime}:${shift.endTime}`));
    const existingDutyKeys = new Set(protectedShifts
        .filter(shift => shift.duty_number != null)
        .map(shift => `${shift.date}:${shift.classType}:${shift.duty_number}`));
    const seenShiftKeys = new Set<string>();
    const seenDutyKeys = new Set<string>();

    return rows.map(row => {
        const errors: string[] = [];
        const staff = staffByName.get(row.staffName.trim());
        const shiftClass = classByName.get(row.className.trim());
        if (!isValidDate(row.date)) errors.push('日付形式が不正です');
        else if (!row.date.startsWith(yearMonth)) errors.push('対象月外の日付です');

        let skipped = !staff;
        let skipReason = skipped ? 'スタッフ未登録' : undefined;
        if (!skipped && mode === 'replace' && fixedDateSet.has(row.date)) {
            skipped = true;
            skipReason = 'ロック済み日付';
        }
        if (!skipped) {
            if (!shiftClass) errors.push('クラスが見つかりません');
            if (!isValidTime(row.startTime)) errors.push('開始時刻が不正です');
            if (!isValidTime(row.endTime)) errors.push('終了時刻が不正です');
            if (row.startTime && row.endTime && row.startTime === row.endTime) errors.push('開始と終了が同じです');
            if (row.dutyNumber && (!Number.isInteger(Number(row.dutyNumber)) || Number(row.dutyNumber) < 1)) {
                errors.push('当番番号が不正です');
            }
        }

        if (!skipped && errors.length === 0 && staff && shiftClass) {
            const shiftKey = `${row.date}:${staff.id}:${shiftClass.id}:${row.startTime}:${row.endTime}`;
            if (existingShiftKeys.has(shiftKey) || seenShiftKeys.has(shiftKey)) {
                skipped = true;
                skipReason = '重複';
            } else {
                seenShiftKeys.add(shiftKey);
            }
            if (!skipped && row.dutyNumber) {
                const dutyKey = `${row.date}:${shiftClass.id}:${row.dutyNumber}`;
                if (existingDutyKeys.has(dutyKey) || seenDutyKeys.has(dutyKey)) {
                    skipped = true;
                    skipReason = '当番番号重複';
                } else {
                    seenDutyKeys.add(dutyKey);
                }
            }
        }
        return { ...row, staffId: staff?.id, classId: shiftClass?.id, skipped, skipReason, errors };
    });
};

export const toImportedShift = (row: PreviewImportRow): Omit<Shift, 'id'> => ({
    date: row.date,
    staffId: row.staffId!,
    classType: row.classId!,
    startTime: row.startTime,
    endTime: row.endTime,
    isEarlyShift: false,
    isError: false,
    duty_number: row.dutyNumber ? Number(row.dutyNumber) : null,
});

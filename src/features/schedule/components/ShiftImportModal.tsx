import { useMemo, useRef, useState } from 'react';
import { AlertCircle, FileUp, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../../../components/ui/Modal';
import { useCreateShiftSnapshot, useReplaceShiftsForMonth, useSaveShiftsBatch } from '../../../lib/hooks';
import { handleApiError } from '../../../lib/errorHandler';
import type { Shift, ShiftClass, Staff } from '../../../types';

interface ShiftImportModalProps {
    isOpen: boolean;
    yearMonth: string;
    staffList: Staff[];
    classes: ShiftClass[];
    existingShifts: Shift[];
    fixedDates: Set<string>;
    onClose: () => void;
    onImported: () => void;
}

type ImportMode = 'append' | 'replace';

type ParsedRow = {
    rowNumber: number;
    date: string;
    staffName: string;
    className: string;
    startTime: string;
    endTime: string;
    dutyNumber: string;
};

type PreviewRow = ParsedRow & {
    staffId?: string;
    classId?: string;
    skipped?: boolean;
    skipReason?: string;
    errors: string[];
};

const HEADER_ALIASES: Record<keyof Omit<ParsedRow, 'rowNumber'>, string[]> = {
    date: ['date', '日付'],
    staffName: ['staffname', 'staff', 'name', 'スタッフ名', '氏名', '名前'],
    className: ['classname', 'class', 'クラス', '区分', '組'],
    startTime: ['starttime', 'start', '開始', '開始時刻'],
    endTime: ['endtime', 'end', '終了', '終了時刻'],
    dutyNumber: ['dutynumber', 'duty_number', '番号', '当番番号'],
};

const normalizeHeader = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();

const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            row.push(field.trim());
            field = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            row.push(field.trim());
            if (row.some(cell => cell.length > 0)) rows.push(row);
            row = [];
            field = '';
            continue;
        }

        field += char;
    }

    row.push(field.trim());
    if (row.some(cell => cell.length > 0)) rows.push(row);
    return rows;
};

const buildHeaderMap = (headers: string[]) => {
    const normalized = headers.map(normalizeHeader);
    const result = new Map<keyof Omit<ParsedRow, 'rowNumber'>, number>();

    (Object.keys(HEADER_ALIASES) as Array<keyof Omit<ParsedRow, 'rowNumber'>>).forEach(key => {
        const aliases = HEADER_ALIASES[key].map(normalizeHeader);
        const index = normalized.findIndex(header => aliases.includes(header));
        if (index >= 0) result.set(key, index);
    });

    return result;
};

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const toShift = (row: PreviewRow): Omit<Shift, 'id'> => ({
    date: row.date,
    staffId: row.staffId!,
    classType: row.classId!,
    startTime: row.startTime,
    endTime: row.endTime,
    isEarlyShift: false,
    isError: false,
    duty_number: row.dutyNumber ? Number(row.dutyNumber) : null,
});

const ShiftImportModal = ({
    isOpen,
    yearMonth,
    staffList,
    classes,
    existingShifts,
    fixedDates,
    onClose,
    onImported,
}: ShiftImportModalProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [mode, setMode] = useState<ImportMode>('append');

    const saveBatch = useSaveShiftsBatch();
    const replaceMonth = useReplaceShiftsForMonth();
    const createSnapshot = useCreateShiftSnapshot();

    const staffByName = useMemo(() => {
        const map = new Map<string, Staff>();
        staffList.forEach(staff => map.set(staff.name.trim(), staff));
        return map;
    }, [staffList]);

    const classByName = useMemo(() => {
        const map = new Map<string, ShiftClass>();
        classes.forEach(cls => map.set(cls.name.trim(), cls));
        return map;
    }, [classes]);

    const previewRows = useMemo<PreviewRow[]>(() => {
        const fixedDateSet = new Set(Array.from(fixedDates).filter(date => date.startsWith(yearMonth)));
        const existingShiftKeys = new Set<string>();
        const existingDutyKeys = new Set<string>();

        if (mode === 'append') {
            existingShifts
                .filter(shift => shift.date.startsWith(yearMonth))
                .forEach(shift => {
                    existingShiftKeys.add(`${shift.date}:${shift.staffId}:${shift.classType}:${shift.startTime}:${shift.endTime}`);
                    if (shift.duty_number) existingDutyKeys.add(`${shift.date}:${shift.classType}:${shift.duty_number}`);
                });
        } else {
            existingShifts
                .filter(shift => fixedDateSet.has(shift.date))
                .forEach(shift => {
                    existingShiftKeys.add(`${shift.date}:${shift.staffId}:${shift.classType}:${shift.startTime}:${shift.endTime}`);
                    if (shift.duty_number) existingDutyKeys.add(`${shift.date}:${shift.classType}:${shift.duty_number}`);
                });
        }

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
    }, [classByName, existingShifts, fixedDates, mode, rows, staffByName, yearMonth]);

    const rowErrorCount = previewRows.reduce((sum, row) => row.skipped ? sum : sum + row.errors.length, 0);
    const importableRows = previewRows.filter(row => !row.skipped && row.errors.length === 0);
    const skippedCount = previewRows.filter(row => row.skipped).length;
    const canImport = importableRows.length > 0 && rowErrorCount === 0;
    const importing = saveBatch.isPending || replaceMonth.isPending || createSnapshot.isPending;

    const reset = () => {
        setFileName('');
        setRows([]);
        setFileError(null);
        setMode('append');
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setFileError(null);
        setFileName(file.name);

        if (!file.name.toLowerCase().endsWith('.csv')) {
            setRows([]);
            setFileError('CSVファイルを選択してください');
            return;
        }

        const text = await file.text();
        const parsed = parseCsv(text);
        if (parsed.length < 2) {
            setRows([]);
            setFileError('ヘッダー行とデータ行が必要です');
            return;
        }

        const headerMap = buildHeaderMap(parsed[0]);
        const required: Array<keyof Omit<ParsedRow, 'rowNumber' | 'dutyNumber'>> = ['date', 'staffName', 'className', 'startTime', 'endTime'];
        const missing = required.filter(key => !headerMap.has(key));
        if (missing.length > 0) {
            setRows([]);
            setFileError('必須列が不足しています: date, staffName, className, startTime, endTime');
            return;
        }

        const nextRows = parsed.slice(1).map((cells, index) => ({
            rowNumber: index + 2,
            date: cells[headerMap.get('date')!] ?? '',
            staffName: cells[headerMap.get('staffName')!] ?? '',
            className: cells[headerMap.get('className')!] ?? '',
            startTime: cells[headerMap.get('startTime')!] ?? '',
            endTime: cells[headerMap.get('endTime')!] ?? '',
            dutyNumber: headerMap.has('dutyNumber') ? (cells[headerMap.get('dutyNumber')!] ?? '') : '',
        }));

        setRows(nextRows);
    };

    const handleImport = async () => {
        if (!canImport) return;
        const fixedDateSet = new Set(Array.from(fixedDates).filter(date => date.startsWith(yearMonth)));
        const shifts = importableRows
            .map(toShift)
            .filter(shift => mode === 'append' || !fixedDateSet.has(shift.date));

        try {
            await createSnapshot.mutateAsync({
                yearMonth,
                reason: 'before-import',
                label: `${yearMonth} CSV取込前`,
            });

            if (mode === 'replace') {
                await replaceMonth.mutateAsync({
                    yearMonth,
                    shifts,
                    fixedDates: Array.from(fixedDates).filter(date => date.startsWith(yearMonth)),
                });
            } else {
                await saveBatch.mutateAsync(shifts);
            }

            toast.success(`${shifts.length}件のシフトを取り込みました`);
            onImported();
            handleClose();
        } catch (err) {
            handleApiError(err, 'シフトの取り込みに失敗しました');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} zIndex="z-[90]">
            <div role="dialog" aria-modal="true" className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                            <FileUp className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">CSV取り込み</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{yearMonth}</p>
                        </div>
                    </div>
                    <button type="button" onClick={handleClose} aria-label="閉じる" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                        <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-400 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            {fileName || 'CSVファイルを選択'}
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={(e) => handleFile(e.target.files?.[0])}
                            />
                        </label>

                        <div className="flex rounded-xl border border-slate-200 dark:border-slate-600 p-1 bg-white dark:bg-slate-900">
                            {([
                                { key: 'append', label: '追加' },
                                { key: 'replace', label: '上書き' },
                            ] as const).map(item => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setMode(item.key)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mode === item.key ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'replace' && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            上書きする場合も、ロック済みの日付の既存シフトは保持します。取り込み前の状態は自動でバックアップされます。
                        </div>
                    )}

                    {fileError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                            <AlertCircle className="w-4 h-4 mt-0.5" />
                            {fileError}
                        </div>
                    )}

                    {rowErrorCount > 0 && (
                        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300 max-h-32 overflow-y-auto">
                            {previewRows.filter(row => !row.skipped && row.errors.length > 0).map(row => (
                                <p key={row.rowNumber}>{row.rowNumber}行目: {row.errors.join('、')}</p>
                            ))}
                        </div>
                    )}

                    <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                        {previewRows.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                                列: date, staffName, className, startTime, endTime, dutyNumber
                            </div>
                        ) : (
                            <div className="max-h-[360px] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="text-left px-3 py-2">行</th>
                                            <th className="text-left px-3 py-2">日付</th>
                                            <th className="text-left px-3 py-2">スタッフ</th>
                                            <th className="text-left px-3 py-2">クラス</th>
                                            <th className="text-left px-3 py-2">時間</th>
                                            <th className="text-left px-3 py-2">番号</th>
                                            <th className="text-left px-3 py-2">状態</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {previewRows.slice(0, 200).map(row => (
                                            <tr key={row.rowNumber} className="text-slate-700 dark:text-slate-200">
                                                <td className="px-3 py-2">{row.rowNumber}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                                <td className="px-3 py-2">{row.staffName}</td>
                                                <td className="px-3 py-2">{row.className}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">{row.startTime} - {row.endTime}</td>
                                                <td className="px-3 py-2">{row.dutyNumber || '-'}</td>
                                                <td className="px-3 py-2">
                                                    {row.skipped ? (
                                                        <span className="text-slate-500 dark:text-slate-400 font-bold">スキップ</span>
                                                    ) : row.errors.length === 0 ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">OK</span>
                                                    ) : (
                                                        <span className="text-red-600 dark:text-red-400 font-bold">エラー</span>
                                                    )}
                                                    {row.skipReason && <span className="block text-xs text-slate-400">{row.skipReason}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {previewRows.length > 0 ? `${previewRows.length}件を読み込み済み / 取込 ${importableRows.length}件 / スキップ ${skippedCount}件` : 'CSVを選択してください'}
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={handleClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={!canImport || importing}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                                取り込む
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ShiftImportModal;

import { useMemo, useRef, useState } from 'react';
import { AlertCircle, FileUp, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../../../components/ui/Modal';
import { useCreateShiftSnapshot, useReplaceShiftsForMonth, useSaveShiftsBatch } from '../../../lib/hooks';
import { handleApiError } from '../../../lib/errorHandler';
import type { Shift, ShiftClass, Staff } from '../../../types';
import {
    buildShiftImportPreview, MAX_CSV_FILE_BYTES, parseShiftImportCsv, toImportedShift,
    type ImportMode, type ParsedImportRow,
} from '../utils/shiftImport';

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
    const [rows, setRows] = useState<ParsedImportRow[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [mode, setMode] = useState<ImportMode>('append');

    const saveBatch = useSaveShiftsBatch();
    const replaceMonth = useReplaceShiftsForMonth();
    const createSnapshot = useCreateShiftSnapshot();

    const previewRows = useMemo(() => buildShiftImportPreview({
        rows, yearMonth, staffList, classes, existingShifts, fixedDates, mode,
    }), [classes, existingShifts, fixedDates, mode, rows, staffList, yearMonth]);

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
        if (file.size > MAX_CSV_FILE_BYTES) {
            setRows([]);
            setFileError('CSVファイルは2MB以下にしてください');
            return;
        }

        let text: string;
        try {
            text = await file.text();
        } catch {
            setRows([]);
            setFileError('CSVファイルを読み込めませんでした');
            return;
        }
        const parsed = parseShiftImportCsv(text);
        if (parsed.error) {
            setRows([]);
            setFileError(parsed.error);
            return;
        }
        setRows(parsed.rows);
    };

    const handleImport = async () => {
        if (!canImport) return;
        const fixedDateSet = new Set(Array.from(fixedDates).filter(date => date.startsWith(yearMonth)));
        const shifts = importableRows
            .map(toImportedShift)
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
        <Modal isOpen={isOpen} onClose={handleClose} zIndex="z-[90]" aria-label="CSV取り込み">
            <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
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
                        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                            <AlertCircle className="w-4 h-4 mt-0.5" />
                            {fileError}
                        </div>
                    )}

                    {rowErrorCount > 0 && (
                        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300 max-h-32 overflow-y-auto">
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

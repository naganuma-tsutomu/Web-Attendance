import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';
import { calculateDuration } from './timeUtils';
import type { Staff, Shift, ShiftClass, ShiftTimePattern, BusinessHours } from '../types';

/**
 * デフォルト営業時間
 * 15分刻み
 */
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 19;
const SLOTS_PER_HOUR = 4;

/**
 * HH:MM 形式を Excel 用の数値（1日=1.0）に変換
 */
const timeToExcelValue = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60 + m) / (24 * 60);
};

const getClassColor = (classId: string) => {
    let hash = 0;
    for (let i = 0; i < classId.length; i++) {
        hash = classId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    const hex = '000000'.substring(0, 6 - c.length) + c;
    const r = Math.floor((parseInt(hex.substring(0, 2), 16) + 255) / 2);
    const g = Math.floor((parseInt(hex.substring(2, 4), 16) + 255) / 2);
    const b = Math.floor((parseInt(hex.substring(4, 6), 16) + 255) / 2);
    return `FF${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
};

export const exportToExcelAdvanced = async (
    yearMonth: string,
    staffs: Staff[],
    shifts: Shift[],
    classes: ShiftClass[],
    _timePatterns: ShiftTimePattern[],
    businessHours?: BusinessHours
) => {
    const START_HOUR = businessHours?.startHour ?? DEFAULT_START_HOUR;
    const END_HOUR = businessHours?.endHour ?? DEFAULT_END_HOUR;
    const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        toast.error('年月の形式が正しくありません（例: 2025-01）');
        return;
    }
    const toastId = toast.loading('Excelファイルを生成中...');
    try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('シフト表');

    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // --- カラム定義 ---
    const columns: any[] = [
        { header: '日', key: 'day', width: 4 },
        { header: '曜', key: 'dow', width: 4 },
        { header: '氏名', key: 'name', width: 12 },
        { header: '区分', key: 'class', width: 10 },
        { header: '開始', key: 'start', width: 8 },
        { header: '終了', key: 'end', width: 8 },
        { header: '実働', key: 'duration', width: 6 },
    ];

    // タイムラインのヘッダー（15分刻み、数値としての時間を非表示行に持たせる）
    for (let i = 0; i <= TOTAL_SLOTS; i++) {
        const hour = START_HOUR + Math.floor(i / 4);
        const min = (i % 4) * 15;
        const timeStr = `${hour}:${min === 0 ? '00' : String(min).padStart(2, '0')}`;
        columns.push({ header: min === 0 ? timeStr : '', key: `t_${i}`, width: 2.5 });
    }

    worksheet.columns = columns;

    // ヘッダー行の時刻セルを1時間単位で結合（4スロット = 15分×4）
    for (let h = 0; h < END_HOUR - START_HOUR; h++) {
        const startCol = 8 + h * 4;
        worksheet.mergeCells(1, startCol, 1, startCol + 3);
    }

    let currentRow = 2;
    const dateRowRanges: { start: number, end: number }[] = [];

    days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayShifts = shifts.filter(s => s.date === dateStr);
        const startRowForDay = currentRow;

        if (dayShifts.length === 0) {
            worksheet.addRow({
                day: format(day, 'd'),
                dow: format(day, 'E', { locale: ja }),
            });
            currentRow++;
        } else {
            // クラス順にソート
            const sortedDayShifts = [...dayShifts].sort((a, b) => {
                const classA = classes.find(c => c.id === a.classType);
                const classB = classes.find(c => c.id === b.classType);
                return (classA?.display_order || 0) - (classB?.display_order || 0);
            });

            sortedDayShifts.forEach((shift) => {
                const staff = staffs.find(s => s.id === shift.staffId);
                const shiftClass = classes.find(c => c.id === shift.classType);

                const rowData: any = {
                    day: format(day, 'd'),
                    dow: format(day, 'E', { locale: ja }),
                    name: staff ? staff.name : '未割当',
                    class: shiftClass ? shiftClass.name : '',
                    start: shift.startTime,
                    end: shift.endTime,
                };

                const row = worksheet.addRow(rowData);

                // 実働時間の数式: 日またぎ対応（end < start の場合 +1日）
                const startCell = row.getCell(5).address;
                const endCell = row.getCell(6).address;
                const duration = calculateDuration(shift.startTime, shift.endTime);
                row.getCell(7).value = {
                    formula: `IF(OR(ISBLANK(${startCell}), ISBLANK(${endCell})), 0, IF((${endCell}-${startCell})<0, (${endCell}-${startCell}+1)*24, (${endCell}-${startCell})*24))`,
                    result: duration
                };
                row.getCell(7).numFmt = '0.00';

                // 開始・終了セルのデータ型を時刻に設定
                row.getCell(5).numFmt = 'hh:mm';
                row.getCell(5).value = timeToExcelValue(shift.startTime);
                row.getCell(6).numFmt = 'hh:mm';
                row.getCell(6).value = timeToExcelValue(shift.endTime);

                currentRow++;
            });

            if (dayShifts.length > 1) {
                worksheet.mergeCells(startRowForDay, 1, currentRow - 1, 1);
                worksheet.mergeCells(startRowForDay, 2, currentRow - 1, 2);
            }
        }
        dateRowRanges.push({ start: startRowForDay, end: currentRow - 1 });
    });

    const lastRow = currentRow - 1;

    // --- 条件付き書式 (土日) ---
    worksheet.addConditionalFormatting({
        ref: `A2:G${lastRow}`,
        rules: [
            { type: 'expression', formulae: ['$B2="日"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFCCCC' } } } },
            { type: 'expression', formulae: ['$B2="土"'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFCCE5FF' } } } },
        ]
    });

    // --- 条件付き書式 (タイムラインの動的色付け) ---
    // COLUMN()を使って1クラス=1ルールで全スロットをカバー（クラス数分のみ）
    // スロット時間 = (START_HOUR*60 + (COLUMN()-8)*15) / 1440
    const firstTimelineCol = worksheet.getColumn(8).letter;
    const lastTimelineCol = worksheet.getColumn(8 + TOTAL_SLOTS).letter;
    const slotFormula = `(${START_HOUR * 60}+(COLUMN()-8)*15)/1440`;

    classes.forEach(cls => {
        const barColor = cls.color
            ? `FF${cls.color.replace('#', '').toUpperCase()}`
            : getClassColor(cls.id);
        const escapedName = cls.name.replace(/"/g, '""');
        worksheet.addConditionalFormatting({
            ref: `${firstTimelineCol}2:${lastTimelineCol}${lastRow}`,
            rules: [
                {
                    type: 'expression',
                    // $D2=区分, $E2=開始, $F2=終了, COLUMN()で現在列のスロット時間を動的計算
                    formulae: [`AND($D2="${escapedName}",$E2<=${slotFormula},$F2>${slotFormula})`],
                    priority: 1,
                    style: {
                        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: barColor } },
                        border: {
                            top: { style: 'thin', color: { argb: 'FF888888' } },
                            bottom: { style: 'thin', color: { argb: 'FF888888' } },
                            left: { style: 'thin', color: { argb: 'FF888888' } },
                            right: { style: 'thin', color: { argb: 'FF888888' } },
                        }
                    }
                }
            ]
        });
    });

    // --- スタイル仕上げ ---
    const totalCols = 8 + TOTAL_SLOTS;
    const dateStartRows = new Set(dateRowRanges.map(r => r.start));
    const dateEndRows = new Set(dateRowRanges.map(r => r.end));

    for (let rowNumber = 1; rowNumber <= lastRow; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const isDateStart = dateStartRows.has(rowNumber);
        const isDateEnd = dateEndRows.has(rowNumber);

        for (let colNumber = 1; colNumber <= totalCols; colNumber++) {
            const cell = row.getCell(colNumber);
            const isFirstCol = colNumber === 1;
            const isLastCol = colNumber === totalCols;
            const isHourBoundary = colNumber === 7 || (colNumber > 7 && (colNumber - 8) % 4 === 3);

            cell.border = {
                top: { style: rowNumber === 1 ? 'thin' : isDateStart ? 'medium' : 'thin' },
                bottom: { style: isDateEnd ? 'medium' : 'thin' },
                left: { style: isFirstCol ? 'medium' : 'thin' },
                right: { style: isLastCol ? 'medium' : isHourBoundary ? 'medium' : 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            if (rowNumber === 1) {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            }
        }
    }

    // 書き出し
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `シフト詳細表_${yearMonth}_数式連動.xlsx`);
    toast.success('Excelファイルを出力しました', { id: toastId });
    } catch (err) {
        console.error('Excel出力エラー:', err);
        toast.error('Excelファイルの出力に失敗しました', { id: toastId });
    }
};

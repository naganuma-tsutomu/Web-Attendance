import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Staff, Shift, ShiftClass, ShiftTimePattern } from '../types';

/**
 * 営業時間は 8:00 - 19:00
 * 15分刻み
 */
const START_HOUR = 8;
const END_HOUR = 19;
const SLOTS_PER_HOUR = 4;
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;

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
    _timePatterns: ShiftTimePattern[]
) => {
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

    let currentRow = 2;

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

                // 実働時間の数式: =(終了 - 開始) * 24
                const startCell = row.getCell(5).address;
                const endCell = row.getCell(6).address;
                row.getCell(7).value = {
                    formula: `IF(OR(ISBLANK(${startCell}), ISBLANK(${endCell})), 0, (${endCell}-${startCell})*24)`,
                    result: 0
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
    // カラムH(8)から
    for (let i = 0; i <= TOTAL_SLOTS; i++) {
        const colLetter = worksheet.getColumn(8 + i).letter;
        const currentSlotTime = (START_HOUR * 60 + i * 15) / (24 * 60);

        // 各クラスごとに色を設定（区分セルと連動）
        classes.forEach(cls => {
            const barColor = getClassColor(cls.id);
            worksheet.addConditionalFormatting({
                ref: `${colLetter}2:${colLetter}${lastRow}`,
                rules: [
                    {
                        type: 'expression',
                        // 数式: (=AND(区分セル=クラス名, 開始セル<=現在のスロット, 終了セル>現在のスロット))
                        // $D2 は区分, $E2 は開始, $F2 は終了
                        formulae: [`AND($D2="${cls.name}", $E2<=${currentSlotTime.toFixed(10)}, $F2>${currentSlotTime.toFixed(10)})`],
                        priority: 1,
                        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: barColor } } }
                    }
                ]
            });
        });
    }

    // --- スタイル仕上げ ---
    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: (rowNumber > 1 && colNumber <= 7 && row.getCell(1).value !== worksheet.getRow(rowNumber + 1).getCell(1).value) ? 'medium' : 'thin' },
                left: { style: 'thin' },
                right: { style: colNumber === 7 || (colNumber > 7 && (colNumber - 8) % 4 === 3) ? 'medium' : 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            if (rowNumber === 1) {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            }
        });
    });

    // 書き出し
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `シフト詳細表_${yearMonth}_数式連動.xlsx`);
};

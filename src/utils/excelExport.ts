import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';
import { calculateDuration } from './timeUtils';
import { handleApiError } from '../lib/errorHandler';
import { createHolidayMap, isHoliday } from '../lib/holidayUtils';
import type { Staff, Shift, ShiftClass, ShiftTimePattern, BusinessHours, ShiftPreference, Holiday, ExcelSettings } from '../types';

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
    businessHours?: BusinessHours,
    preferences: ShiftPreference[] = [],
    holidays: Holiday[] = [],
    excelSettings?: ExcelSettings
) => {
    const holidayMap = createHolidayMap(holidays);
    // 休日理由の判定と色・テキストを返す
    const getHolidayInfo = (staff: Staff, date: Date, dateStr: string) => {
        const pref = preferences.find(p => p.staffId === staff.id);
        const detail = pref?.details?.find(d => d.date === dateStr);

        if (detail?.type === 'training') {
            return { text: '[研] ' + staff.name, color: 'FFFFA500' }; // Orange
        }

        // 希望休（終日または一部）
        if (detail) {
            return { text: '[希] ' + staff.name, color: 'FFFF0000' }; // Red
        }

        // 固定休の判定
        const dayOfWeek = getDay(date);
        const nthWeek = Math.ceil(date.getDate() / 7);
        const hasAvailableConfig = (staff as any).availableDays?.some((d: any) => {
            const dayNum = typeof d === 'number' ? d : d.day;
            const weekMatch = typeof d === 'number' || !d.weeks || d.weeks.includes(nthWeek);
            return dayNum === dayOfWeek && weekMatch;
        });

        if (!hasAvailableConfig) {
            return { text: '[固] ' + staff.name, color: 'FFFF0000' }; // Red
        }

        // 理由はないがシフトなし
        return { text: staff.name, color: 'FF888888' }; // Gray
    };

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
        { header: '休み', key: 'holiday_name', width: 12 },
        { header: '氏名', key: 'name', width: 12 },
        { header: '区分', key: 'class', width: 10 },
        { header: '開始', key: 'start', width: 8 },
        { header: '終了', key: 'end', width: 8 },
        { header: '実働', key: 'duration', width: 6 },
    ];

    // タイムラインのヘッダー（15分刻み）
    for (let i = 0; i < TOTAL_SLOTS; i++) {
        const hour = START_HOUR + Math.floor(i / 4);
        const min = (i % 4) * 15;
        const timeStr = `${hour}:${min === 0 ? '00' : String(min).padStart(2, '0')}`;
        columns.push({ header: min === 0 ? timeStr : '', key: `t_${i}`, width: 2.5 });
    }

    worksheet.columns = columns;

    // --- 1行目: 年月タイトル行 ---
    const totalCols = 8 + TOTAL_SLOTS;
    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = `${year}年${month}月`;
    worksheet.mergeCells(1, 1, 1, totalCols);
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
    titleRow.height = 24;

    // 2行目: 列ヘッダー行を挿入
    worksheet.insertRow(2, columns.map((c: any) => c.header));

    // ヘッダー行(2行目)の時刻セルを1時間単位で結合
    for (let h = 0; h < END_HOUR - START_HOUR; h++) {
        const startCol = 9 + h * 4; // 休み列追加で+1
        worksheet.mergeCells(2, startCol, 2, startCol + 3);
    }

    let currentRow = 3;
    const dateRowRanges: { start: number, end: number }[] = [];

    days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);
        if (isHoliday(dateStr, holidayMap) || businessHours?.closedDays?.includes(dayOfWeek)) return;

        const dayShifts = shifts.filter(s => s.date === dateStr);
        const startRowForDay = currentRow;

        // 出勤スタッフのソート
        const sortedDayShifts = [...dayShifts].sort((a, b) => {
            const classA = classes.find(c => c.id === a.classType);
            const classB = classes.find(c => c.id === b.classType);
            return (classA?.display_order || 0) - (classB?.display_order || 0);
        });

        // 休日スタッフの抽出
        const isSaturday = dayOfWeek === 6;
        let holidayStaffs = staffs.filter(s => !dayShifts.some(shift => shift.staffId === s.id))
            .map(s => getHolidayInfo(s, day, dateStr));

        // 土曜日の休日スタッフ非表示設定
        if (isSaturday && excelSettings?.excludeHolidayStaffOnSaturdays) {
            holidayStaffs = [];
        }

        const rowCount = Math.max(sortedDayShifts.length, holidayStaffs.length, 1);

        for (let i = 0; i < rowCount; i++) {
            const shift = sortedDayShifts[i];
            const holiday = holidayStaffs[i];
            const staff = shift ? staffs.find(s => s.id === shift.staffId) : null;
            const shiftClass = shift ? classes.find(c => c.id === shift.classType) : null;

            const rowData: any = {
                day: format(day, 'd'),
                dow: format(day, 'E', { locale: ja }),
            };

            if (holiday) {
                rowData.holiday_name = holiday.text;
            }

            if (shift) {
                rowData.name = staff ? staff.name : '未割当';
                rowData.class = shiftClass ? shiftClass.name : '';
                rowData.start = shift.startTime;
                rowData.end = shift.endTime;
            }

            // ハイライトルールの判定
            let rowHighlightColor: string | null = null;
            if (shift && excelSettings?.highlightRules) {
                const rule = excelSettings.highlightRules.find(r => r.staffId === shift.staffId);
                if (rule && (shift.startTime !== rule.regularStartTime || shift.endTime !== rule.regularEndTime)) {
                    rowHighlightColor = rule.highlightColor;
                }
            }

            const row = worksheet.addRow(rowData);

            // 背景色の適用 (データ列 A-H)
            if (rowHighlightColor) {
                for (let colIdx = 1; colIdx <= 8; colIdx++) {
                    const cell = row.getCell(colIdx);
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: rowHighlightColor }
                    };
                }
            }

            // 休日スタッフの文字色設定
            if (holiday) {
                const cell = row.getCell(3); // 休み列
                cell.font = { color: { argb: holiday.color } };
            }

            if (shift) {
                // 実働時間の数式
                const startCell = row.getCell(6).address;
                const endCell = row.getCell(7).address;
                const duration = calculateDuration(shift.startTime, shift.endTime);
                row.getCell(8).value = {
                    formula: `IF(OR(ISBLANK(${startCell}), ISBLANK(${endCell})), 0, IF((${endCell}-${startCell})<0, (${endCell}-${startCell}+1)*24, (${endCell}-${startCell})*24))`,
                    result: duration
                };
                row.getCell(8).numFmt = '0.00';

                // 開始・終了セルのデータ型
                row.getCell(6).numFmt = 'hh:mm';
                row.getCell(6).value = timeToExcelValue(shift.startTime);
                row.getCell(7).numFmt = 'hh:mm';
                row.getCell(7).value = timeToExcelValue(shift.endTime);
            }

            currentRow++;
        }

        if (rowCount > 1) {
            worksheet.mergeCells(startRowForDay, 1, currentRow - 1, 1);
            worksheet.mergeCells(startRowForDay, 2, currentRow - 1, 2);
        }
        dateRowRanges.push({ start: startRowForDay, end: currentRow - 1 });
    });

    const lastRow = currentRow - 1;

    // --- 条件付き書式 (土日) ---
    worksheet.addConditionalFormatting({
        ref: `A3:H${lastRow}`,
        rules: [
            { type: 'expression', formulae: ['$B3="日"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFCCCC' } } } },
            { type: 'expression', formulae: ['$B3="土"'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFCCE5FF' } } } },
        ]
    });

    // --- 条件付き書式 (タイムラインの動的色付け) ---
    const firstTimelineCol = worksheet.getColumn(9).letter;
    const lastTimelineCol = worksheet.getColumn(8 + TOTAL_SLOTS).letter;
    const slotFormula = `(${START_HOUR * 60}+(COLUMN()-9)*15)/1440`;

    classes.forEach(cls => {
        const barColor = cls.color
            ? `FF${cls.color.replace('#', '').toUpperCase()}`
            : getClassColor(cls.id);
        const escapedName = cls.name.replace(/"/g, '""');
        worksheet.addConditionalFormatting({
            ref: `${firstTimelineCol}3:${lastTimelineCol}${lastRow}`,
            rules: [
                {
                    type: 'expression',
                    // $E3=区分, $F3=開始, $G3=終了, COLUMN()で現在列のスロット時間を動的計算
                    formulae: [`AND($E3="${escapedName}",$F3<=${slotFormula},$G3>${slotFormula})`],
                    priority: 1,
                    style: {
                        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: barColor } }
                    }
                }
            ]
        });
    });

    // --- スタイル仕上げ ---
    const dateStartRows = new Set(dateRowRanges.map(r => r.start));
    const dateEndRows = new Set(dateRowRanges.map(r => r.end));

    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const isDateStart = dateStartRows.has(rowNumber);
        const isDateEnd = dateEndRows.has(rowNumber);

        for (let colNumber = 1; colNumber <= totalCols; colNumber++) {
            const cell = row.getCell(colNumber);
            const isFirstCol = colNumber === 1;
            const isLastCol = colNumber === totalCols;

            cell.border = {
                top: { style: rowNumber === 2 ? 'thin' : isDateStart ? 'medium' : 'thin' },
                bottom: { style: isDateEnd ? 'medium' : 'thin' },
                left: { style: isFirstCol ? 'medium' : 'thin' },
                right: { style: isLastCol ? 'medium' : 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            if (rowNumber === 2) {
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
        handleApiError(err, 'Excelファイルの出力に失敗しました');
    }
};

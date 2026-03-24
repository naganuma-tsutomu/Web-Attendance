import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, eachDayOfInterval, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Staff, Shift } from '../types';
import { formatHours, calculateDuration } from '../utils/timeUtils';
import { toast } from 'sonner';

/**
 * シフトデータをExcel形式で書き出す
 */
export const exportToExcel = (yearMonth: string, staffs: Staff[], shifts: Shift[]) => {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        toast.error('年月の形式が正しくありません（例: 2025-01）');
        return;
    }
    try {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // ヘッダー行作成: [名前, 1日, 2日, ..., 合計時間]
    const header = ['名前', ...days.map(d => format(d, 'd(E)', { locale: ja })), '合計時間'];

    // データ行作成
    const rows = staffs.map(staff => {
        const rowData: any[] = [staff.name];
        let totalMinutes = 0;

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd'); // 正しい日フォーマット

            const dayShifts = shifts.filter(s => s.staffId === staff.id && s.date === dateStr);

            if (dayShifts.length > 0) {
                const shiftTexts = dayShifts.map(s => `${s.startTime}-${s.endTime}`).join('\n');
                rowData.push(shiftTexts);

                dayShifts.forEach(dayShift => {
                    totalMinutes += calculateDuration(dayShift.startTime, dayShift.endTime) * 60;
                });
            } else {
                rowData.push('');
            }
        });

        const totalHours = formatHours(totalMinutes / 60);
        rowData.push(totalHours);
        return rowData;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'シフト表');

    // ファイル保存
    XLSX.writeFile(workbook, `シフト表_${yearMonth}.xlsx`);
    toast.success('Excelファイルを出力しました');
    } catch (err) {
        console.error('Excel出力エラー:', err);
        toast.error('Excelファイルの出力に失敗しました');
    }
};

/**
 * シフトデータをPDF形式で書き出す
 * 注意: jsPDFのデフォルトフォントは日本語に未対応のため、本来はカスタムフォント（TTF）の組み込みが必要。
 * ここでは、ブラウザの印刷機能（PDF保存）を代替案として示唆しつつ、基本的なテーブル構造のみ実装する。
 */
export const exportToPDF = (yearMonth: string, staffs: Staff[], shifts: Shift[]) => {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        toast.error('年月の形式が正しくありません（例: 2025-01）');
        return;
    }
    try {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const title = `${year}年${month}月 シフト予定表`;

    // jsPDFオートテーブルのヘッダー
    const head = [['名前', ...days.map(d => format(d, 'd')), '合計']];

    // データ
    const body = staffs.map(staff => {
        let totalMinutes = 0;
        const row = [staff.name];

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd'); // 注意: formatの仕方に注意 (YYYY-MM-DD)
            const dayShifts = shifts.filter(s => s.staffId === staff.id && s.date === dateStr);

            if (dayShifts.length > 0) {
                // PDFはスペースが狭いため略記 (例: 10-18)
                const shiftTexts = dayShifts.map(dayShift => {
                    const [sh] = dayShift.startTime.split(':');
                    const [eh] = dayShift.endTime.split(':');
                    return `${sh}-${eh}`;
                }).join('\n');
                row.push(shiftTexts);

                dayShifts.forEach(dayShift => {
                    totalMinutes += calculateDuration(dayShift.startTime, dayShift.endTime) * 60;
                });
            } else {
                row.push('');
            }
        });

        row.push(formatHours(totalMinutes / 60));
        return row;
    });

    // 日本語フォントの問題があるため、本当はここでフォントをセットする
    // doc.addFont('JapaneseFont.ttf', 'JapaneseFont', 'normal');
    // doc.setFont('JapaneseFont');

    doc.text(title, 14, 15);

    autoTable(doc, {
        head: head,
        body: body,
        startY: 20,
        styles: { fontSize: 8, cellPadding: 1, font: 'helvetica' }, // フォントが効かない場合は英数字のみになる
        headStyles: { fillColor: [66, 133, 244] },
    });

    doc.save(`シフト表_${yearMonth}.pdf`);

    toast.warning('PDFの日本語表示には制限がある場合があります。きれいに印刷する場合はブラウザの印刷機能をご利用ください。', { duration: 6000 });
    } catch (err) {
        console.error('PDF出力エラー:', err);
        toast.error('PDFファイルの出力に失敗しました');
    }
};

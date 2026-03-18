import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, eachDayOfInterval, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Staff, Shift } from '../types';
import { formatHours } from '../utils/timeUtils';
import { toast } from 'sonner';

/**
 * シフトデータをExcel形式で書き出す
 */
export const exportToExcel = (yearMonth: string, staffs: Staff[], shifts: Shift[]) => {
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

            const dayShift = shifts.find(s => s.staffId === staff.id && s.date === dateStr);

            if (dayShift) {
                const startTime = dayShift.startTime;
                const endTime = dayShift.endTime;
                rowData.push(`${startTime}-${endTime}`);

                // 時間計算 (簡易)
                const [sh, sm] = startTime.split(':').map(Number);
                const [eh, em] = endTime.split(':').map(Number);
                const diff = (eh * 60 + em) - (sh * 60 + sm);
                totalMinutes += diff;
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
};

/**
 * シフトデータをPDF形式で書き出す
 * 注意: jsPDFのデフォルトフォントは日本語に未対応のため、本来はカスタムフォント（TTF）の組み込みが必要。
 * ここでは、ブラウザの印刷機能（PDF保存）を代替案として示唆しつつ、基本的なテーブル構造のみ実装する。
 */
export const exportToPDF = (yearMonth: string, staffs: Staff[], shifts: Shift[]) => {
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
            const dayShift = shifts.find(s => s.staffId === staff.id && s.date === dateStr);

            if (dayShift) {
                // PDFはスペースが狭いため略記 (例: 10-18)
                const [sh] = dayShift.startTime.split(':');
                const [eh] = dayShift.endTime.split(':');
                row.push(`${sh}-${eh}`);

                const [shm, sm] = dayShift.startTime.split(':').map(Number);
                const [ehm, em] = dayShift.endTime.split(':').map(Number);
                totalMinutes += (ehm * 60 + em) - (shm * 60 + sm);
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
};

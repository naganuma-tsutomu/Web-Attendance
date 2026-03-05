import * as XLSX from 'xlsx';

// 仮のデータ構造
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  breakTimeMinutes: number;
  workTimeHours: number;
}

export const mockAttendanceData: AttendanceRecord[] = [
  {
    id: '1',
    employeeId: 'EMP001',
    employeeName: '山田 太郎',
    date: '2026-03-01',
    startTime: '09:00',
    endTime: '18:00',
    breakTimeMinutes: 60,
    workTimeHours: 8,
  },
  {
    id: '2',
    employeeId: 'EMP001',
    employeeName: '山田 太郎',
    date: '2026-03-02',
    startTime: '09:00',
    endTime: '18:30',
    breakTimeMinutes: 60,
    workTimeHours: 8.5,
  },
  {
    id: '3',
    employeeId: 'EMP002',
    employeeName: '佐藤 花子',
    date: '2026-03-01',
    startTime: '10:00',
    endTime: '19:00',
    breakTimeMinutes: 60,
    workTimeHours: 8,
  },
];

export const exportToExcel = (data: AttendanceRecord[], filename: string = 'attendance_export.xlsx') => {
  // 1. データをSheetJS用の形式（配列の配列、またはオブジェクトの配列）に変換
  const worksheetData = data.map((record) => ({
    '日付': record.date,
    '社員ID': record.employeeId,
    '氏名': record.employeeName,
    '出勤時間': record.startTime,
    '退勤時間': record.endTime,
    '休憩時間(分)': record.breakTimeMinutes,
    '実働時間(時間)': record.workTimeHours,
  }));

  // 2. ワークシートを作成
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // 3. 列幅の調整（見やすくするため）
  worksheet['!cols'] = [
    { wch: 12 }, // 日付
    { wch: 10 }, // 社員ID
    { wch: 15 }, // 氏名
    { wch: 10 }, // 出勤時間
    { wch: 10 }, // 退勤時間
    { wch: 15 }, // 休憩時間
    { wch: 15 }, // 実働時間
  ];

  // 4. ワークブックを作成し、シートを追加
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '勤怠データ');

  // 5. エクセルファイルとしてブラウザからダウンロードさせる
  XLSX.writeFile(workbook, filename);
};

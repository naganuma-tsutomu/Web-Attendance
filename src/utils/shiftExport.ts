import * as XLSX from 'xlsx';

export interface Employee {
  id: string;
  name: string;
}

export interface ShiftDay {
  date: string; // YYYY-MM-DD
  type: 'work' | 'off' | 'holiday';
}

export interface EmployeeShift {
  employeeId: string;
  employeeName: string;
  shifts: { [date: string]: 'work' | 'off' | 'holiday' };
}

// 初期モックデータ（3月分）
export const mockEmployees: Employee[] = [
  { id: '1', name: '山田 太郎' },
  { id: '2', name: '佐藤 花子' },
  { id: '3', name: '鈴木 一郎' },
];

export const generateMonthDays = (year: number, month: number) => {
  const days = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    days.push(new Date(date).toISOString().split('T')[0]);
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const exportShiftToExcel = (employees: Employee[], days: string[], shifts: { [empId: string]: { [date: string]: string } }, filename: string) => {
  // 1. ヘッダー作成 (名前, 1日, 2日, ...)
  const header = ['従業員名', ...days.map(d => d.split('-')[2] + '日')];

  // 2. データ行作成
  const rows = employees.map(emp => {
    const rowData = [emp.name];
    days.forEach(day => {
      const shiftType = shifts[emp.id]?.[day] || 'work';
      rowData.push(shiftType === 'off' ? '休' : shiftType === 'holiday' ? '公' : '出');
    });
    return rowData;
  });

  // 3. ワークシート作成
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'シフト表');

  // 4. ダウンロード
  XLSX.writeFile(wb, filename);
};

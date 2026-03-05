import { useState, useMemo, useEffect } from 'react'
import AppLayout from './components/layout/AppLayout'
import EmployeeManagement from './components/EmployeeManagement'
import { Employee, generateMonthDays, exportShiftToExcel } from './utils/shiftExport'
import { Download, UserPlus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

const STORAGE_KEYS = {
  EMPLOYEES: 'web_attendance_employees',
  SHIFTS: 'web_attendance_shifts'
};

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<'shift' | 'employees'>('shift');
  const [year] = useState(2026);
  const [month] = useState(3);
  const days = useMemo(() => generateMonthDays(year, month), [year, month]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<{ [empId: string]: { [date: string]: string } }>({});

  // Load from LocalStorage
  useEffect(() => {
    const savedEmployees = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    const savedShifts = localStorage.getItem(STORAGE_KEYS.SHIFTS);

    if (savedEmployees) {
      setEmployees(JSON.parse(savedEmployees));
    } else {
      // Initial defaults if empty
      setEmployees([
        { id: '1', name: '山田 太郎' },
        { id: '2', name: '佐藤 花子' }
      ]);
    }

    if (savedShifts) {
      setShifts(JSON.parse(savedShifts));
    }

    setIsLoaded(true);
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    }
  }, [employees, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
    }
  }, [shifts, isLoaded]);

  const toggleShift = (empId: string, date: string) => {
    setShifts(prev => {
      const empShifts = prev[empId] || {};
      const current = empShifts[date] || 'work';
      const next = current === 'work' ? 'off' : 'work';
      return {
        ...prev,
        [empId]: { ...empShifts, [date]: next }
      };
    });
  };

  const handleExport = () => {
    exportShiftToExcel(employees, days, shifts, `shift_${year}_${month}.xlsx`);
  };

  const addEmployee = (name: string) => {
    const newEmp: Employee = {
      id: Date.now().toString(),
      name
    };
    setEmployees([...employees, newEmp]);
  };

  const removeEmployee = (id: string) => {
    setEmployees(employees.filter(e => e.id !== id));
    // Optionally clean up shifts for deleted employee
    const newShifts = { ...shifts };
    delete newShifts[id];
    setShifts(newShifts);
  };

  if (!isLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'shift' ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden flex flex-col h-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ChevronLeft className="h-5 w-5 text-slate-400 cursor-not-allowed" />
                {year}年{month}月 シフト作成
                <ChevronRight className="h-5 w-5 text-slate-400 cursor-not-allowed" />
              </h2>
              <p className="text-sm text-slate-500 mt-1">セルをクリックして「休」と「出」を切り替えます</p>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={() => setCurrentView('employees')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                従業員設定
              </button>
              <button
                onClick={handleExport}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <Download className="h-4 w-4" />
                Excel出力
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <th className="sticky left-0 bg-slate-50 dark:bg-slate-900 z-30 px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 min-w-[120px]">
                    従業員名
                  </th>
                  {days.map(day => {
                    const d = new Date(day);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th key={day} className={`px-2 py-3 text-center min-w-[40px] font-medium border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${isWeekend ? 'text-red-500 bg-red-50/50 dark:bg-red-900/10' : 'text-slate-600 dark:text-slate-400'}`}>
                        <div className="text-[10px] uppercase">{['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}</div>
                        <div>{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="py-20 text-center text-slate-400">
                      従業員が登録されていません。「従業員設定」から追加してください。
                    </td>
                  </tr>
                ) : (
                  employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50 dark:bg-slate-800 dark:group-hover:bg-slate-800/50 z-20 px-4 py-3 font-medium text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {emp.name}
                      </td>
                      {days.map(day => {
                        const shiftType = shifts[emp.id]?.[day] || 'work';
                        return (
                          <td
                            key={day}
                            onClick={() => toggleShift(emp.id, day)}
                            className={`px-1 py-1 text-center cursor-pointer transition-all border-r border-slate-100 dark:border-slate-700/50 last:border-r-0`}
                          >
                            <div className={`
                              w-8 h-8 mx-auto flex items-center justify-center rounded-md font-bold text-xs
                              ${shiftType === 'off'
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-500 hover:bg-green-100'
                              }
                            `}>
                              {shiftType === 'off' ? '休' : '出'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmployeeManagement
          employees={employees}
          onAddEmployee={addEmployee}
          onRemoveEmployee={removeEmployee}
        />
      )}
    </AppLayout>
  )
}

export default App

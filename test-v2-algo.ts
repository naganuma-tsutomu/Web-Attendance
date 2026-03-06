import { generateShiftsForMonth } from './src/lib/algorithm.js';

const staffList = [
    { id: '1', name: 'FullTime', role: '正社員', hoursTarget: 160 },
    { id: '2', name: 'SubFull', role: '準社員', hoursTarget: 135 },
    { id: '3', name: 'Part', role: 'パート', hoursTarget: 80 },
    { id: '4', name: 'Help', role: '特殊スタッフ', hoursTarget: 20, isHelpStaff: true },
];

const preferences = [];
const roleSettings = [
    { role: '正社員', defaultStartTime: '09:00', defaultEndTime: '18:00' },
    { role: '準社員', defaultStartTime: '10:00', defaultEndTime: '17:00' },
    { role: 'パート', defaultStartTime: '11:00', defaultEndTime: '15:00' },
    { role: '特殊スタッフ', defaultStartTime: '16:00', defaultEndTime: '17:00' },
];

const holidays = [];
const yearMonth = '2026-04';

const shifts = generateShiftsForMonth(yearMonth, staffList, preferences, roleSettings, holidays);

console.log(`Generated ${shifts.length} shifts.`);

// Check a specific shift
const ftShift = shifts.find(s => s.staffId === '1' && s.date === '2026-04-01');
if (ftShift) {
    console.log(`FullTime Shift: ${ftShift.startTime} - ${ftShift.endTime}`);
    if (ftShift.startTime === '09:00' || ftShift.startTime === '10:15') { // Early/Late logic might apply
        console.log("FT Shift reflects settings or early/late logic.");
    }
}

const ptShift = shifts.find(s => s.staffId === '3' && s.date === '2026-04-01');
if (ptShift) {
    console.log(`Part Shift: ${ptShift.startTime} - ${ptShift.endTime}`);
    if (ptShift.startTime === '11:00' && ptShift.endTime === '15:00') {
        console.log("PASS: Part shift reflects role settings.");
    } else {
        console.log("FAIL: Part shift does not reflect role settings.");
    }
}

import { generateShiftsForMonth } from '../src/lib/algorithm';

const staffList = [
    { id: '1', name: 'A', role: 'role_full' },
    { id: '2', name: 'B', role: 'role_full' },
    { id: '3', name: 'C', role: 'role_full' },
    { id: '4', name: 'D', role: 'role_full' },
];
const roles = [{
    id: 'role_full', name: '正社員',
    patterns: [
        { id: 'pat_early', name: '早番', startTime: '10:15', endTime: '18:00' },
        { id: 'pat_late', name: '遅番', startTime: '11:15', endTime: '18:45' }
    ]
}];
const rotationSettings = {
    enabled: true, roleId: 'role_full',
    earlyPatternId: 'pat_early', latePatternId: 'pat_late',
    weekdayEarlyCount: 1, weekdayLateCount: 2,
    saturdayEnabled: true, saturdayCount: 1, saturdayPreferFridayLate: true
};
const classes = [{ id: 'c1', name: 'クラス1' }];

const result = generateShiftsForMonth(
    '2026-06',
    staffList as any, [], roles as any, classes as any, [], [], [], [], [0],
    rotationSettings as any,
    roles[0].patterns as any,
    { enabled: false } as any
);

const summary = [];
for (let d = 1; d <= 30; d++) {
    const dateStr = `2026-06-${d.toString().padStart(2, '0')}`;
    const dayShifts = result.filter(s => s.date === dateStr);
    const early = dayShifts.filter(s => s.isEarlyShift).map(s => s.staffId).join(',');
    const late = dayShifts.filter(s => !s.isEarlyShift).map(s => s.staffId).join(',');
    summary.push(`${dateStr} | early: ${early.padEnd(5)} | late: ${late}`);
}
console.log(summary.join('\n'));

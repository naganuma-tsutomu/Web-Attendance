import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { UNASSIGNED_STAFF_ID, SHIFT_DAY } from '../constants';
import type {
    BreakSettings, BusinessDayOverride, BusinessHours, Holiday, Shift, ShiftClass,
    ShiftPreference, ShiftRequirement, Staff,
} from '../types';
import { isStaffFixedHoliday } from './availabilityUtils';
import { resolveBusinessDay } from './businessDayUtils';
import { calculateActualWorkingHours, timeRangesOverlap, timeToMinutes } from '../utils/timeUtils';
import { getWeekStartsOn } from '../utils/dateUtils';

export type ScheduleIssueSeverity = 'error' | 'warning';
export type ScheduleIssueCode =
    | 'SHIFT_OVERLAP'
    | 'UNKNOWN_STAFF'
    | 'UNKNOWN_CLASS'
    | 'DUTY_NUMBER_DUPLICATE'
    | 'FULL_DAY_PREFERENCE_CONFLICT'
    | 'PARTIAL_PREFERENCE_CONFLICT'
    | 'FIXED_DAY_OFF_CONFLICT'
    | 'TRAINING_CONFLICT'
    | 'CLOSED_DAY_SHIFT'
    | 'OUTSIDE_BUSINESS_HOURS'
    | 'CLASS_MEMBERSHIP_MISMATCH'
    | 'REQUIREMENT_SHORTAGE'
    | 'MONTHLY_HOURS_EXCEEDED'
    | 'WEEKLY_HOURS_EXCEEDED'
    | 'UNASSIGNED_SHIFT';

export interface ScheduleIssue {
    id: string;
    code: ScheduleIssueCode;
    severity: ScheduleIssueSeverity;
    date: string;
    message: string;
    staffId?: string;
    shiftId?: string;
    classId?: string;
    startTime?: string;
    endTime?: string;
    actualValue?: number;
    expectedValue?: number;
}

export interface StaffScheduleMetric {
    staffId: string;
    staffName: string;
    scheduledHours: number;
    targetHours: number | null;
    differenceHours: number | null;
    workingDays: number;
    issueCount: number;
}

export interface ClassScheduleMetric {
    classId: string;
    className: string;
    requiredSlots: number;
    filledSlots: number;
    fillRate: number;
    shortageSlots: number;
}

export interface ScheduleAnalysisResult {
    yearMonth: string;
    issues: ScheduleIssue[];
    summary: {
        errorCount: number;
        warningCount: number;
        affectedDateCount: number;
        shiftCount: number;
        assignedShiftCount: number;
        unassignedCount: number;
        scheduledHours: number;
        fillRate: number;
        submittedCount: number;
        staffCount: number;
    };
    staffMetrics: StaffScheduleMetric[];
    classMetrics: ClassScheduleMetric[];
}

export interface ScheduleAnalysisInput {
    yearMonth: string;
    shifts: Shift[];
    staffs: Staff[];
    classes: ShiftClass[];
    preferences: ShiftPreference[];
    requirements: ShiftRequirement[];
    holidays: Holiday[];
    businessDayOverrides: BusinessDayOverride[];
    businessHours?: BusinessHours;
    breakSettings?: BreakSettings;
}

const issueId = (code: ScheduleIssueCode, ...parts: Array<string | number | undefined>) =>
    [code, ...parts.filter(part => part !== undefined)].join(':');

const appliesToDay = (requirement: ShiftRequirement, day: number) =>
    requirement.dayOfWeek === SHIFT_DAY.EVERYDAY
    || (requirement.dayOfWeek === SHIFT_DAY.WEEKDAYS && day >= 1 && day <= 5)
    || requirement.dayOfWeek === day;

const isAssigned = (shift: Shift) => !shift.isError && shift.staffId !== UNASSIGNED_STAFF_ID;

const getPreferenceDetails = (preferences: ShiftPreference[], staffId: string, date: string) =>
    preferences.find(pref => pref.staffId === staffId)?.details?.filter(detail => detail.date === date) ?? [];

export const analyzeSchedule = (input: ScheduleAnalysisInput): ScheduleAnalysisResult => {
    const {
        yearMonth, staffs, classes, preferences, requirements, holidays, businessDayOverrides,
        businessHours = { startHour: 0, endHour: 24, closedDays: [] }, breakSettings,
    } = input;
    const shifts = input.shifts.filter(shift => shift.date.startsWith(yearMonth));
    const issues: ScheduleIssue[] = [];
    const staffMap = new Map(staffs.map(staff => [staff.id, staff]));
    const classMap = new Map(classes.map(shiftClass => [shiftClass.id, shiftClass]));
    const holidayMap = new Map(holidays.map(holiday => [holiday.date, holiday]));
    const overrideMap = new Map(businessDayOverrides.map(override => [override.date, override]));
    const shiftsByDate = new Map<string, Shift[]>();
    const hoursByStaff = new Map<string, number>();
    const workDatesByStaff = new Map<string, Set<string>>();
    const weeklyHours = new Map<string, number>();
    const requirementStats = new Map<string, { required: number; filled: number }>();

    for (const shiftClass of classes) requirementStats.set(shiftClass.id, { required: 0, filled: 0 });
    for (const shift of shifts) {
        const group = shiftsByDate.get(shift.date) ?? [];
        group.push(shift);
        shiftsByDate.set(shift.date, group);

        if (!staffMap.has(shift.staffId) && shift.staffId !== UNASSIGNED_STAFF_ID) {
            issues.push({ id: issueId('UNKNOWN_STAFF', shift.id), code: 'UNKNOWN_STAFF', severity: 'error', date: shift.date, shiftId: shift.id, staffId: shift.staffId, message: '存在しないスタッフが割り当てられています。' });
        }
        if (!classMap.has(shift.classType)) {
            issues.push({ id: issueId('UNKNOWN_CLASS', shift.id), code: 'UNKNOWN_CLASS', severity: 'error', date: shift.date, shiftId: shift.id, classId: shift.classType, message: '存在しないクラスが設定されています。' });
        }
        if (!isAssigned(shift)) {
            issues.push({ id: issueId('UNASSIGNED_SHIFT', shift.id), code: 'UNASSIGNED_SHIFT', severity: 'warning', date: shift.date, shiftId: shift.id, classId: shift.classType, startTime: shift.startTime, endTime: shift.endTime, message: '未割当のシフトが残っています。' });
            continue;
        }

        const staff = staffMap.get(shift.staffId);
        if (!staff) continue;
        const hours = calculateActualWorkingHours(shift.startTime, shift.endTime, breakSettings);
        hoursByStaff.set(staff.id, (hoursByStaff.get(staff.id) ?? 0) + hours);
        const dates = workDatesByStaff.get(staff.id) ?? new Set<string>();
        dates.add(shift.date);
        workDatesByStaff.set(staff.id, dates);
        const weekKey = `${staff.id}:${format(startOfWeek(parseISO(shift.date), { weekStartsOn: getWeekStartsOn() }), 'yyyy-MM-dd')}`;
        weeklyHours.set(weekKey, (weeklyHours.get(weekKey) ?? 0) + hours);

        const date = parseISO(shift.date);
        const holiday = holidayMap.get(shift.date);
        const resolution = resolveBusinessDay({ date, dateStr: shift.date, closedDays: businessHours.closedDays, holiday, override: overrideMap.get(shift.date) });
        if (!resolution.isOpen) {
            issues.push({ id: issueId('CLOSED_DAY_SHIFT', shift.id), code: 'CLOSED_DAY_SHIFT', severity: 'warning', date: shift.date, shiftId: shift.id, staffId: staff.id, classId: shift.classType, message: `休業日に${staff.name}さんのシフトがあります。` });
        }
        const startMinutes = timeToMinutes(shift.startTime);
        const endMinutes = timeToMinutes(shift.endTime);
        if (startMinutes < businessHours.startHour * 60 || endMinutes > businessHours.endHour * 60) {
            issues.push({ id: issueId('OUTSIDE_BUSINESS_HOURS', shift.id), code: 'OUTSIDE_BUSINESS_HOURS', severity: 'warning', date: shift.date, shiftId: shift.id, staffId: staff.id, classId: shift.classType, startTime: shift.startTime, endTime: shift.endTime, message: `${staff.name}さんの勤務が営業時間外にかかっています。` });
        }
        if (staff.classIds?.length && !staff.classIds.includes(shift.classType)) {
            issues.push({ id: issueId('CLASS_MEMBERSHIP_MISMATCH', shift.id), code: 'CLASS_MEMBERSHIP_MISMATCH', severity: 'warning', date: shift.date, shiftId: shift.id, staffId: staff.id, classId: shift.classType, message: `${staff.name}さんが所属外のクラスへ配置されています。` });
        }
        const isNationalHoliday = Boolean(holiday && !holiday.isWorkday);
        if (isStaffFixedHoliday(staff, date, businessHours.closedDays, isNationalHoliday)) {
            issues.push({ id: issueId('FIXED_DAY_OFF_CONFLICT', shift.id), code: 'FIXED_DAY_OFF_CONFLICT', severity: 'warning', date: shift.date, shiftId: shift.id, staffId: staff.id, message: `${staff.name}さんの固定休日にシフトがあります。` });
        }
        for (const detail of getPreferenceDetails(preferences, staff.id, shift.date)) {
            if (!detail.startTime || !detail.endTime) {
                const code = detail.type === 'training' ? 'TRAINING_CONFLICT' : 'FULL_DAY_PREFERENCE_CONFLICT';
                issues.push({ id: issueId(code, shift.id), code, severity: 'warning', date: shift.date, shiftId: shift.id, staffId: staff.id, message: detail.type === 'training' ? `${staff.name}さんの研修日にシフトがあります。` : `${staff.name}さんの終日希望休にシフトがあります。` });
            } else if (timeRangesOverlap(shift.startTime, shift.endTime, detail.startTime, detail.endTime)) {
                const code = detail.type === 'training' ? 'TRAINING_CONFLICT' : 'PARTIAL_PREFERENCE_CONFLICT';
                issues.push({ id: issueId(code, shift.id, detail.startTime), code, severity: 'warning', date: shift.date, shiftId: shift.id, staffId: staff.id, startTime: detail.startTime, endTime: detail.endTime, message: detail.type === 'training' ? `${staff.name}さんの研修時間と勤務が重なっています。` : `${staff.name}さんの部分休と勤務が重なっています。` });
            }
        }
    }

    for (const [date, dateShifts] of shiftsByDate) {
        const assigned = dateShifts.filter(isAssigned);
        const byStaff = new Map<string, Shift[]>();
        const dutyNumbers = new Map<string, Shift>();
        for (const shift of assigned) {
            const staffGroup = byStaff.get(shift.staffId) ?? [];
            for (const previous of staffGroup) {
                if (timeRangesOverlap(previous.startTime, previous.endTime, shift.startTime, shift.endTime)) {
                    issues.push({ id: issueId('SHIFT_OVERLAP', previous.id, shift.id), code: 'SHIFT_OVERLAP', severity: 'error', date, staffId: shift.staffId, shiftId: shift.id, message: '同じスタッフの勤務時間が重複しています。' });
                }
            }
            staffGroup.push(shift);
            byStaff.set(shift.staffId, staffGroup);
            if (shift.duty_number != null) {
                const key = `${shift.classType}:${shift.duty_number}`;
                const previous = dutyNumbers.get(key);
                if (previous) issues.push({ id: issueId('DUTY_NUMBER_DUPLICATE', previous.id, shift.id), code: 'DUTY_NUMBER_DUPLICATE', severity: 'error', date, shiftId: shift.id, classId: shift.classType, message: `当番番号${shift.duty_number}が重複しています。` });
                else dutyNumbers.set(key, shift);
            }
        }
    }

    const firstDate = startOfMonth(parseISO(`${yearMonth}-01`));
    for (const date of eachDayOfInterval({ start: firstDate, end: endOfMonth(firstDate) })) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const resolution = resolveBusinessDay({ date, dateStr, closedDays: businessHours.closedDays, holiday: holidayMap.get(dateStr), override: overrideMap.get(dateStr) });
        if (!resolution.isOpen) continue;
        const dayRequirements = requirements.filter(requirement => appliesToDay(requirement, date.getDay()));
        const dateShifts = (shiftsByDate.get(dateStr) ?? []).filter(isAssigned);
        for (const requirement of dayRequirements) {
            const stats = requirementStats.get(requirement.classId) ?? { required: 0, filled: 0 };
            const start = timeToMinutes(requirement.startTime);
            const end = timeToMinutes(requirement.endTime);
            for (let slot = start; slot < end; slot += 15) {
                const slotEnd = Math.min(slot + 15, end);
                const assignedCount = dateShifts.filter(shift => shift.classType === requirement.classId && timeToMinutes(shift.startTime) <= slot && timeToMinutes(shift.endTime) >= slotEnd).length;
                stats.required += requirement.minStaffCount;
                stats.filled += Math.min(assignedCount, requirement.minStaffCount);
                if (assignedCount < requirement.minStaffCount) {
                    const startTime = `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`;
                    const endTime = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`;
                    issues.push({ id: issueId('REQUIREMENT_SHORTAGE', dateStr, requirement.id, slot), code: 'REQUIREMENT_SHORTAGE', severity: 'warning', date: dateStr, classId: requirement.classId, startTime, endTime, actualValue: assignedCount, expectedValue: requirement.minStaffCount, message: `${classMap.get(requirement.classId)?.name ?? 'クラス'}の必要人数が${requirement.minStaffCount - assignedCount}名不足しています。` });
                }
            }
            requirementStats.set(requirement.classId, stats);
        }
    }

    for (const staff of staffs) {
        const actual = hoursByStaff.get(staff.id) ?? 0;
        if (staff.hoursTarget != null && actual > staff.hoursTarget) {
            issues.push({ id: issueId('MONTHLY_HOURS_EXCEEDED', yearMonth, staff.id), code: 'MONTHLY_HOURS_EXCEEDED', severity: 'warning', date: `${yearMonth}-01`, staffId: staff.id, actualValue: actual, expectedValue: staff.hoursTarget, message: `${staff.name}さんの月間予定時間が目標を${(actual - staff.hoursTarget).toFixed(1)}時間超えています。` });
        }
        if (staff.weeklyHoursTarget != null) {
            for (const [key, hours] of weeklyHours) {
                if (!key.startsWith(`${staff.id}:`) || hours <= staff.weeklyHoursTarget) continue;
                const weekStart = key.slice(staff.id.length + 1);
                issues.push({ id: issueId('WEEKLY_HOURS_EXCEEDED', key), code: 'WEEKLY_HOURS_EXCEEDED', severity: 'warning', date: weekStart, staffId: staff.id, actualValue: hours, expectedValue: staff.weeklyHoursTarget, message: `${staff.name}さんの週予定時間が目標を${(hours - staff.weeklyHoursTarget).toFixed(1)}時間超えています。` });
            }
        }
    }

    // 必要人数不足は15分単位で計算するが、表示時は連続する同条件の区間をまとめる。
    const shortageIssues = issues
        .filter(issue => issue.code === 'REQUIREMENT_SHORTAGE')
        .sort((a, b) => `${a.date}:${a.classId}:${a.startTime}`.localeCompare(`${b.date}:${b.classId}:${b.startTime}`));
    const compactedShortages: ScheduleIssue[] = [];
    for (const issue of shortageIssues) {
        const previous = compactedShortages.at(-1);
        if (previous && previous.date === issue.date && previous.classId === issue.classId
            && previous.endTime === issue.startTime && previous.actualValue === issue.actualValue
            && previous.expectedValue === issue.expectedValue) {
            previous.endTime = issue.endTime;
            previous.id = issueId('REQUIREMENT_SHORTAGE', previous.date, previous.classId, previous.startTime, previous.endTime);
        } else {
            compactedShortages.push({ ...issue });
        }
    }
    const nonShortageIssues = issues.filter(issue => issue.code !== 'REQUIREMENT_SHORTAGE');
    issues.splice(0, issues.length, ...nonShortageIssues, ...compactedShortages);
    issues.sort((a, b) => a.date.localeCompare(b.date) || a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code));
    const issueStaffCounts = new Map<string, number>();
    for (const issue of issues) if (issue.staffId) issueStaffCounts.set(issue.staffId, (issueStaffCounts.get(issue.staffId) ?? 0) + 1);
    const staffMetrics = staffs.map(staff => {
        const scheduledHours = hoursByStaff.get(staff.id) ?? 0;
        return { staffId: staff.id, staffName: staff.name, scheduledHours, targetHours: staff.hoursTarget, differenceHours: staff.hoursTarget == null ? null : scheduledHours - staff.hoursTarget, workingDays: workDatesByStaff.get(staff.id)?.size ?? 0, issueCount: issueStaffCounts.get(staff.id) ?? 0 };
    });
    const classMetrics = classes.map(shiftClass => {
        const stats = requirementStats.get(shiftClass.id) ?? { required: 0, filled: 0 };
        return { classId: shiftClass.id, className: shiftClass.name, requiredSlots: stats.required, filledSlots: stats.filled, fillRate: stats.required ? stats.filled / stats.required : 1, shortageSlots: Math.max(0, stats.required - stats.filled) };
    });
    const totalRequired = classMetrics.reduce((sum, metric) => sum + metric.requiredSlots, 0);
    const totalFilled = classMetrics.reduce((sum, metric) => sum + metric.filledSlots, 0);
    return {
        yearMonth,
        issues,
        summary: {
            errorCount: issues.filter(issue => issue.severity === 'error').length,
            warningCount: issues.filter(issue => issue.severity === 'warning').length,
            affectedDateCount: new Set(issues.map(issue => issue.date)).size,
            shiftCount: shifts.length,
            assignedShiftCount: shifts.filter(isAssigned).length,
            unassignedCount: shifts.filter(shift => !isAssigned(shift)).length,
            scheduledHours: [...hoursByStaff.values()].reduce((sum, hours) => sum + hours, 0),
            fillRate: totalRequired ? totalFilled / totalRequired : 1,
            submittedCount: preferences.filter(preference => preference.submitted).length,
            staffCount: staffs.length,
        },
        staffMetrics,
        classMetrics,
    };
};

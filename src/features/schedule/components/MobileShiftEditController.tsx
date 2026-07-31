import { timeToMinutes } from '../../../utils/timeUtils';
import { buildLeaderMatcher } from '../../../utils/roleMatch';
import { getEffectiveDutyNumbers } from '../../../utils/dutyNumber';
import type { DynamicRole, Shift, Staff } from '../../../types';
import type { LocalShiftData } from '../hooks/useShiftEdit';
import MobileShiftEditModal from './MobileShiftEditModal';
import type { OffDutyStaffInfo } from './ShiftActionMenus';

interface MobileShiftEditControllerProps {
    shiftId: string | null;
    dayShifts: Shift[];
    staffList: Staff[];
    localShifts: Record<string, LocalShiftData>;
    roles: DynamicRole[];
    date: Date;
    leaderRoleId: string | null;
    showDutyNumbers: boolean;
    offDutyStaff: OffDutyStaffInfo[];
    staffMonthlyHours: Record<string, number>;
    onClose: () => void;
    onPatternChange: (shiftId: string, patternId: string) => void;
    onTimeChange: (shiftId: string, field: 'start' | 'end', value: string) => void;
    onDutyNumberChange: (shiftId: string, value: number | null) => void;
    onSwapStaff: (shiftId: string, newStaffId: string) => void;
    onDeleteShift: (shiftId: string) => void;
}

const MobileShiftEditController = ({
    shiftId,
    dayShifts,
    staffList,
    localShifts,
    roles,
    date,
    leaderRoleId,
    showDutyNumbers,
    offDutyStaff,
    staffMonthlyHours,
    onClose,
    onPatternChange,
    onTimeChange,
    onDutyNumberChange,
    onSwapStaff,
    onDeleteShift,
}: MobileShiftEditControllerProps) => {
    if (!shiftId) return null;

    const shift = dayShifts.find(s => s.id === shiftId);
    if (!shift) return null;

    const staff = staffList.find(s => s.id === shift.staffId);
    const staffName = staff ? staff.name : '不明';
    const localData = localShifts[shift.id] ?? {
        start: timeToMinutes(shift.startTime),
        end: timeToMinutes(shift.endTime),
        classType: shift.classType,
        isError: shift.isError ?? false,
    } as LocalShiftData;
    const allowedPatterns = roles.find(r => r.name === staff?.role)?.patterns || [];
    const groupShifts = dayShifts.filter(s => {
        const loc = localShifts[s.id];
        const cls = loc ? loc.classType : s.classType;
        const err = loc ? loc.isError : s.isError;
        return cls === (localShifts[shift.id]?.classType ?? shift.classType) && !err;
    });
    const matcher = buildLeaderMatcher(leaderRoleId, roles);
    const fullTimeStaffIds = leaderRoleId
        ? staffList.filter(matcher).map(st => st.id)
        : undefined;
    const dutyOrderedGroupShifts = [...groupShifts].sort((a, b) =>
        staffList.findIndex(st => st.id === a.staffId) -
        staffList.findIndex(st => st.id === b.staffId)
    );
    const dutyNumbers = getEffectiveDutyNumbers(
        dutyOrderedGroupShifts.map(groupShift => ({
            id: groupShift.id,
            staffId: groupShift.staffId,
            storedNumber: localShifts[groupShift.id]?.dutyNumber !== undefined
                ? localShifts[groupShift.id]?.dutyNumber
                : groupShift.duty_number,
        })),
        date,
        fullTimeStaffIds
    );
    const dutyValue = dutyNumbers.get(shift.id) ?? 1;

    return (
        <MobileShiftEditModal
            key={shiftId}
            isOpen={true}
            onClose={onClose}
            staffName={staffName}
            currentStaff={staff}
            localData={localData}
            allowedPatterns={allowedPatterns}
            showDutyNumbers={showDutyNumbers}
            dutyValue={dutyValue}
            dutyGroupSize={groupShifts.length}
            offDutyStaff={offDutyStaff}
            staffMonthlyHours={staffMonthlyHours}
            onPatternChange={(patternId) => onPatternChange(shift.id, patternId)}
            onTimeChange={(field, value) => onTimeChange(shift.id, field, value)}
            onDutyNumberChange={(value) => onDutyNumberChange(shift.id, value)}
            onSwapStaff={(newStaffId) => onSwapStaff(shift.id, newStaffId)}
            onDeleteShift={() => onDeleteShift(shift.id)}
        />
    );
};

export default MobileShiftEditController;

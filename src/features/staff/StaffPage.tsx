import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { calculateTotalHours } from '../../utils/timeUtils';
import { saveActiveMonth, loadActiveMonth } from '../../utils/dateUtils';
import { useStaffList, useRoles, useClasses, useShiftsByMonth, useBusinessHours, useBreakSettings } from '../../lib/hooks';
import StaffFormModal from './components/StaffFormModal';
import StaffPageHeader from './components/StaffPageHeader';
import StaffListToolbar from './components/StaffListToolbar';
import StaffDeleteConfirmModal from './components/StaffDeleteConfirmModal';
import StaffMobileList from './components/StaffMobileList';
import StaffDesktopTable from './components/StaffDesktopTable';
import { useStaffForm } from './hooks/useStaffForm';
import { useStaffListActions } from './hooks/useStaffListActions';

const StaffPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentMonth, setCurrentMonth] = useState(() => loadActiveMonth());

    // --- React Query Hooks ---
    const { data: staffList = [], isLoading: isStaffLoading, isError: isStaffError, refetch: refetchStaff } = useStaffList();
    const { data: roles = [], isLoading: isRolesLoading, isError: isRolesError, refetch: refetchRoles } = useRoles();
    const { data: classes = [], isLoading: isClassesLoading, isError: isClassesError, refetch: refetchClasses } = useClasses();
    const { data: businessHours } = useBusinessHours();

    const monthStr = format(currentMonth, 'yyyy-MM');
    const { data: shifts = [], isLoading: loadingShifts, isFetching: isShiftsFetching, refetch: refetchShifts } = useShiftsByMonth(monthStr);

    const { data: breakSettings } = useBreakSettings();

    const shiftTotals = useMemo(() => calculateTotalHours(shifts, breakSettings), [shifts, breakSettings]);

    const loading = (isStaffLoading && staffList.length === 0) || 
                    (isRolesLoading && roles.length === 0) || 
                    (isClassesLoading && classes.length === 0);
    const error = (isStaffError || isRolesError || isClassesError) ? 'データの読み込みに失敗しました。' : '';
    const staffForm = useStaffForm(roles, businessHours);
    const staffActions = useStaffListActions(staffList);

    const handleRetry = () => {
        refetchStaff();
        refetchRoles();
        refetchClasses();
        refetchShifts();
    };

    // Update active month when currentMonth changes
    useEffect(() => { saveActiveMonth(currentMonth); }, [currentMonth]);

    const filteredStaff = staffList.filter(s => s.name.includes(searchTerm));
    return (
        <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto w-full p-4 sm:p-6 md:p-8">
            <StaffPageHeader
                error={error}
                isLoading={loading}
                onAdd={staffForm.openAddForm}
                onRetry={handleRetry}
            />

            <StaffListToolbar
                currentMonth={currentMonth}
                isLoading={loadingShifts || isShiftsFetching}
                searchTerm={searchTerm}
                onMonthChange={setCurrentMonth}
                onSearchChange={setSearchTerm}
            />

            <StaffMobileList
                activeStaff={staffActions.activeStaff}
                classes={classes}
                isLoading={loading}
                shiftTotals={shiftTotals}
                staffs={filteredStaff}
                onDelete={staffActions.requestDelete}
                onDragEnd={staffActions.handleDragEnd}
                onDragStart={staffActions.handleDragStart}
                onEdit={staffForm.openEditForm}
            />

            <StaffDesktopTable
                activeStaff={staffActions.activeStaff}
                classes={classes}
                isLoading={loading}
                shiftTotals={shiftTotals}
                staffs={filteredStaff}
                onDelete={staffActions.requestDelete}
                onDragEnd={staffActions.handleDragEnd}
                onDragStart={staffActions.handleDragStart}
                onEdit={staffForm.openEditForm}
            />

            <StaffFormModal
                isOpen={staffForm.isOpen}
                onClose={staffForm.closeForm}
                onSubmit={staffForm.handleSubmit}
                editingStaff={staffForm.editingStaff}
                formData={staffForm.formData}
                setFormData={staffForm.setFormData}
                roles={roles}
                classes={classes}
                isSubmitting={staffForm.isSubmitting}
                handleRoleChange={staffForm.handleRoleChange}
                closedDays={businessHours?.closedDays || []}
            />

            <StaffDeleteConfirmModal
                staffName={staffActions.deleteTarget?.name}
                isLoading={staffActions.isDeleting}
                onConfirm={staffActions.confirmDelete}
                onCancel={staffActions.cancelDelete}
            />
        </div>
    );
};

export default StaffPage;

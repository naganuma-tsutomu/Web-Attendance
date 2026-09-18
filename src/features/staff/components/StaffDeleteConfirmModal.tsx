import ConfirmModal from '../../../components/ui/ConfirmModal';

type StaffDeleteConfirmModalProps = {
    staffName?: string;
    isLoading: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

const StaffDeleteConfirmModal = ({
    staffName,
    isLoading,
    onCancel,
    onConfirm,
}: StaffDeleteConfirmModalProps) => (
    <ConfirmModal
        isOpen={staffName !== undefined}
        title="スタッフの退職"
        message={`${staffName ?? ''} さんを退職者履歴に移します。既存のシフトは残り、ログインと新しいシフトへの割り当てはできなくなります。将来のシフトがある場合は再割り当てしてください。`}
        confirmLabel="退職にする"
        cancelLabel="キャンセル"
        onConfirm={onConfirm}
        onCancel={onCancel}
        isLoading={isLoading}
        variant="info"
    />
);

export default StaffDeleteConfirmModal;

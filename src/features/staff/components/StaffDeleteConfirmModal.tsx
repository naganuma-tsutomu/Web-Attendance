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
        title="スタッフの削除"
        message={`${staffName ?? ''} さんを削除してもよろしいですか？この操作は取り消せません。`}
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        onConfirm={onConfirm}
        onCancel={onCancel}
        isLoading={isLoading}
        variant="danger"
    />
);

export default StaffDeleteConfirmModal;

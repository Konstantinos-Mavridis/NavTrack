import Modal from './Modal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = 'Delete', danger = true,
  onConfirm, onCancel,
}: Props) {
  return (
    <Modal title={title} onClose={onCancel} width="max-w-sm">
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button
          onClick={onConfirm}
          className={danger
            ? 'px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors'
            : 'btn-primary'
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

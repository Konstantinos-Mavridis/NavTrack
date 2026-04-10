import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { ButtonSpinner } from './ui';

interface Props {
  title: string;
  message: string;
  /** Label for the confirm button in its idle state. Default: 'Confirm' */
  confirmLabel?: string;
  /** Label shown while the async action is in-flight. Default: confirmLabel + '…' */
  confirmingLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  confirmingLabel,
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  const [working, setWorking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function handleConfirm() {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      // Guard against calling setState on an unmounted component.
      // The parent may unmount this dialog immediately on success.
      if (mounted.current) setWorking(false);
    }
  }

  const busyLabel = confirmingLabel ?? `${confirmLabel}…`;

  return (
    <Modal title={title} onClose={onCancel} width="max-w-sm" closeable={!working}>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} disabled={working} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          aria-busy={working}
          className={`${
            danger ? 'btn-danger' : 'btn-primary'
          } flex items-center gap-2 ${
            working ? 'opacity-75 pointer-events-none' : ''
          }`}
        >
          {working ? (
            <>
              <ButtonSpinner className={danger ? 'border-red-300 dark:border-red-500' : ''} />
              {busyLabel}
            </>
          ) : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra width class, e.g. 'max-w-2xl'. Default: 'max-w-lg' */
  width?: string;
  /**
   * When false the × button, backdrop click, and Escape key are all no-ops.
   * Pass `false` while an async operation is in-flight so the modal cannot
   * be dismissed mid-operation. Default: true.
   */
  closeable?: boolean;
}

export default function Modal({
  title, subtitle, onClose, children, width = 'max-w-lg', closeable = true,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && closeable) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, closeable]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current && closeable) onClose(); }}
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full ${
          width
        } flex flex-col max-h-[90vh] border border-transparent dark:border-gray-700`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            {subtitle && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={() => { if (closeable) onClose(); }}
            disabled={!closeable}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-2xl leading-none mt-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Close"
            title={closeable ? 'Close' : 'Cannot close while sync is in progress'}
          >
            ×
          </button>
        </div>

        {/*
          * Body — overflow-y-auto with scrollbarGutter:'stable' reserves the
          * scrollbar track width at all times, preventing the content from
          * shifting horizontally when the scrollbar appears/disappears as
          * content grows (e.g. form validation errors, dynamic lists).
          * Using overflow-y-auto (not scroll) avoids a persistent scrollbar
          * on short content like ConfirmDialog.
          */}
        <div
          className="overflow-y-auto flex-1 px-6 py-5 text-gray-900 dark:text-gray-100"
          style={{ scrollbarGutter: 'stable' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

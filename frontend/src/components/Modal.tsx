import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra width class, e.g. 'max-w-2xl'. Default: 'max-w-lg' */
  width?: string;
}

export default function Modal({ title, subtitle, onClose, children, width = 'max-w-lg' }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full ${width} flex flex-col max-h-[90vh] border border-transparent dark:border-gray-700`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            {subtitle && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-2xl leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 text-gray-900 dark:text-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}

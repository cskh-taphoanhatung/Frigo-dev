import React, { useId, useRef } from 'react';
import { useModalFocus } from '../../design-system/use-modal-focus';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useModalFocus(open, dialogRef, onCancel, cancelRef);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-semantic-overlay/50 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-elevated w-full max-w-sm p-5 space-y-3"
      >
        <h2 id={titleId} className="font-heading font-bold text-base text-semantic-text-primary">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-sm text-semantic-text-secondary leading-relaxed">
            {description}
          </p>
        )}
        <div className="flex gap-2.5 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-semantic-border/60 text-semantic-text-secondary font-heading font-bold text-sm hover:bg-semantic-border active:scale-95 transition-tap tap-target"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl font-heading font-bold text-sm text-white active:scale-95 transition-tap tap-target ${
              destructive ? 'bg-semantic-danger hover:bg-semantic-danger-strong' : 'bg-takosan-green hover:bg-takosan-green-hover'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

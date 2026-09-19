import React, { type RefObject } from 'react';

interface GoogleAuthSectionProps {
  buttonRef: RefObject<HTMLDivElement>;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  clientId: string | null;
  onRetry: () => void;
}

/** Google GSI mount + honest availability states (T16 GSI contract). */
export const GoogleAuthSection: React.FC<GoogleAuthSectionProps> = ({
  buttonRef,
  status,
  clientId,
  onRetry,
}) => (
  <div className="space-y-2">
    <div ref={buttonRef} className="w-full flex justify-center min-h-[44px]" />
    {status === 'loading' && (
      <p role="status" className="text-center text-xs text-slate-500">Đang kết nối Google…</p>
    )}
    {status === 'unavailable' && (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
        <p>{clientId ? 'Không tải được Google Sign-In. Hãy kiểm tra chặn nội dung hoặc thử lại.' : 'Google Sign-In chưa được cấu hình. Bạn vẫn có thể đăng nhập bằng email.'}</p>
        {clientId && (
          <button type="button" onClick={onRetry} className="mt-1 font-semibold underline tap-target">
            Tải lại Google Sign-In
          </button>
        )}
      </div>
    )}
  </div>
);

import React from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { ApiError } from '../../services/api';

/** Compact inline loading spinner for widget-level fetches. */
export const InlineLoading: React.FC<{ label?: string }> = ({ label = 'Đang tải…' }) => (
  <div className="text-center py-8" role="status" aria-live="polite">
    <div className="animate-spin w-7 h-7 border-2 border-takosan-green border-t-transparent rounded-full mx-auto mb-2 motion-reduce:animate-none" />
    <p className="text-xs text-slate-500 font-medium">{label}</p>
  </div>
);

/** Skeleton block used while a card-sized widget loads. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = 'h-24' }) => (
  <div
    className={`rounded-2xl bg-slate-100 animate-pulse motion-reduce:animate-none ${className}`}
    aria-hidden="true"
  />
);

/**
 * Widget-level error state with retry. Distinguishes offline from server
 * errors so the copy stays honest without exposing HTTP internals.
 */
export const InlineError: React.FC<{
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}> = ({ error, message, onRetry }) => {
  const offline = error instanceof ApiError && error.kind === 'offline';
  const text =
    message ||
    (offline
      ? 'Không có kết nối mạng. Dữ liệu sẽ tự cập nhật khi có mạng lại.'
      : 'Không tải được dữ liệu. Vui lòng thử lại.');
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 text-center space-y-2">
      <Icon className="w-5 h-5 text-slate-400 mx-auto" aria-hidden="true" />
      <p role="alert" className="text-xs text-slate-600 font-medium">{text}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/80 text-xs font-heading font-bold hover:bg-takosan-mint-hover active:scale-95 transition-tap tap-target"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Thử lại
        </button>
      )}
    </div>
  );
};

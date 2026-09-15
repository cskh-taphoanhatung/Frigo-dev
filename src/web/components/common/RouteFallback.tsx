import React from 'react';
import { TAKOSAN_BRAND } from '../../lib/takosan-brand';

/** Branded Suspense fallback shown while a lazy route chunk loads. */
export const RouteFallback: React.FC = () => (
  <div
    className="min-h-screen bg-takosan-cream flex flex-col items-center justify-center gap-4"
    role="status"
    aria-live="polite"
    aria-label="Đang tải trang"
  >
    <img src={TAKOSAN_BRAND.symbol} alt="" width={64} height={64} className="w-16 h-16" />
    <div className="animate-spin w-7 h-7 border-2 border-takosan-green border-t-transparent rounded-full motion-reduce:animate-none" />
    <p className="text-xs text-slate-500 font-medium">Đang tải…</p>
  </div>
);

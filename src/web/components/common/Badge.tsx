import React from 'react';
import { clsx } from 'clsx';
import { FreshnessStatus } from '@frigo/domain';

interface BadgeProps {
  status?: FreshnessStatus;
  children?: React.ReactNode;
  variant?: 'fresh' | 'use_soon' | 'expiring' | 'out_of_stock' | 'cuisine' | 'match' | 'neutral';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, children, variant, className, icon }) => {
  const effectiveVariant = variant || status || 'neutral';

  const styles = {
    fresh: 'bg-takosan-mint text-takosan-green-deep border-takosan-mint-deep/80 font-semibold',
    use_soon: 'bg-amber-50 text-amber-900 border-amber-200/80 font-semibold',
    expiring: 'bg-rose-50 text-rose-800 border-rose-200/80 font-semibold',
    out_of_stock: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    cuisine: 'bg-slate-50 text-slate-700 border-slate-200 font-medium',
    match: 'bg-takosan-green text-white font-semibold shadow-xs',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
  };

  const labels: Record<string, string> = {
    fresh: 'Tươi ngon',
    use_soon: 'Nên dùng sớm',
    expiring: 'Sắp hết hạn',
    out_of_stock: 'Đã hết',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border tracking-tight',
        styles[effectiveVariant as keyof typeof styles],
        className
      )}
    >
      {icon}
      {children || (status ? labels[status] : null)}
    </span>
  );
};

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
    use_soon: 'bg-semantic-warning-soft text-semantic-warning-strong border-semantic-warning/30 font-semibold',
    expiring: 'bg-semantic-danger-soft text-semantic-danger-strong border-semantic-danger/30 font-semibold',
    out_of_stock: 'bg-semantic-border/60 text-semantic-text-secondary border-semantic-border font-medium',
    cuisine: 'bg-semantic-background-subtle text-semantic-text-secondary border-semantic-border font-medium',
    match: 'bg-takosan-green text-white font-semibold shadow-xs',
    neutral: 'bg-semantic-border/60 text-semantic-text-secondary border-semantic-border font-medium',
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

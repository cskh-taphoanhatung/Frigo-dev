import React from 'react';
import { clsx } from 'clsx';
import { FreshnessStatus } from '@frigo/domain';

interface StatusChipProps {
  status: FreshnessStatus | 'low' | 'frozen' | 'unknown' | 'estimated';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, className }) => {
  const configs: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    fresh: { label: 'Tươi ngon', bg: 'bg-takosan-mint border border-takosan-mint-deep/80', text: 'text-takosan-green-deep', dot: 'bg-takosan-green' },
    use_soon: { label: 'Dùng sớm', bg: 'bg-semantic-warning-soft border border-semantic-warning/30', text: 'text-semantic-warning-strong', dot: 'bg-semantic-warning' },
    expiring: { label: 'Sắp hết hạn', bg: 'bg-semantic-danger-soft border border-semantic-danger/30', text: 'text-semantic-danger-strong', dot: 'bg-semantic-danger' },
    out_of_stock: { label: 'Đã hết', bg: 'bg-semantic-border/60 border border-semantic-border', text: 'text-semantic-text-secondary', dot: 'bg-semantic-border-strong' },
    low: { label: 'Sắp hết', bg: 'bg-semantic-warning-soft border border-semantic-warning/30', text: 'text-semantic-warning-strong', dot: 'bg-semantic-warning' },
    frozen: { label: 'Ngăn đông', bg: 'bg-semantic-info-soft border border-semantic-info/30', text: 'text-semantic-info', dot: 'bg-semantic-info' },
    // T13: absence of expiry evidence is its own state. It must never borrow
    // the "Tươi ngon" styling, which would assert freshness nothing proves.
    unknown: { label: 'Chưa rõ hạn', bg: 'bg-semantic-border/60 border border-semantic-border-strong', text: 'text-semantic-text-secondary', dot: 'bg-semantic-border-strong' },
    estimated: { label: 'Hạn ước tính', bg: 'bg-semantic-info-soft border border-semantic-info/30', text: 'text-semantic-info', dot: 'bg-semantic-info' },
  };

  // An unrecognized status is unknown, not fresh: defaulting to `fresh` made
  // every unmapped state claim the food was good.
  const config = configs[status] || configs.unknown;

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      <span>{config.label}</span>
    </span>
  );
};

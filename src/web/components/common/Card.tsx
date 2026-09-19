import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, elevated = false, ...props }) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl p-4 transition-tap duration-150 border border-slate-200/70',
        elevated ? 'shadow-card hover:shadow-elevated' : 'shadow-[0_1px_3px_rgba(15,23,42,0.04)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

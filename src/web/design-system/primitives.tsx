import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

/**
 * T17 shared primitives (components/*.md contracts). These extend — never
 * duplicate — `components/common`; one implementation authority per component.
 */

export type PageWidth = 'compact' | 'default' | 'wide' | 'fullscreen';

const PAGE_WIDTH: Record<PageWidth, string> = {
  compact: 'max-w-[45rem]',
  default: 'max-w-[60rem]',
  wide: 'max-w-[75rem]',
  fullscreen: 'max-w-none',
};

/**
 * Page requests a semantic width and owns vertical rhythm — not global
 * viewport composition (components/PAGE.md). AppShell owns gutters.
 */
export const Page: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { width?: PageWidth; gutter?: boolean }
> = ({ width = 'default', gutter = true, className, children, ...props }) => (
  <div
    className={clsx(
      'mx-auto w-full flex-1',
      PAGE_WIDTH[width],
      gutter && 'px-4 md:px-6 lg:px-8',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, onBack, backLabel = 'Quay lại', actions }) => (
  <header className="flex items-start justify-between gap-4 pt-5 pb-3">
    <div className="flex items-start gap-3 min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="tap-target -ml-2 mt-0.5 inline-flex items-center justify-center rounded-card text-semantic-text-secondary hover:bg-semantic-background-subtle focus-visible:outline-none focus-visible:shadow-t17-focus"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-type-heading text-semantic-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-semantic-text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
);

export const Section: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { title?: string; summary?: string; action?: React.ReactNode }
> = ({ title, summary, action, className, children, ...props }) => (
  <section className={clsx('py-4', className)} {...props}>
    {(title || action) && (
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          {title && <h2 className="text-type-label text-semantic-text-primary">{title}</h2>}
          {summary && <p className="text-sm text-semantic-text-muted mt-0.5">{summary}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

/** Restrained raised panel (components/CARD.md: whitespace/tone beat boxes). */
export const Surface: React.FC<React.HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'subtle' | 'accent' }> = ({
  tone = 'default',
  className,
  children,
  ...props
}) => (
  <div
    className={clsx(
      'rounded-card',
      tone === 'default' && 'bg-semantic-surface border border-semantic-border',
      tone === 'subtle' && 'bg-semantic-background-subtle border border-semantic-border',
      tone === 'accent' && 'bg-semantic-accent-soft border border-semantic-accent/20',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

/** One mobile primary action above bottom nav/safe area (components/FIXED_ACTIONS.md).
 *  Mobile: clears the 68px bottom nav; md+: nav is a rail/sidebar so bottom-0
 *  and a left offset apply; lg: renders inline. */
export const BottomCTA: React.FC<{ children: React.ReactNode; hideOnDesktop?: boolean }> = ({
  children,
  hideOnDesktop = false,
}) => (
  <div
    className={clsx(
      'fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:bottom-0 md:left-20 z-20 bg-semantic-background/95 backdrop-blur border-t border-semantic-border px-4 py-3 md:pb-[calc(env(safe-area-inset-bottom,0px)+12px)] lg:static lg:left-auto lg:bottom-auto lg:z-auto lg:bg-transparent lg:border-0 lg:p-0',
      hideOnDesktop && 'lg:hidden'
    )}
  >
    {children}
  </div>
);

/** Paired editor actions; stays visible, never conceals validation errors.
 *  Sticky offset equals the mobile bottom nav height so actions never hide
 *  behind it; rail/sidebar breakpoints stick to the true bottom. */
export const StickyActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:bottom-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 mt-4 bg-semantic-background/95 backdrop-blur border-t border-semantic-border px-4 md:px-6 lg:px-8 py-3 md:pb-[calc(env(safe-area-inset-bottom,0px)+12px)] flex gap-3">
    {children}
  </div>
);

/** Immediate on/off setting (components/SWITCH.md): role=switch, aria-checked. */
export const Switch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled = false }) => {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold text-semantic-text-primary block">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-xs text-semantic-text-muted mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative shrink-0 w-[52px] h-8 rounded-pill transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-t17-focus',
          checked ? 'bg-semantic-action-primary' : 'bg-semantic-border-strong',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        {/* Transform-driven thumb: deterministic travel, respects MotionConfig
            reduced motion (layout animations on absolute children are not). */}
        <motion.span
          aria-hidden="true"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-t17-sm"
        />
      </button>
    </div>
  );
};

/** Settings/navigation row — a real link or button, never a div (components/LIST.md). */
export const SettingsRow: React.FC<{
  to?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  label: string;
  meta?: string;
  danger?: boolean;
}> = ({ to, onClick, icon, label, meta, danger = false }) => {
  const inner = (
    <>
      {icon && (
        <span className="w-9 h-9 rounded-card bg-semantic-background-subtle text-semantic-action-primary flex items-center justify-center shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            'text-sm font-semibold block truncate',
            danger ? 'text-semantic-danger' : 'text-semantic-text-primary'
          )}
        >
          {label}
        </span>
        {meta && <span className="text-xs text-semantic-text-muted block truncate">{meta}</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-semantic-text-muted shrink-0" aria-hidden="true" />
    </>
  );
  const cls =
    'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-semantic-background-subtle active:bg-semantic-background-subtle focus-visible:outline-none focus-visible:shadow-t17-focus transition-colors';
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
};

export type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** StatusBadge maps semantic states; never color alone (design-system/component-states.json). */
export const StatusBadge: React.FC<{ tone: SemanticTone; children: React.ReactNode; className?: string }> = ({
  tone,
  children,
  className,
}) => {
  const tones: Record<SemanticTone, string> = {
    success: 'bg-semantic-success-soft text-semantic-success',
    warning: 'bg-semantic-warning-soft text-semantic-warning',
    danger: 'bg-semantic-danger-soft text-semantic-danger',
    info: 'bg-semantic-info-soft text-semantic-info',
    neutral: 'bg-semantic-background-subtle text-semantic-text-secondary',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className
      )}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
};

/** Honest "not configured / not supported" inline note (states/disabled.md). */
export const UnavailableState: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title = 'Chưa hỗ trợ',
  children,
}) => (
  <div
    role="note"
    className="rounded-card border border-dashed border-semantic-border-strong bg-semantic-background-subtle px-4 py-3.5"
  >
    <p className="text-sm font-semibold text-semantic-text-secondary">{title}</p>
    <p className="text-xs text-semantic-text-muted mt-1 leading-relaxed">{children}</p>
  </div>
);

/** Skeleton block: subtle pulse, disabled by reduced motion via CSS. */
export const Skeleton: React.FC<{ className?: string; label?: string }> = ({ className, label }) => (
  <div
    role={label ? 'status' : undefined}
    aria-label={label}
    className={clsx('rounded-card bg-semantic-background-subtle t17-skeleton', className)}
  />
);

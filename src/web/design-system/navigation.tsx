import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { isMealPlannerEnabled } from '../features/planner/feature';
import { TakosanIcon, type TakosanIconName } from '../components/common/TakosanIcon';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';

/**
 * One navigation model renders as mobile bottom bar, tablet rail, and desktop
 * sidebar (components/NAVIGATION.md). Real links with aria-current; Scan stays
 * a prominent contextual action, not a sixth IA root.
 */

interface NavItem {
  label: string;
  path: string;
  icon: TakosanIconName;
  match: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Trang chủ', path: '/', icon: 'home', match: (p) => p === '/' },
  { label: 'Tủ lạnh', path: '/fridge', icon: 'fridge', match: (p) => p.startsWith('/fridge') || p.startsWith('/inventory') || p.startsWith('/ingredients') },
  { label: 'Công thức', path: '/recipes', icon: 'recipe', match: (p) => p.startsWith('/recipes') || p.startsWith('/cook') },
  {
    label: 'Thực đơn',
    path: isMealPlannerEnabled() ? '/planner' : '/week',
    icon: 'mealPlan',
    match: (p) => p.startsWith('/planner') || p.startsWith('/week'),
  },
  { label: 'Tôi', path: '/me', icon: 'profile', match: (p) => p.startsWith('/me') || p.startsWith('/profile') || p.startsWith('/settings') || p.startsWith('/notifications') || p.startsWith('/plus') },
];

const SCAN_PATH = '/scan';
const useActive = (item: NavItem) => item.match(useLocation().pathname);

// Bottom bar and rail are both mounted (one display:none per breakpoint), so
// each nav needs its own shared-layout id or the indicator can jump to the
// hidden nav's zero-size box.
const NavLinkContent: React.FC<{ item: NavItem; active: boolean; withLabel: boolean; indicatorId: string }> = ({
  item,
  active,
  withLabel,
  indicatorId,
}) => (
  <>
    <span
      className={clsx(
        // max-w-full keeps the icon box shrinkable at 200% text zoom
        // (layout/mobile.md: no horizontal scroll at 200%).
        'relative flex w-11 h-11 max-w-full items-center justify-center rounded-card transition-colors',
        active ? 'bg-semantic-success-soft text-semantic-action-primary' : 'text-semantic-text-muted'
      )}
    >
      {active && (
        <motion.span
          layoutId={indicatorId}
          aria-hidden="true"
          className="absolute inset-0 rounded-card bg-semantic-success-soft"
          transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
        />
      )}
      <TakosanIcon name={item.icon} className={clsx('relative w-6 h-6', active && 'text-semantic-action-primary')} strokeWidth={active ? 2.2 : 1.8} />
    </span>
    {withLabel && (
      <span
        className={clsx(
          'text-[11px] leading-none',
          active ? 'font-bold text-semantic-action-primary' : 'font-medium text-semantic-text-muted'
        )}
      >
        {item.label}
      </span>
    )}
  </>
);

/** Mobile: bottom bar with prominent central scan action. */
export const BottomNavigationBar: React.FC = () => {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-semantic-border bg-semantic-surface/95 backdrop-blur-xl safe-bottom md:hidden"
    >
      <ul className="flex items-stretch justify-around h-[68px] px-1.5">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavItemButton key={item.path} item={item} />
        ))}
        <li className="flex-1 min-w-0 flex items-start justify-center">
          <Link
            to={SCAN_PATH}
            aria-label="Quét AI"
            className="relative -top-4 flex flex-col items-center rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
          >
            <span className="w-[58px] h-[58px] rounded-[20px] bg-semantic-action-primary shadow-t17-md ring-2 ring-white flex items-center justify-center text-white">
              <TakosanIcon name="scan" className="w-7 h-7" />
            </span>
            <span className="text-[11px] font-bold text-semantic-text-primary mt-1 tracking-tight">Quét</span>
          </Link>
        </li>
        {NAV_ITEMS.slice(2).map((item) => (
          <NavItemButton key={item.path} item={item} />
        ))}
      </ul>
    </nav>
  );
};

const NavItemButton: React.FC<{ item: NavItem }> = ({ item }) => {
  const active = useActive(item);
  return (
    <li className="flex-1 min-w-0">
      <Link
        to={item.path}
        aria-current={active ? 'page' : undefined}
          className="flex flex-col items-center justify-center gap-1 h-[68px] w-full py-1.5 rounded-card focus-visible:outline-none focus-visible:shadow-t17-focus"
      >
        <NavLinkContent item={item} active={active} withLabel indicatorId="t17-nav-indicator-bottom" />
      </Link>
    </li>
  );
};

/** Tablet rail (80px) and desktop sidebar (256px) — same items, same truth. */
export const RailSidebar: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <>
      {/* Tablet rail */}
      <nav
        aria-label="Điều hướng chính"
        className="hidden md:flex lg:hidden fixed left-0 top-0 bottom-0 w-20 flex-col items-center gap-2 py-4 bg-semantic-surface border-r border-semantic-border z-30"
      >
        <Link to="/" className="mb-2" aria-label="Takosan — Trang chủ">
          <img src={TAKOSAN_BRAND.symbol} alt="" width={32} height={32} className="w-8 h-8" />
        </Link>
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
            >
              <NavLinkContent item={item} active={active} withLabel={false} indicatorId="t17-nav-indicator-rail" />
              <span className={clsx('text-[10px] leading-none', active ? 'font-bold text-semantic-action-primary' : 'text-semantic-text-muted')}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <Link
          to={SCAN_PATH}
          aria-label="Quét AI"
          className="mt-auto flex flex-col items-center gap-1 px-3 py-1.5 rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
        >
          <span className="flex w-11 h-11 items-center justify-center rounded-card bg-semantic-action-primary text-white">
            <TakosanIcon name="scan" className="w-6 h-6" />
          </span>
          <span className="text-[10px] font-medium text-semantic-text-muted">Quét</span>
        </Link>
      </nav>

      {/* Desktop sidebar */}
      <nav
        aria-label="Điều hướng chính"
        className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col px-4 py-5 bg-semantic-surface border-r border-semantic-border z-30"
      >
        <Link to="/" className="flex items-center gap-2.5 mb-6 px-2" aria-label="Takosan — Trang chủ">
          <img src={TAKOSAN_BRAND.logos.horizontal} alt="Takosan" className="h-9 w-auto" />
        </Link>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
                >
                  <TakosanIcon
                    name={item.icon}
                    className={clsx('w-6 h-6', active ? 'text-semantic-action-primary' : 'text-semantic-text-muted')}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span
                    className={clsx(
                      'text-sm',
                      active ? 'font-bold text-semantic-action-primary' : 'font-medium text-semantic-text-secondary'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          to={SCAN_PATH}
          className="mt-auto flex items-center justify-center gap-2 h-12 rounded-card bg-semantic-action-primary text-white text-sm font-bold shadow-t17-md focus-visible:outline-none focus-visible:shadow-t17-focus"
        >
          <TakosanIcon name="scan" className="w-5 h-5" />
          Quét nguyên liệu
        </Link>
      </nav>
    </>
  );
};

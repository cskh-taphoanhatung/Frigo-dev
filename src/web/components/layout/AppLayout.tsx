import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNavigationBar, RailSidebar } from '../../design-system/navigation';
import { OfflineBanner } from '../common/OfflineBanner';

/**
 * AppShell V2 (layout/app-shell.md): sole owner of viewport composition.
 * Mobile = edge-to-edge canvas + bottom nav; tablet = rail; desktop = sidebar.
 * Navigation hides only in immersive surfaces (scan camera, cooking, auth,
 * onboarding, fullscreen states) — never on planner/settings pages.
 */
const IMMERSIVE_PATTERNS = [
  // Camera only; /scan/:id/review and /scan/receipt-review are standard
  // review workspaces (screen 09) with navigation.
  /^\/scan\/?$/,
  /^\/cook(\/.*)?$/,
  /^\/cooking(\/.*)?$/,
  /^\/auth(\/.*)?$/,
  /^\/onboarding(\/.*)?$/,
];

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  const immersive = IMMERSIVE_PATTERNS.some((re) => re.test(pathname));

  return (
    <div className="min-h-dvh bg-semantic-background text-semantic-text-primary antialiased selection:bg-takosan-mint">
      {!immersive && <RailSidebar />}
      {/* Content canvas: rail 80px on md, sidebar 256px on lg; AppShell owns
          gutters so pages must not re-emulate a phone width. */}
      <div className={immersive ? '' : 'md:pl-20 lg:pl-64'}>
        {!immersive && <OfflineBanner />}
        <main className={immersive ? '' : 'min-h-dvh pb-[calc(68px+env(safe-area-inset-bottom,0px))] md:pb-0'}>
          <Outlet />
        </main>
        {!immersive && <BottomNavigationBar />}
      </div>
    </div>
  );
};

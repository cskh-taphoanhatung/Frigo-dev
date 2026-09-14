import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from '../common/OfflineBanner';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  // Paths where bottom nav should be hidden (fullscreen cooking mode, scan camera view, splash, week setup/shopping)
  const hideBottomNavPaths = [
    '/scan',
    '/cooking',
    '/cook',
    '/splash',
    '/auth',
    '/onboarding',
    '/week/setup',
    '/week/generating',
    '/planner',
  ];
  const shouldHideBottomNav =
    hideBottomNavPaths.some((p) => location.pathname.startsWith(p)) ||
    location.pathname.includes('/shopping') ||
    location.pathname.includes('/meal/');

  return (
    <div className="min-h-screen bg-takosan-cream-shade flex justify-center selection:bg-takosan-mint selection:text-takosan-green-deep antialiased">
      {/* App Viewport Container — phone-first, widens gracefully on tablet/desktop */}
      <div className="w-full max-w-md sm:max-w-lg md:max-w-2xl min-h-screen bg-takosan-cream flex flex-col shadow-xl border-x border-takosan-cream-line relative pb-20">
        <OfflineBanner />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
        {!shouldHideBottomNav && <BottomNav />}
      </div>
    </div>
  );
};

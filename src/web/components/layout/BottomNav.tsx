import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { isMealPlannerEnabled } from '../../features/planner/feature';
import { TakosanIcon, type TakosanIconName } from '../common/TakosanIcon';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const navItems: { label: string; path: string; icon: TakosanIconName; isCenter?: boolean }[] = [
    { label: 'Trang chủ', path: '/', icon: 'home' },
    { label: 'Tủ lạnh', path: '/fridge', icon: 'fridge' },
    { label: 'Quét', path: '/scan', icon: 'scan', isCenter: true },
    { label: 'Tuần', path: isMealPlannerEnabled() ? '/planner' : '/week', icon: 'mealPlan' },
    { label: 'Tôi', path: '/profile', icon: 'profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-takosan-cream/95 backdrop-blur-xl border-t border-[#F3E4DA] safe-bottom max-w-md sm:max-w-lg md:max-w-2xl mx-auto shadow-[0_-4px_24px_rgba(31,41,55,0.06)]">
      <div className="flex items-stretch justify-around h-[68px] px-1.5">
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? currentPath === '/'
              : currentPath === item.path ||
                (item.path === '/fridge' && (currentPath.startsWith('/fridge') || currentPath.startsWith('/inventory'))) ||
                (item.path === '/week' && currentPath.startsWith('/week')) ||
                (item.path === '/profile' && (currentPath.startsWith('/profile') || currentPath.startsWith('/settings')));

          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative -top-4 flex flex-col items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-takosan-green rounded-2xl tap-target"
                aria-label="Quét AI"
              >
                {/* Halo ring behind the scan button */}
                <div className="absolute -top-1 w-[68px] h-[68px] rounded-full bg-takosan-green/10 group-active:bg-takosan-green/20 transition-colors" />
                <div className="relative w-[58px] h-[58px] rounded-[20px] bg-takosan-green shadow-[0_8px_20px_-3px_rgba(46,125,91,0.35)] flex items-center justify-center text-white transition-all duration-200 transform group-hover:scale-105 group-active:scale-95 ring-2 ring-white">
                  <TakosanIcon name="scan" className="w-7 h-7" strokeWidth={2} />
                </div>
                <span className="relative text-[11px] font-heading font-bold text-takosan-navy mt-1 tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center h-full tap-target transition-all duration-150 relative py-1.5 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-takosan-green',
                isActive ? 'text-takosan-green' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <div
                className={clsx(
                  'flex flex-col items-center gap-1 px-3.5 py-1 rounded-2xl transition-all duration-200',
                  isActive && 'bg-takosan-mint'
                )}
              >
                <TakosanIcon
                  name={item.icon}
                  className={clsx(
                    'w-[22px] h-[22px] transition-all duration-200',
                    isActive ? 'scale-110 text-takosan-green' : 'text-slate-400'
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className={clsx(
                    'text-[11px] tracking-tight leading-none',
                    isActive ? 'font-heading font-bold text-takosan-green' : 'font-medium'
                  )}
                >
                  {item.label}
                </span>
              </div>
              {isActive && <span className="absolute top-0 w-8 h-[3px] rounded-full bg-takosan-green" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

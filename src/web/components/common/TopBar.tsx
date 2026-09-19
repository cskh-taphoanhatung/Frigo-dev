import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TAKOSAN_BRAND } from '../../lib/takosan-brand';
import { useAuthStore } from '../../stores/useAuthStore';
import { Bell, User, ArrowLeft, Settings } from 'lucide-react';

interface TopBarProps {
  showBack?: boolean;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ showBack = false, title, subtitle, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { avatarUrl, displayName } = useAuthStore();
  // /me is the account hub (T17); /profile only redirects there.
  const isProfilePage = location.pathname === '/me' || location.pathname === '/profile';

  return (
    <header className="sticky top-0 z-30 bg-takosan-cream/95 backdrop-blur-md px-4 py-3 border-b border-takosan-cream-line transition-colors shadow-xs">
      <div className="flex items-center justify-between">
        {showBack ? (
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack || (() => navigate(-1))}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-transform tap-target flex items-center justify-center text-slate-800"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2]" />
            </button>
            {title && (
              <div>
                <h1 className="font-heading font-bold text-base text-slate-900 leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
            )}
          </div>
        ) : title ? (
          <div>
            <h1 className="font-heading font-bold text-lg text-slate-900 leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2 cursor-pointer active:opacity-80 transition-opacity" onClick={() => navigate('/')}>
            <img src={TAKOSAN_BRAND.logos.horizontal} alt="Takosan" className="h-8 w-auto object-contain" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/notifications')}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 active:scale-95 flex items-center justify-center relative text-slate-700 transition-colors border border-slate-200/60"
            aria-label="Thông báo"
          >
            <Bell className="w-5 h-5 stroke-[2]" />
          </button>

          {isProfilePage ? (
            <button
              onClick={() => navigate('/settings/app')}
              className="w-9 h-9 rounded-xl hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-700 transition-colors border border-slate-200/60"
              aria-label="Cài đặt"
            >
              <Settings className="w-5 h-5 stroke-[2]" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/me')}
              className="w-9 h-9 rounded-xl bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep hover:bg-takosan-mint-hover active:scale-95 transition-tap flex items-center justify-center overflow-hidden"
              aria-label="Tài khoản cá nhân"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 stroke-[2]" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

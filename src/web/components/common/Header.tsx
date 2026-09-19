import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User } from 'lucide-react';
import { TAKOSAN_BRAND } from '../../lib/takosan-brand';

interface HeaderProps {
  showBack?: boolean;
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ showBack = false, title, subtitle }) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-takosan-cream/95 backdrop-blur-md px-4 pt-3 pb-2.5 border-b border-takosan-cream-line">
      <div className="flex items-center justify-between">
        {showBack ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-tap text-slate-700"
              aria-label="Quay lại"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {title && (
              <div>
                <h1 className="font-heading font-bold text-base text-slate-900 leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <img src={TAKOSAN_BRAND.logos.horizontal} alt="Takosan" className="h-8 w-auto" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/notifications')}
            className="p-2 rounded-xl hover:bg-slate-100 active:scale-95 relative text-slate-600 hover:text-slate-900 transition-tap tap-target"
            aria-label="Thông báo"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          </button>

          <button
            onClick={() => navigate('/me')}
            className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-tap flex items-center justify-center tap-target"
            aria-label="Tài khoản"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

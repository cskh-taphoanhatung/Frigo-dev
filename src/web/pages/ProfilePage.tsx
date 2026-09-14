import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { TopBar } from '../components/common/TopBar';
import { Card } from '../components/common/Card';
import { LogoutDialog } from '../components/common/LogoutDialog';
import {
  Sparkles,
  ChevronRight,
  Users,
  Heart,
  Bell,
  Globe,
  Sliders,
  PackageCheck,
  LogOut,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { displayName, email, isPlus, avatarUrl } = useAuthStore();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const initialLetter = (displayName || 'K').charAt(0).toUpperCase();

  // Menu items matching screen 7.1
  const MENU_ITEMS = [
    { label: 'Thông tin gia đình', icon: Users, path: '/family' },
    { label: 'Sở thích & hạn chế', icon: Heart, path: '/settings' },
    { label: 'Cài đặt thực đơn tuần', icon: Sliders, path: '/week/setup' },
    { label: 'Thông báo', icon: Bell, path: '/notifications' },
    { label: 'Ngôn ngữ', icon: Globe, path: '/settings', meta: 'Tiếng Việt' },
    { label: 'Nguyên liệu luôn có', icon: PackageCheck, path: '/fridge', meta: 'Gia vị, muối, đường, dầu ăn...' },
  ];

  return (
    <div className="min-h-screen bg-takosan-cream pb-24 max-w-md mx-auto">
      <TopBar title="Hồ sơ" />

      <div className="px-4 pt-4 space-y-4">
        {/* Profile Card matching 7.1 */}
        <Card className="p-4 flex items-center justify-between border-slate-200/80 shadow-xs bg-white">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-13 h-13 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xs"
              />
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-takosan-coral to-[#E8624F] text-white flex items-center justify-center font-heading font-bold text-xl shadow-xs">
                {initialLetter}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-slate-900 leading-tight">
                  {displayName || 'Khách'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {email || 'Chưa liên kết email'}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/plus')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-heading font-bold text-xs shadow-xs hover:brightness-105 active:scale-95 transition-all flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{isPlus ? 'VIP Plus' : 'Nâng cấp'}</span>
          </button>
        </Card>

        {/* 7.1 Menu Items List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="w-full text-left p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/60 active:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-heading font-semibold text-sm text-slate-900 block truncate">
                      {item.label}
                    </span>
                    {item.meta && (
                      <span className="text-[11px] text-slate-500 block truncate">
                        {item.meta}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400 shrink-0 ml-2">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Logout Button */}
        <div className="pt-2">
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full py-3 px-4 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/70 text-rose-700 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 stroke-[2]" />
            <span>Đăng xuất khỏi tài khoản</span>
          </button>
        </div>

        {/* App Version Footer */}
        <div className="text-center pt-2 pb-4">
          <p className="text-[11px] text-slate-400">Takosan • Ăn đủ. Mua đủ. Dùng hết.</p>
        </div>
      </div>
      <LogoutDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onLoggedOut={() => navigate('/auth', { replace: true })}
      />
    </div>
  );
};

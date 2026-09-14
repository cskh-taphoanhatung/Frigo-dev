import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/common/TopBar';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LogoutDialog } from '../components/common/LogoutDialog';
import { Globe, Shield, LogOut, Smartphone, Trash2, Info, Wifi } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    // Check if app is running in standalone mode (installed PWA)
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPwa);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallHelp(true);
    }
  };

  const handleClearCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-12 text-slate-900">
      <TopBar showBack title="Cài đặt" />

      <div className="px-4 pt-3 space-y-4">
        {/* PWA / App Installation */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <h4 className="font-heading font-bold text-sm text-slate-900">Ứng dụng Takosan trên điện thoại</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {isStandalone
              ? '✅ Ứng dụng đã được cài đặt và đang chạy ở chế độ Độc lập (Standalone PWA).'
              : 'Cài đặt Takosan lên màn hình chính để mở nhanh không qua trình duyệt và sử dụng ngoại tuyến mọi lúc mọi nơi.'}
          </p>
          {!isStandalone && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInstallPwa}
              className="w-full flex items-center justify-center gap-2 text-xs text-slate-800"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cài đặt lên Màn hình chính (PWA)</span>
            </Button>
          )}
        </Card>

        {/* Offline & Cache Management */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-600" />
            <h4 className="font-heading font-bold text-sm text-slate-900">Bộ nhớ đệm ứng dụng</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Xóa tài nguyên PWA đã lưu trên trình duyệt. Thao tác này không xóa dữ liệu ngoại tuyến hoặc thay đổi chưa đồng bộ của bạn.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-800"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>{cacheCleared ? '✓ Đã xóa bộ nhớ đệm ứng dụng' : 'Xóa bộ nhớ đệm ứng dụng'}</span>
          </Button>
        </Card>

        {/* Language */}
        <Card className="p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <h4 className="font-heading font-bold text-sm text-slate-900">Ngôn ngữ hiển thị</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Tiếng Việt (hiện tại). Tiếng Anh sẽ được bổ sung khi bản dịch đầy đủ sẵn sàng.
          </p>
        </Card>

        {/* Privacy Notes */}
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h4 className="font-heading font-bold text-sm text-slate-900">Quyền riêng tư & AI</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Takosan không gửi email, số điện thoại, vị trí hoặc thông tin cá nhân tới các nhà cung cấp AI. AI chỉ nhận diện nguyên liệu từ hình ảnh bạn chủ động gửi để xử lý yêu cầu.
          </p>
        </Card>

        {/* App Version Info */}
        <div className="text-center py-2 space-y-1">
          <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Takosan v{import.meta.env.VITE_APP_VERSION} • Build {import.meta.env.VITE_GIT_COMMIT || 'local'} • {import.meta.env.VITE_BUILD_TIMESTAMP || 'local build'}</span>
          </div>
          <p className="text-[11px] text-slate-400">Ăn đủ. Mua đủ. Dùng hết.</p>
        </div>

        {/* Logout */}
        <div className="pt-2">
          <Button
            variant="danger"
            fullWidth
            size="md"
            onClick={() => setConfirmLogout(true)}
            className="flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất tài khoản</span>
          </Button>
        </div>
      </div>
      <LogoutDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onLoggedOut={() => navigate('/landing', { replace: true })}
      />
      <ConfirmDialog
        open={showInstallHelp}
        title="Cài đặt Takosan lên màn hình chính"
        description={'Trên iPhone (Safari): nhấn nút Chia sẻ rồi chọn "Thêm vào MH chính". Trên Android (Chrome): nhấn menu ba chấm rồi chọn "Cài đặt ứng dụng".'}
        confirmText="Đã hiểu"
        cancelText="Đóng"
        onConfirm={() => setShowInstallHelp(false)}
        onCancel={() => setShowInstallHelp(false)}
      />
    </div>
  );
};

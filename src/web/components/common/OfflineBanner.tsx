import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { subscribe } from '../../lib/sync';
import { api } from '../../services/api';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsub = subscribe(setPending);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  const handleSyncNow = async () => {
    if (syncing || isOffline) return;
    setSyncing(true);
    try {
      await api.retryPendingWrites();
    } finally {
      setSyncing(false);
    }
  };

  if (!isOffline && pending === 0) return null;

  return (
    <div className="bg-takosan-navy text-white px-4 py-2 text-xs flex items-center justify-between gap-2 sticky top-0 z-50 animate-slide-up shadow-md">
      <span className="font-medium flex items-center gap-2 min-w-0">
        <WifiOff className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
        {isOffline
          ? 'Đang ở chế độ Ngoại tuyến. Thay đổi sẽ được tự đồng bộ khi có mạng.'
          : `Đang chờ đồng bộ (${pending} thay đổi).`}
      </span>
      {!isOffline && pending > 0 && (
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          aria-label="Đồng bộ ngay"
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Đang…' : 'Đồng bộ ngay'}
        </button>
      )}
    </div>
  );
};

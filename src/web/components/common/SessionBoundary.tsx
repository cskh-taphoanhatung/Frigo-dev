import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { isOfflineGuestSession } from '../../lib/private-session';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/queryKeys';

export const SessionBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId, householdId, isGuest, logoutStatus, logoutError, logout, setOnboardingFromServer } = useAuthStore();
  const identity = `${userId}:${householdId}`;
  const [verifiedIdentity, setVerifiedIdentity] = useState<string | null>(null);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    if (logoutStatus !== 'idle' || !userId) return;
    let cancelled = false;
    setVerificationFailed(false);
    void queryClient.fetchQuery({
      queryKey: queryKeys.me(),
      queryFn: () => api.getMe({ requireServer: !isOfflineGuestSession() }),
      staleTime: 0,
      retry: false,
    }).then((me) => {
      if (!cancelled) {
        setOnboardingFromServer(me?.user?.onboardingCompleted === true, me?.user?.preferences);
        setVerifiedIdentity(identity);
      }
    }).catch(() => {
      if (!cancelled) setVerificationFailed(true);
    });
    return () => { cancelled = true; };
  }, [identity, userId, isGuest, logoutStatus, retry]);
  if (logoutStatus === 'idle') {
    if (userId && verifiedIdentity !== identity) return (
      <section className="space-y-4 p-6">
        <p role={verificationFailed ? 'alert' : 'status'}>
          {verificationFailed ? 'Không thể xác minh phiên. Vui lòng kết nối mạng và thử lại.' : 'Đang kiểm tra phiên…'}
        </p>
        {verificationFailed && <button className="rounded-xl bg-takosan-green px-4 py-3 text-white" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>}
      </section>
    );
    return <>{children}</>;
  }

  const pending = logoutStatus === 'pending';
  return (
    <main className="min-h-screen bg-takosan-cream flex items-center justify-center p-6">
      <section className="max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm" aria-live="polite">
        <h1 className="text-xl font-bold">{pending ? 'Đang đăng xuất…' : 'Chưa xác nhận đăng xuất'}</h1>
        <p role={pending ? 'status' : 'alert'}>{pending ? 'Đã tạm dừng đồng bộ riêng tư. Đang thu hồi phiên trên máy chủ.' : logoutError}</p>
        {!pending && (
          <button className="rounded-xl bg-takosan-green px-4 py-3 font-semibold text-white" onClick={async () => {
            if (await logout()) navigate('/auth', { replace: true });
          }}>
            Thử đăng xuất lại
          </button>
        )}
      </section>
    </main>
  );
};

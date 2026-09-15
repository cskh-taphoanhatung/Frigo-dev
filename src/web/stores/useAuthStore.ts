import { create } from 'zustand';
import { api } from '../services/api';
import {
  capturePrivateSession, clearPrivateIdentity, currentPrivateScope, LOGOUT_PENDING_KEY,
  LOGOUT_WARNING, OFFLINE_GUEST_KEY, onPrivateSessionReset, privateSessionBlocked, removeLegacyPrivateCaches, resetPrivateSession,
} from '../lib/private-session';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  householdId?: string;
}

interface AuthState {
  userId: string;
  householdId: string;
  email: string;
  isGuest: boolean;
  displayName: string;
  avatarUrl?: string;
  isOnboarded: boolean;
  householdSize: number;
  spicyLevel: string;
  favoriteCuisines: string[];
  dietaryRestrictions: string[];
  primaryGoal?: string;
  isPlus: boolean;
  setPlusFromServer: (isPlus: boolean) => void;
  syncPlusFromServer: () => Promise<void>;
  setGuestSession: () => Promise<void>;
  setAuthSession: (user: AuthUser) => void;
  setOnboardingData: (data: {
    householdSize: number;
    spicyLevel: string;
    favoriteCuisines: string[];
    dietaryRestrictions: string[];
    primaryGoal?: string;
  }) => void;
  logoutStatus: 'idle' | 'pending' | 'error';
  logoutError: string | null;
  logout: () => Promise<boolean>;
}

const anonymousState = {
  userId: '', householdId: '', email: '', displayName: 'Khách ghé thăm', avatarUrl: undefined,
  isGuest: true, isOnboarded: false, isPlus: false, householdSize: 2, spicyLevel: 'medium',
  favoriteCuisines: [] as string[], dietaryRestrictions: [], primaryGoal: undefined,
};
let logoutRequest: Promise<boolean> | null = null;
let guestSessionRequest: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  removeLegacyPrivateCaches();
  if (privateSessionBlocked()) clearPrivateIdentity();
  const savedUserId = localStorage.getItem('frigo_user_id') || '';
  const savedHouseholdId = localStorage.getItem('frigo_household_id') || '';

  const savedEmail = localStorage.getItem('frigo_email') || '';
  const savedDisplayName = localStorage.getItem('frigo_display_name') || 'Người dùng Takosan';
  const savedAvatarUrl = localStorage.getItem('frigo_avatar_url') || '';
  const savedOnboarded = localStorage.getItem('frigo_onboarded') === 'true';
  const savedPlus = localStorage.getItem('frigo_is_plus') === 'true';
  const savedIsGuest = !savedUserId || localStorage.getItem('frigo_is_guest') === 'true';

  return {
    userId: savedUserId,
    householdId: savedHouseholdId,
    email: savedEmail,
    isGuest: savedIsGuest,
    displayName: savedDisplayName,
    avatarUrl: savedAvatarUrl,
    isOnboarded: savedOnboarded,
    isPlus: savedPlus,
    householdSize: 2,
    spicyLevel: 'medium',
    favoriteCuisines: [],
    dietaryRestrictions: [],
    logoutStatus: privateSessionBlocked() ? 'error' : 'idle',
    logoutError: privateSessionBlocked() ? LOGOUT_WARNING : null,

    // S2: entitlement is owned by the server. These are only ever called with
    // values returned from authenticated API responses (/me, /auth/plus/activate);
    // the UI can no longer grant Plus to itself.
    setPlusFromServer: (isPlus: boolean) => {
      if (privateSessionBlocked() || !get().userId) return;
      localStorage.setItem('frigo_is_plus', isPlus ? 'true' : 'false');
      set({ isPlus });
    },

    syncPlusFromServer: async () => {
      const isCurrent = capturePrivateSession();
      try {
        const me = await api.getMe();
        if (!isCurrent() || me?.user?.id !== get().userId) return;
        const sub = me?.user?.subscription;
        const isPlus = me?.user?.isPlus === true || sub?.plan === 'plus';
        localStorage.setItem('frigo_is_plus', isPlus ? 'true' : 'false');
        set({ isPlus });
      } catch {
        // keep cached value if the server is unreachable
      }
    },

    setAuthSession: (user: AuthUser) => {
      if (privateSessionBlocked()) throw new Error(LOGOUT_WARNING);
      if (!user.id || !user.householdId) throw new Error('Máy chủ chưa xác nhận danh tính và hộ gia đình.');
      const hid = user.householdId;
      const current = currentPrivateScope();
      if (current.userId !== user.id || current.householdId !== hid) {
        resetPrivateSession();
        for (const key of ['frigo_onboarded', 'frigo_is_plus', 'frigo_avatar_url']) localStorage.removeItem(key);
      }
      localStorage.setItem('frigo_user_id', user.id);
      localStorage.setItem('frigo_household_id', hid);
      localStorage.setItem('frigo_email', user.email);
      localStorage.setItem('frigo_display_name', user.displayName);
      if (user.avatarUrl) localStorage.setItem('frigo_avatar_url', user.avatarUrl);
      else localStorage.removeItem('frigo_avatar_url');
      localStorage.removeItem('frigo_token');
      sessionStorage.removeItem('frigo_guest_token');
      localStorage.setItem('frigo_is_guest', 'false');
      localStorage.removeItem(OFFLINE_GUEST_KEY);

      set({
        userId: user.id,
        householdId: hid,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isGuest: false,
      });
    },

    // Onboarding must not replace an existing guest or signed-in cookie.
    setGuestSession: () => {
      if (privateSessionBlocked()) return Promise.reject(new Error(LOGOUT_WARNING));
      if (get().userId) return Promise.resolve();
      if (guestSessionRequest) return guestSessionRequest;
      const isCurrent = capturePrivateSession();
      guestSessionRequest = (async () => {
        try {
          let res: Response;
          try {
            res = await fetch('/api/v1/auth/guest', { method: 'POST', credentials: 'include' });
          } catch {
            if (!isCurrent()) throw new Error('Phiên làm việc đã thay đổi. Vui lòng thử lại.');
            const id = `guest_${crypto.randomUUID()}`;
            clearPrivateIdentity();
            localStorage.setItem('frigo_user_id', id);
            localStorage.setItem('frigo_household_id', `hh_${id}`);
            localStorage.setItem('frigo_is_guest', 'true');
            localStorage.setItem(OFFLINE_GUEST_KEY, 'true');
            set({ userId: id, householdId: `hh_${id}`, isGuest: true, displayName: 'Khách ghé thăm' });
            return;
          }
          if (!isCurrent()) throw new Error('Phiên làm việc đã thay đổi. Vui lòng thử lại.');
          if (!res.ok) throw new Error('Không thể khởi tạo phiên khách. Vui lòng thử lại.');
          const data = await res.json() as { success?: boolean; user?: AuthUser };
          if (!isCurrent()) throw new Error('Phiên làm việc đã thay đổi. Vui lòng thử lại.');
          if (!data.success || !data.user?.id || !data.user?.householdId) {
            throw new Error('Máy chủ chưa xác nhận phiên khách.');
          }
          const id: string = data.user.id;
          const hid: string = data.user.householdId;
          clearPrivateIdentity();
          localStorage.setItem('frigo_user_id', id);
          localStorage.setItem('frigo_household_id', hid);
          localStorage.setItem('frigo_is_guest', 'true');
          localStorage.removeItem('frigo_token');
          set({
            userId: id,
            householdId: hid,
            isGuest: true,
            displayName: data.user?.displayName || 'Khách ghé thăm',
          });
        } finally {
          guestSessionRequest = null;
        }
      })();
      return guestSessionRequest;
    },

    setOnboardingData: (data) => {
      if (privateSessionBlocked() || !get().userId) return;
      localStorage.setItem('frigo_onboarded', 'true');
      set({
        isOnboarded: true,
        ...data,
      });
    },

    logout: () => {
      if (logoutRequest) return logoutRequest;
      localStorage.setItem(LOGOUT_PENDING_KEY, 'true');
      clearPrivateIdentity();
      set({ ...anonymousState, logoutStatus: 'pending', logoutError: null });
      logoutRequest = (async () => {
        try {
          await api.logout();
          localStorage.removeItem(LOGOUT_PENDING_KEY);
          set({ logoutStatus: 'idle', logoutError: null });
          return true;
        } catch {
          set({ logoutStatus: 'error', logoutError: LOGOUT_WARNING });
          return false;
        } finally {
          logoutRequest = null;
        }
      })();
      return logoutRequest;
    },
  };
});

onPrivateSessionReset(() => useAuthStore.setState({
  ...anonymousState,
  logoutStatus: privateSessionBlocked() ? 'error' : 'idle',
  logoutError: privateSessionBlocked() ? LOGOUT_WARNING : null,
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LOGOUT_PENDING_KEY || event.key === 'frigo_user_id' || event.key === 'frigo_household_id') {
      sessionStorage.removeItem('frigo_guest_token');
      resetPrivateSession();
      useAuthStore.setState({
        ...currentPrivateScope(),
        email: localStorage.getItem('frigo_email') || '',
        displayName: localStorage.getItem('frigo_display_name') || anonymousState.displayName,
        avatarUrl: localStorage.getItem('frigo_avatar_url') || undefined,
        isGuest: !currentPrivateScope().userId || localStorage.getItem('frigo_is_guest') === 'true',
        isOnboarded: localStorage.getItem('frigo_onboarded') === 'true',
        isPlus: localStorage.getItem('frigo_is_plus') === 'true',
        logoutStatus: privateSessionBlocked() ? 'error' : 'idle',
        logoutError: privateSessionBlocked() ? LOGOUT_WARNING : null,
      });
    }
  });
}

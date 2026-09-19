/**
 * T17 screen registry used for mechanical route/state certification.
 *
 * Numbering source: the Takosan Redesign OS v2.0.0 SCREEN_REGISTRY. Numbers
 * recorded in-repo by the T17 implementation (code comments / report) are
 * `source: 'kit'`; the remainder are reconstructed from the kit's route
 * inventory and marked `source: 'reconstructed'` because the kit archive was
 * not present in the certification sandbox (see T17 report, "Contract
 * availability"). Each entry names the route and the visible proof the
 * certification spec asserts once the route has rendered.
 */
export interface RegisteredScreen {
  id: string;
  name: string;
  path: string;
  /** Public surfaces render without a session. */
  auth: 'public' | 'session';
  /** Whether Home gating requires the onboarding flow to be completed first. */
  needsOnboarded?: boolean;
  /** Visible proof: an accessible heading name (regex) or a test id. */
  proof: { heading?: RegExp; testId?: string; text?: RegExp };
  /** Primary navigation is hidden on immersive surfaces. */
  nav: 'visible' | 'hidden';
  source: 'kit' | 'reconstructed';
}

export const SCREEN_REGISTRY: RegisteredScreen[] = [
  { id: '01', name: 'landing', path: '/landing', auth: 'public', proof: { heading: /.+/ }, nav: 'hidden', source: 'reconstructed' },
  { id: '02', name: 'auth', path: '/auth', auth: 'public', proof: { heading: /Đăng nhập vào Takosan/ }, nav: 'hidden', source: 'kit' },
  { id: '03', name: 'otp', path: '/auth/verify', auth: 'public', proof: { heading: /Xác thực mã OTP/ }, nav: 'hidden', source: 'kit' },
  { id: '04', name: 'onboarding-household', path: '/onboarding/household', auth: 'session', proof: { text: /Bước 1 trên 3/ }, nav: 'hidden', source: 'kit' },
  { id: '05', name: 'onboarding-preferences', path: '/onboarding/preferences', auth: 'session', proof: { text: /Bước 2 trên 3/ }, nav: 'hidden', source: 'kit' },
  { id: '06', name: 'onboarding-goals', path: '/onboarding/goals', auth: 'session', proof: { text: /Bước 3 trên 3/ }, nav: 'hidden', source: 'kit' },
  { id: '07', name: 'home', path: '/', auth: 'session', needsOnboarded: true, proof: { heading: /Xin chào/ }, nav: 'visible', source: 'reconstructed' },
  { id: '08', name: 'scan', path: '/scan', auth: 'session', proof: { text: /Quét|Chụp|Camera/i }, nav: 'hidden', source: 'reconstructed' },
  { id: '09', name: 'scan-review', path: '/scan/:id/review', auth: 'session', proof: { heading: /Kết quả nhận diện AI/ }, nav: 'visible', source: 'kit' },
  { id: '10', name: 'fridge', path: '/fridge', auth: 'session', proof: { heading: /Tủ lạnh của tôi/ }, nav: 'visible', source: 'reconstructed' },
  { id: '11', name: 'fridge-detail', path: '/fridge/:id', auth: 'session', proof: { testId: 'lot-expiry' }, nav: 'visible', source: 'reconstructed' },
  { id: '12', name: 'recipes', path: '/recipes', auth: 'session', proof: { heading: /Gợi ý món ngon/ }, nav: 'visible', source: 'reconstructed' },
  { id: '13', name: 'recipe-detail', path: '/recipes/:slug', auth: 'session', proof: { heading: /Canh chua cá lóc/i }, nav: 'visible', source: 'reconstructed' },
  { id: '14', name: 'cook', path: '/cook/:slug', auth: 'session', proof: { text: /Bước tiếp theo|Hoàn thành nấu/ }, nav: 'hidden', source: 'reconstructed' },
  { id: '15', name: 'shopping', path: '/shopping', auth: 'session', proof: { heading: /Danh sách mua sắm/ }, nav: 'visible', source: 'reconstructed' },
  { id: '16', name: 'planner', path: '/planner', auth: 'session', proof: { heading: /Bữa ngon, tuần nhẹ nhàng|Kế hoạch bữa ăn/ }, nav: 'visible', source: 'kit' },
  { id: '17', name: 'planner-meal', path: '/planner/:planId/meal/:slotId', auth: 'session', proof: { heading: /.+/ }, nav: 'visible', source: 'kit' },
  { id: '18', name: 'planner-shopping', path: '/planner/:planId/shopping', auth: 'session', proof: { heading: /.+/ }, nav: 'visible', source: 'kit' },
  { id: '19', name: 'profile', path: '/me', auth: 'session', proof: { heading: /Hồ sơ/ }, nav: 'visible', source: 'kit' },
  { id: '20', name: 'preferences', path: '/me/preferences', auth: 'session', proof: { heading: /Sở thích & hạn chế/ }, nav: 'visible', source: 'kit' },
  { id: '21', name: 'household', path: '/me/household', auth: 'session', proof: { heading: /Hộ gia đình & chia sẻ/ }, nav: 'visible', source: 'kit' },
  { id: '22', name: 'planning-settings', path: '/settings/planning', auth: 'session', proof: { heading: /Cài đặt lập thực đơn/ }, nav: 'visible', source: 'kit' },
  { id: '23', name: 'notifications', path: '/notifications', auth: 'session', proof: { heading: /^Thông báo$/ }, nav: 'visible', source: 'kit' },
  { id: '24', name: 'notification-preferences', path: '/settings/notifications', auth: 'session', proof: { heading: /Tùy chỉnh thông báo/ }, nav: 'visible', source: 'kit' },
  { id: '25', name: 'app-settings', path: '/settings/app', auth: 'session', proof: { heading: /Cài đặt ứng dụng/ }, nav: 'visible', source: 'kit' },
  { id: '26', name: 'privacy', path: '/settings/privacy', auth: 'session', proof: { heading: /Quyền riêng tư & dữ liệu/ }, nav: 'visible', source: 'kit' },
  { id: '27', name: 'plus', path: '/plus', auth: 'session', proof: { heading: /Takosan Plus/ }, nav: 'visible', source: 'reconstructed' },
];

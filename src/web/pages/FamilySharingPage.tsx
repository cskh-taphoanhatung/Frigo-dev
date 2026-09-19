import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { Page, PageHeader, Section, Surface, UnavailableState, StatusBadge } from '../design-system/primitives';

/**
 * T17 screen 21 — Household & Sharing over real capability only. The server
 * has no invite/join/member-list contract today, so every unavailable action
 * says so honestly; no fabricated members, invite codes, or fake joins
 * (states/empty.md, non-negotiable rule 10).
 */
export const FamilySharingPage: React.FC = () => {
  const navigate = useNavigate();
  const { displayName, householdId } = useAuthStore();

  return (
    <Page width="compact">
      <PageHeader
        title="Hộ gia đình & chia sẻ"
        subtitle="Tủ lạnh này thuộc về hộ của bạn"
        onBack={() => navigate('/me')}
      />

      <div className="space-y-4 pb-8">
        <Section title="Hộ gia đình hiện tại">
          <Surface className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-10 h-10 rounded-card bg-semantic-success-soft text-semantic-action-primary flex items-center justify-center shrink-0" aria-hidden="true">
                  <Users className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-semantic-text-primary truncate">Tủ lạnh nhà tôi</h3>
                  <p className="text-xs text-semantic-text-muted truncate">Mã hộ: {householdId}</p>
                </div>
              </div>
              {/* Only the session-derived fact is asserted: this account
                  belongs to the household. No server status is invented. */}
              <StatusBadge tone="info">Hộ của bạn</StatusBadge>
            </div>
            <p className="text-sm text-semantic-text-secondary leading-relaxed">
              Dữ liệu tủ lạnh, lịch sử quét và thực đơn được phân tách theo hộ. Tài khoản của bạn
              ({displayName || 'bạn'}) là thành viên của hộ này.
            </p>
          </Surface>
        </Section>

        <Section title="Chia sẻ với người thân">
          <div className="space-y-3">
            <UnavailableState title="Mời thành viên — chưa hỗ trợ">
              Chưa có API mời tham gia hộ trên máy chủ. Takosan sẽ không tạo mã mời hay QR cho
              đến khi tính năng này thật sự được cấu hình; mọi mã bạn thấy ở nơi khác đều không
              phải từ ứng dụng này.
            </UnavailableState>
            <UnavailableState title="Tham gia hộ khác — chưa hỗ trợ">
              Hiện không thể nhập mã để tham gia hộ khác. Nhập mã sẽ không tạo kết nối thật, nên
              Takosan không hiển thị luồng giả.
            </UnavailableState>
            <UnavailableState title="Danh sách thành viên — chưa hỗ trợ">
              Máy chủ chưa trả về danh sách thành viên hộ. Khi có API, trang này sẽ hiển thị đúng
              vai trò từng người, không thêm thành viên mẫu.
            </UnavailableState>
          </div>
        </Section>

        <p className="text-xs text-semantic-text-muted leading-relaxed">
          Khi chia sẻ hộ được mở, người thân sẽ cùng theo dõi đồ ăn trong tủ, danh sách đi chợ và
          cảnh báo đồ sắp hết hạn — với đúng quyền máy chủ cho phép.
        </p>
      </div>
    </Page>
  );
};

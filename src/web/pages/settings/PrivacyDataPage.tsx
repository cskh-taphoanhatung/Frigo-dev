import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Bot } from 'lucide-react';
import { Page, PageHeader, Section, Surface, UnavailableState } from '../../design-system/primitives';

const PERMISSION_LABELS: Record<string, string> = {
  granted: 'đã cho phép',
  denied: 'đã chặn',
  default: 'chưa được yêu cầu',
  unsupported: 'trình duyệt không hỗ trợ',
};

/**
 * T17 screen 26 — privacy & data. Every action maps to a real capability or
 * an honest unavailable state; no fake export file or deletion success.
 */
export const PrivacyDataPage: React.FC = () => {
  const navigate = useNavigate();
  const [browserPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  return (
    <Page width="compact">
      <PageHeader
        title="Quyền riêng tư & dữ liệu"
        subtitle="Dữ liệu của bạn ở trong tủ lạnh của bạn"
        onBack={() => navigate('/me')}
      />

      <div className="space-y-4 pb-8">
        <Section title="Dữ liệu Takosan lưu">
          <Surface className="p-4 space-y-2">
            <p className="text-sm text-semantic-text-secondary leading-relaxed">
              Takosan lưu hồ sơ tài khoản, sở thích ăn uống, nguyên liệu trong tủ, lịch sử quét
              và thực đơn thuộc hộ gia đình của bạn. Dữ liệu được phân tách theo hộ; các hộ khác
              không nhìn thấy tủ hoặc thực đơn của bạn.
            </p>
          </Surface>
        </Section>

        <Section title="Cách AI được dùng">
          <Surface className="p-4 space-y-2">
            <p className="text-sm text-semantic-text-secondary leading-relaxed flex gap-2">
              <Bot className="w-4 h-4 text-semantic-action-primary shrink-0 mt-0.5" aria-hidden="true" />
              Takosan không gửi email, số điện thoại, vị trí hoặc thông tin cá nhân tới các nhà
              cung cấp AI. AI chỉ nhận diện nguyên liệu từ hình ảnh bạn chủ động gửi để xử lý
              yêu cầu quét.
            </p>
          </Surface>
        </Section>

        <Section title="Quyền trên trình duyệt">
          <Surface className="p-4 space-y-2">
            <p className="text-sm text-semantic-text-secondary flex gap-2">
              <Bell className="w-4 h-4 text-semantic-action-primary shrink-0 mt-0.5" aria-hidden="true" />
              Quyền thông báo hiện tại:{' '}
              <strong>{PERMISSION_LABELS[browserPermission] ?? 'không xác định'}</strong>. Bạn đổi
              quyền này trong cài đặt trình duyệt; Takosan không thể tự bật.
            </p>
          </Surface>
        </Section>

        <Section title="Dữ liệu cá nhân">
          <div className="space-y-3">
            <UnavailableState title="Xuất dữ liệu — chưa hỗ trợ">
              Chưa có API xuất dữ liệu cá nhân. Khi tính năng này ra mắt, bạn sẽ tải đúng dữ liệu
              tài khoản của mình từ đây. Hiện trang này không tạo file giả.
            </UnavailableState>
            <UnavailableState title="Xóa tài khoản — chưa hỗ trợ">
              Chưa có luồng xóa tài khoản. Việc xóa dữ liệu vĩnh viễn cần xác thực máy chủ và sẽ
              được công bố khi sẵn sàng. Hiện trang này không hiển thị xóa thành công.
            </UnavailableState>
          </div>
          <p className="text-xs text-semantic-text-muted mt-2">
            Đăng xuất khỏi thiết bị vẫn hoạt động từ trang Hồ sơ của bạn.
          </p>
        </Section>
      </div>
    </Page>
  );
};

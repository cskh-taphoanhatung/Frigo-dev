import React from 'react';
import { Button } from '../../components/common/Button';

interface VerifyUnavailableProps {
  onRegister: () => void;
  onLogin: () => void;
}

/** `/auth/verify` reached without a verification in progress on this device
 *  (direct link, expired tab, cleared storage). Says so honestly instead of
 *  rendering an OTP form that could never succeed; no code is requested. */
export const VerifyUnavailable: React.FC<VerifyUnavailableProps> = ({ onRegister, onLogin }) => (
  <div className="mt-6 space-y-4" data-testid="verify-context-missing">
    <div
      role="note"
      className="rounded-card border border-dashed border-semantic-border-strong bg-semantic-background-subtle px-4 py-3.5"
    >
      <p className="text-sm font-semibold text-semantic-text-secondary">Không có yêu cầu xác thực đang chờ</p>
      <p className="mt-1 text-xs leading-relaxed text-semantic-text-muted">
        Trang này chỉ dùng ngay sau khi đăng ký hoặc đăng nhập bằng tài khoản chưa xác thực trên
        cùng thiết bị. Takosan không thể gửi mã OTP khi chưa biết email của bạn.
      </p>
    </div>
    <Button fullWidth size="lg" type="button" onClick={onRegister}>
      Tạo tài khoản mới
    </Button>
    <Button fullWidth size="lg" type="button" variant="outline" onClick={onLogin}>
      Đăng nhập bằng tài khoản đã có
    </Button>
  </div>
);

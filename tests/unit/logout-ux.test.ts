import { describe, expect, it } from 'vitest';
import { logoutPromptCopy } from '../../src/web/lib/logout-ux';

describe('offline logout prompt', () => {
  it('keeps the normal server-confirmed copy when no writes are pending', () => {
    expect(logoutPromptCopy(0)).toEqual({
      description: 'Takosan sẽ xóa dữ liệu riêng tư khỏi thiết bị này trước khi yêu cầu máy chủ thu hồi phiên. Nếu máy chủ chưa xác nhận, bạn cần kết nối mạng và thử lại.',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
    });
  });

  it('warns with the exact owned pending count before destructive logout', () => {
    const copy = logoutPromptCopy(5);
    expect(copy.description).toContain('Bạn còn 5 thay đổi chưa đồng bộ.');
    expect(copy.description).toContain('xóa các thay đổi này khỏi thiết bị');
    expect(copy.confirmText).toBe('Đăng xuất và bỏ thay đổi');
    expect(copy.cancelText).toBe('Ở lại');
  });
});

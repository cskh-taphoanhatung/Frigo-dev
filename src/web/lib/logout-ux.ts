export interface LogoutPromptCopy {
  description: string;
  confirmText: string;
  cancelText: string;
}

export function logoutPromptCopy(pendingCount: number): LogoutPromptCopy {
  if (pendingCount > 0) {
    return {
      description: `Bạn còn ${pendingCount} thay đổi chưa đồng bộ. Đăng xuất bây giờ sẽ xóa các thay đổi này khỏi thiết bị và yêu cầu máy chủ thu hồi phiên. Nếu máy chủ chưa xác nhận, bạn cần kết nối mạng và thử lại.`,
      confirmText: 'Đăng xuất và bỏ thay đổi',
      cancelText: 'Ở lại',
    };
  }

  return {
    description: 'Takosan sẽ xóa dữ liệu riêng tư khỏi thiết bị này trước khi yêu cầu máy chủ thu hồi phiên. Nếu máy chủ chưa xác nhận, bạn cần kết nối mạng và thử lại.',
    confirmText: 'Đăng xuất',
    cancelText: 'Hủy',
  };
}

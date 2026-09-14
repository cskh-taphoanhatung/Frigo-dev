import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import { X, Copy, Check, CheckCircle2, ShieldCheck, Clock, QrCode, Sparkles, AlertCircle, Inbox } from 'lucide-react';

interface VietQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planType: 'monthly' | 'annual';
  amount: number;
}

export const VietQRModal: React.FC<VietQRModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  planType,
  amount,
}) => {
  const userId = useAuthStore((s) => s.userId);
  const setPlusFromServer = useAuthStore((s) => s.setPlusFromServer);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bankInfo = {
    bankId: 'vietcombank',
    bankName: 'Vietcombank (VCB)',
    accountNo: '9936888666',
    accountName: 'CONG TY FRIGO VIET NAM',
    description: `FRIGO PLUS ${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`,
  };

  // VietQR Dynamic Image URL
  const qrUrl = `https://img.vietqr.io/image/${bankInfo.bankId}-${bankInfo.accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
    bankInfo.description
  )}&accountName=${encodeURIComponent(bankInfo.accountName)}`;

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isPaid || pending) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isPaid, pending]);

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleMarkPaid = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await api.confirmPlusPayment(planType);
      setIsVerifying(false);
      if (res.granted) {
        // Server-authoritative: only unlock because the server confirmed it.
        setPlusFromServer(true);
        setIsPaid(true);
        setTimeout(onSuccess, 1600);
      } else {
        // Payment recorded but not yet verified — do NOT unlock.
        setPending(true);
      }
    } catch (err) {
      setIsVerifying(false);
      setErrorMsg('Không xác minh được giao dịch với máy chủ. Vui lòng thử lại.');
    }
  };

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-200/80 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-[#0F3D2E] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm leading-tight text-white">Thanh toán VietQR</h3>
              <p className="text-[11px] text-slate-200">Napas 24/7 Chuyển khoản tự động</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center tap-target transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-slate-900 bg-slate-50/50">
          {isPaid ? (
            <div className="py-8 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-lg text-slate-900">
                  Thanh toán thành công! 🎉
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  Chào mừng bạn đến với <span className="font-semibold text-emerald-700">Frigo Plus</span>. Toàn bộ tính năng cao cấp đã được mở khóa!
                </p>
              </div>
            </div>
          ) : pending ? (
            <div className="py-8 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mx-auto shadow-xs">
                <Inbox className="w-9 h-9" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-lg text-slate-900">
                  Đang đối soát giao dịch
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  Chúng tôi đã ghi nhận lệnh chuyển khoản của bạn. Frigo Plus sẽ
                  <span className="font-semibold text-emerald-700"> tự động kích hoạt</span> ngay
                  khi thanh toán được xác minh. Vui lòng không lặp lại giao dịch.
                </p>
              </div>
              <Button variant="outline" size="md" onClick={onClose}>
                Đóng
              </Button>
            </div>
          ) : (
            <>
              {/* Plan Pill & Timer */}
              <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-heading font-semibold text-xs text-slate-900">
                    {planType === 'annual' ? 'Gói 1 Năm Frigo Plus' : 'Gói 1 Tháng Frigo Plus'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-700">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>

              {/* VietQR Code Image */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center relative">
                <img
                  src={qrUrl}
                  alt="Mã VietQR"
                  className="w-52 h-52 object-contain rounded-lg"
                  onError={(e) => {
                    // Fallback visual QR simulation if network blocks VietQR image CDN
                    (e.target as any).src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      `2|99|0936888666|${bankInfo.accountName}|${amount}|${bankInfo.description}`
                    )}`;
                  }}
                />
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Mở app ngân hàng bất kỳ để quét mã QR Napas 24/7
                </p>
              </div>

              {/* Transfer Details Form */}
              <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-semibold text-slate-900">{bankInfo.bankName}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{bankInfo.accountNo}</span>
                    <button
                      onClick={() => copyToClipboard(bankInfo.accountNo, 'acc')}
                      className="p-1 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 tap-target text-emerald-700"
                      title="Sao chép"
                    >
                      {copiedField === 'acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Số tiền:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-emerald-700">
                      {amount.toLocaleString('vi-VN')}đ
                    </span>
                    <button
                      onClick={() => copyToClipboard(String(amount), 'amount')}
                      className="p-1 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 tap-target text-emerald-700"
                      title="Sao chép"
                    >
                      {copiedField === 'amount' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Nội dung CK:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 truncate max-w-[140px]">
                      {bankInfo.description}
                    </span>
                    <button
                      onClick={() => copyToClipboard(bankInfo.description, 'desc')}
                      className="p-1 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 tap-target text-emerald-700"
                      title="Sao chép"
                    >
                      {copiedField === 'desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Security guarantee */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Bảo mật chuẩn mã hóa ngân hàng Napas</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isPaid && !pending && (
          <div className="p-4 bg-white border-t border-slate-100 space-y-2">
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200/70 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <Button
              fullWidth
              size="lg"
              disabled={isVerifying}
              onClick={handleMarkPaid}
              className="flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Đang đối soát giao dịch…</span>
                </>
              ) : (
                <span>Tôi đã chuyển khoản xong</span>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { TopBar } from '../components/common/TopBar';
import { Button } from '../components/common/Button';
import { Users, QrCode, Copy, Check, Share2, ShieldCheck, UserCheck } from 'lucide-react';

export const FamilySharingPage: React.FC = () => {
  const { displayName, householdId } = useAuthStore();

  const [inviteCode] = useState('FRG-8926');
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const [members, setMembers] = useState([
    { id: '1', name: displayName || 'Bạn', role: 'Chủ nhà (Owner)', avatar: '👨‍🍳', isMe: true },
    { id: '2', name: 'Thành viên gia đình', role: 'Thành viên (Member)', avatar: '👩‍🍳', isMe: false },
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Tham gia Tủ lạnh Gia đình trên Takosan',
        text: `Tham gia tủ lạnh thông minh cùng mình trên Takosan nhé! Nhập mã mời: ${inviteCode}`,
        url: window.location.origin,
      }).catch(() => {});
    } else {
      handleCopyCode();
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinSuccess(`Đã kết nối thành công với tủ lạnh mã [${joinCode.trim().toUpperCase()}]!`);
    setMembers((prev) => [
      ...prev,
      { id: String(Date.now()), name: `Thành viên (${joinCode.trim().toUpperCase()})`, role: 'Thành viên (Member)', avatar: '🥗', isMe: false }
    ]);
    setJoinCode('');
    setTimeout(() => setJoinSuccess(null), 4000);
  };

  // Dynamic QR Code for quick camera scan to join household
  const joinUrl = `${window.location.origin}/family?code=${inviteCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;

  return (
    <div className="min-h-screen bg-takosan-cream pb-16 text-slate-900 max-w-md mx-auto">
      <TopBar showBack title="Tủ lạnh Gia đình" subtitle="Đồng bộ kho thực phẩm & đi chợ" />

      <div className="px-4 pt-3 space-y-4">
        {/* Success Alert */}
        {joinSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/60 text-xs text-emerald-900 font-semibold flex items-center gap-2 animate-in fade-in duration-200 shadow-xs">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{joinSuccess}</span>
          </div>
        )}

        {/* Household Overview Hero Card */}
        <div className="bg-gradient-to-br from-takosan-green via-[#276B4F] to-[#1F563E] text-white rounded-2xl p-5 shadow-card space-y-3 border border-emerald-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base leading-tight text-white">Tủ lạnh nhà tôi</h3>
                <p className="text-[11px] text-slate-200">Mã hộ: {householdId}</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
              {members.length} thành viên
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">
            Các thành viên cùng theo dõi đồ ăn trong tủ, chia sẻ danh sách đi chợ và nhận cảnh báo đồ sắp hết hạn.
          </p>

          {/* Quick Invite Code Box */}
          <div className="bg-slate-900/50 rounded-xl p-3 flex items-center justify-between backdrop-blur-md border border-white/10">
            <div>
              <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">Mã mời gia đình</p>
              <p className="font-mono font-bold text-xl text-amber-300 tracking-widest">{inviteCode}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 text-xs font-semibold flex items-center gap-1.5 transition-all tap-target"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã chép' : 'Chép mã'}</span>
              </button>
              <button
                onClick={handleShare}
                className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center tap-target hover:bg-emerald-500 transition-all"
                title="Chia sẻ"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* QR Scan to Join */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-22 h-22 shrink-0 bg-slate-50 p-1.5 rounded-xl border border-slate-100 flex items-center justify-center">
            <img src={qrCodeUrl} alt="Mã QR gia đình" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <QrCode className="w-4 h-4" />
              <span>Quét QR nhanh</span>
            </div>
            <h4 className="font-heading font-bold text-sm text-slate-900">Quét từ điện thoại người thân</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mở camera quét mã này để tham gia tủ lạnh ngay không cần nhập mã.
            </p>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="font-heading font-bold text-sm text-slate-900">Thành viên trong nhà</h4>

          <div className="space-y-2.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg shadow-xs">
                    {m.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-heading font-semibold text-sm text-slate-900">{m.name}</p>
                      {m.isMe && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold">
                          Bạn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{m.role}</p>
                  </div>
                </div>
                <span className="text-xs text-emerald-700 font-semibold">Đang kết nối</span>
              </div>
            ))}
          </div>
        </div>

        {/* Join another Household */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="font-heading font-bold text-sm text-slate-900">Tham gia tủ lạnh khác</h4>
          <p className="text-xs text-slate-500">
            Nếu bạn được người thân gửi mã mời, hãy nhập vào đây:
          </p>

          <form onSubmit={handleJoin} className="flex gap-2 pt-1">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="VD: FRG-8926"
              className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200/80 text-sm font-mono font-bold uppercase focus:outline-none focus:border-emerald-600 bg-white"
            />
            <Button size="md" type="submit" disabled={!joinCode.trim()}>
              Tham gia
            </Button>
          </form>
        </div>

        {/* Security Note */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Dữ liệu đồng bộ an toàn & phân quyền rõ ràng</span>
        </div>
      </div>
    </div>
  );
};

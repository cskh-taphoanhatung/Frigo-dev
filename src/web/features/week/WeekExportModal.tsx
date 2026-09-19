import React, { useState } from 'react';
import { MealPlan, AggregatedShoppingItem } from '@frigo/domain';
import { Button } from '../../components/common/Button';
import { X, Copy, Check, Share2, Calendar, ShoppingBag, Send } from 'lucide-react';

interface WeekExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: MealPlan;
  shoppingItems?: AggregatedShoppingItem[];
}

export const WeekExportModal: React.FC<WeekExportModalProps> = ({
  isOpen,
  onClose,
  plan,
  shoppingItems = [],
}) => {
  const [copiedType, setCopiedType] = useState<'menu' | 'shopping' | null>(null);

  if (!isOpen) return null;

  const totalMeals = plan.days.reduce((acc, d) => acc + d.slots.length, 0);

  // Generate Menu text
  const generateMenuText = () => {
    const lines = [
      `🥗 THỰC ĐƠN TUẦN NÀY (${totalMeals} bữa)`,
      `💰 Ngân sách: ${plan.budget.displayText} | Tận dụng tủ: ${plan.utilization.utilizationPercent}%`,
      '--------------------------------',
    ];

    plan.days.forEach((day) => {
      const mealNames = day.slots
        .map((s) => {
          const slotLabel = s.slotType === 'dinner' ? 'Tối' : s.slotType === 'lunch' ? 'Trưa' : s.slotType === 'breakfast' ? 'Sáng' : 'Phụ';
          return `${slotLabel}: ${s.recipe?.title || 'Tự chọn'}`;
        })
        .join(' | ');
      lines.push(`• ${day.dayNameVi}: ${mealNames || 'Tự do'}`);
    });

    lines.push('--------------------------------');
    lines.push('Lên bởi Takosan Week — Ăn đủ. Mua đủ. Dùng hết.');
    return lines.join('\n');
  };

  // Generate Shopping list text
  const generateShoppingText = () => {
    const lines = [
      `🛒 DANH SÁCH ĐI CHỢ TUẦN (${shoppingItems.length} món)`,
      `💰 Dự kiến: ${plan.budget.displayText}`,
      '--------------------------------',
    ];

    const categoryNames: Record<string, string> = {
      produce: '🥦 Rau củ quả tươi',
      meat_seafood: '🥩 Thịt & Hải sản',
      dairy_eggs: '🥚 Trứng & Sữa',
      spices_oils: '🧂 Gia vị & Dầu ăn',
      grains_dry: '🌾 Gạo & Đồ khô',
      frozen: '❄️ Đồ đông lạnh',
      other: '📦 Khác',
    };

    const grouped: Record<string, AggregatedShoppingItem[]> = {};
    shoppingItems.forEach((it) => {
      const cat = it.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(it);
    });

    Object.entries(grouped).forEach(([cat, items]) => {
      lines.push(`\n${categoryNames[cat] || cat}:`);
      items.forEach((it) => {
        const qty = it.recommendedPurchaseQuantity || it.missingQuantity;
        lines.push(` [ ] ${it.name}: ${qty} ${it.unit}`);
      });
    });

    lines.push('\n--------------------------------');
    lines.push('Tạo bởi Takosan — frigo.tungjpstore.net');
    return lines.join('\n');
  };

  const handleCopyMenu = () => {
    const text = generateMenuText();
    navigator.clipboard.writeText(text);
    setCopiedType('menu');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyShopping = () => {
    const text = generateShoppingText();
    navigator.clipboard.writeText(text);
    setCopiedType('shopping');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleNativeShare = () => {
    const text = `${generateMenuText()}\n\n${generateShoppingText()}`;
    if (navigator.share) {
      navigator.share({
        title: 'Thực đơn & Danh sách đi chợ tuần Takosan',
        text,
      }).catch(() => {});
    } else {
      handleCopyShopping();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in text-slate-900">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-200/80 flex flex-col max-h-[90vh] animate-fade-in">
        {/* Header */}
        <div className="p-4 bg-takosan-green text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-takosan-green flex items-center justify-center text-white">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm leading-tight text-white">Chia sẻ Kế hoạch Tuần</h3>
              <p className="text-[11px] text-slate-200">Gửi qua Zalo, Messenger hoặc Tin nhắn</p>
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

        {/* Content Preview */}
        <div className="p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
          {/* Card Preview */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-heading font-semibold text-sm text-slate-900">Thực đơn tuần này</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/60">
                {totalMeals} bữa
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-1">
              <div>
                <span className="text-slate-500 block text-[11px]">Ngân sách:</span>
                <span className="font-semibold text-takosan-green">
                  {plan.budget.displayText}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Tận dụng tủ lạnh:</span>
                <span className="font-semibold text-slate-900">
                  {plan.utilization.utilizationPercent}%
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 line-clamp-3 pt-1 border-t border-slate-100 leading-relaxed">
              {plan.days.map((d) => `${d.dayNameVi}: ${d.slots[0]?.recipe?.title || 'Tự do'}`).join(' • ')}
            </p>
          </div>

          {/* Quick Share Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleCopyShopping}
              className="w-full p-3 rounded-xl bg-white border border-slate-200/80 hover:border-takosan-green/50 flex items-center justify-between transition-tap tap-target text-left shadow-xs active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-takosan-mint border border-takosan-mint-deep flex items-center justify-center text-takosan-green-deep">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-xs text-slate-900">Sao chép Danh sách đi chợ</p>
                  <p className="text-[11px] text-slate-500">Định dạng gạch đầu dòng tiện đi chợ</p>
                </div>
              </div>
              {copiedType === 'shopping' ? (
                <span className="text-xs font-semibold text-takosan-green flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Đã chép
                </span>
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <button
              onClick={handleCopyMenu}
              className="w-full p-3 rounded-xl bg-white border border-slate-200/80 hover:border-takosan-green/50 flex items-center justify-between transition-tap tap-target text-left shadow-xs active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-takosan-mint border border-takosan-mint-deep flex items-center justify-center text-takosan-green-deep">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-xs text-slate-900">Sao chép Thực đơn 7 ngày</p>
                  <p className="text-[11px] text-slate-500">Gửi cho cả nhà cùng xem</p>
                </div>
              </div>
              {copiedType === 'menu' ? (
                <span className="text-xs font-semibold text-takosan-green flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Đã chép
                </span>
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-100">
          <Button
            fullWidth
            size="lg"
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Gửi qua Zalo / Tin nhắn</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

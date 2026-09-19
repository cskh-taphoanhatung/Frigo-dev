import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCookingStore } from '../stores/useCookingStore';
import { api } from '../services/api';
import { TopBar } from '../components/common/TopBar';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import { CheckCircle2, Refrigerator, ArrowRight } from 'lucide-react';

export const CookingCompletePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRecipe, deductions, updateDeduction, resetCooking } = useCookingStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeRecipe) {
    return (
      <div className="min-h-screen bg-takosan-cream p-6 flex flex-col justify-center items-center text-center">
        <p className="text-base text-slate-800 font-medium mb-4">Không có món ăn đang hoàn tất</p>
        <Button onClick={() => navigate('/recipes')}>Xem công thức</Button>
      </div>
    );
  }

  const handleConfirmDeduction = async () => {
    setIsSubmitting(true);
    try {
      await api.completeCooking(activeRecipe.id, deductions);
      resetCooking();
      navigate('/fridge');
    } catch (err) {
      console.error('Failed to complete cooking and deduct inventory:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-12">
      <TopBar title="Hoàn tất món ăn" />

      <div className="px-4 pt-4 space-y-5">
        {/* Congratulation Hero with delicious-meal illustration */}
        <div className="text-center py-4 bg-takosan-mint/70 rounded-2xl p-5 border border-takosan-mint-deep shadow-xs">
          <div className="w-24 h-24 mx-auto mb-2 overflow-hidden flex items-center justify-center">
            <img
              src={TAKOSAN_BRAND.mascot.celebrate}
              alt="Takosan ăn mừng"
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="font-heading font-bold text-2xl text-slate-900">
            Món ăn đã hoàn thành! 🎉
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Chúc mừng bạn đã nấu xong <span className="font-semibold text-slate-900">{activeRecipe.title}</span>.
          </p>
        </div>

        {/* Inventory Deduction Confirmation Draft */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-1.5">
              <Refrigerator className="w-4 h-4 text-takosan-green" />
              <span>Cập nhật số lượng trong tủ lạnh</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Kiểm tra & chỉnh sửa</span>
          </div>

          <p className="text-xs text-slate-500">
            Dưới đây là lượng nguyên liệu dự kiến được trừ. Bạn có thể điều chỉnh lại nếu thực tế dùng khác.
          </p>

          <div className="space-y-2.5">
            {deductions.map((d) => (
              <Card key={d.ingredientId} className="p-3.5 flex items-center justify-between shadow-xs">
                <div>
                  <h4 className="font-heading font-semibold text-sm text-slate-900">
                    {d.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ban đầu: {d.currentQuantity} {d.unit} &rarr; Còn lại: {d.remainingQuantity} {d.unit}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-600">
                    -{d.quantityDeducted} {d.unit}
                  </span>

                  <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200 shadow-xs">
                    <button
                      onClick={() => updateDeduction(d.ingredientId, Math.max(0, d.quantityDeducted - (d.unit === 'g' ? 50 : 1)))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded-md tap-target transition-colors"
                      aria-label="Giảm số lượng trừ"
                    >
                      –
                    </button>
                    <button
                      onClick={() => updateDeduction(d.ingredientId, Math.min(d.currentQuantity, d.quantityDeducted + (d.unit === 'g' ? 50 : 1)))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded-md tap-target transition-colors"
                      aria-label="Tăng số lượng trừ"
                    >
                      +
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            fullWidth
            size="lg"
            onClick={handleConfirmDeduction}
            isLoading={isSubmitting}
            className="flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Xác nhận & Cập nhật tủ lạnh</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TopBar } from '../components/common/TopBar';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { InlineError } from '../components/common/AsyncState';
import { api } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { clsx } from 'clsx';

export const ShoppingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const shoppingKey = queryKeys.shoppingList();
  const shoppingQuery = useQuery({ queryKey: shoppingKey, queryFn: () => api.getShoppingList() });
  const items = shoppingQuery.data ?? [];
  const loading = shoppingQuery.isPending;
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('piece');

  const refreshList = () => queryClient.invalidateQueries({ queryKey: shoppingKey });
  const toggleItem = useMutation({
    mutationFn: ({ id, current }: { id: string; current: boolean }) => api.toggleShoppingItem(id, !current),
    onSuccess: refreshList,
  });
  const deleteItem = useMutation({ mutationFn: api.deleteShoppingItem, onSuccess: refreshList });
  const addItem = useMutation({
    mutationFn: api.addShoppingItem,
    onSuccess: () => {
      setNewItemName('');
      setNewItemQty(1);
      return refreshList();
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    addItem.mutate({
      name: newItemName.trim(),
      quantity: Number(newItemQty),
      unit: newItemUnit,
    });

  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-12">
      <TopBar showBack title="Danh sách mua sắm" subtitle="Các nguyên liệu cần mua thêm" />

      <div className="px-4 pt-3 space-y-4">
        {(toggleItem.isError || deleteItem.isError || addItem.isError) && (
          <InlineError message="Chưa lưu được thay đổi. Vui lòng thử lại thao tác." />
        )}

        {/* Quick Add Bar */}
        <form onSubmit={handleAddItem} className="flex gap-2">
          <input
            type="text"
            required
            aria-label="Tên nguyên liệu cần mua"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Thêm món: Hành tím, Tiêu, Nấm..."
            className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-slate-200/80 text-sm font-medium text-slate-900 focus:outline-none focus:border-takosan-green bg-white shadow-xs transition-colors"
          />

          <select
            aria-label="Đơn vị"
            value={newItemUnit}
            onChange={(e) => setNewItemUnit(e.target.value)}
            className="h-11 min-w-0 px-2.5 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-takosan-green transition-colors"
          >
            <option value="piece">quả/bìa</option>
            <option value="g">gam (g)</option>
            <option value="kg">kg</option>
            <option value="bunch">bó</option>
            <option value="pack">gói</option>
            <option value="l">lít</option>
          </select>

          <Button size="md" type="submit" className="shrink-0 px-3.5 h-11" aria-label="Thêm món vào danh sách">
            <Plus className="w-5 h-5" />
          </Button>
        </form>

        {/* Shopping Items List */}
        <div className="space-y-2 pt-1">
          {shoppingQuery.isError ? (
            <InlineError error={shoppingQuery.error} onRetry={() => shoppingQuery.refetch()} />
          ) : loading ? (
            <div className="text-center py-10">
              <div className="animate-spin w-7 h-7 border-2 border-takosan-green border-t-transparent rounded-full mx-auto" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              type="shopping-ready"
              title="Danh sách đang trống"
              description="Khi xem công thức món ăn, các nguyên liệu còn thiếu có thể được thêm trực tiếp vào đây."
            />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => !toggleItem.isPending && toggleItem.mutate({ id: item.id, current: item.isChecked })}
                className={clsx(
                  'p-3 rounded-xl flex items-center justify-between cursor-pointer transition-tap border border-slate-200/80 shadow-xs active:scale-[0.99]',
                  item.isChecked ? 'bg-slate-50/70 opacity-60' : 'bg-white hover:border-slate-300'
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    aria-label={item.isChecked ? 'Bỏ đánh dấu đã mua' : 'Đánh dấu đã mua'}
                    className="text-takosan-green tap-target flex items-center justify-center shrink-0"
                  >
                    {item.isChecked ? (
                      <CheckCircle2 className="w-5 h-5 fill-takosan-green text-white" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300" />
                    )}
                  </button>

                  <div>
                    <h4
                      className={clsx(
                        'font-heading font-semibold text-sm text-slate-900',
                        item.isChecked && 'line-through text-slate-400'
                      )}
                    >
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {item.quantity} {item.unit}
                      {item.sourceRecipeTitle && ` • Cần cho ${item.sourceRecipeTitle}`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem.mutate(item.id);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors tap-target flex items-center justify-center"
                  aria-label="Xóa món"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

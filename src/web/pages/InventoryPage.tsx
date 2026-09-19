import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { TopBar } from '../components/common/TopBar';
import { IngredientRow } from '../components/common/IngredientRow';
import { EmptyState } from '../components/common/EmptyState';
import { AnimatePresence, motion, MOTION_TOKENS } from '../design-system/motion';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Button } from '../components/common/Button';
import { api } from '../services/api';
import { ApiError } from '../services/http';
import { queryKeys } from '../lib/queryKeys';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { presentDomainError, presentRefetchOutcome } from '../lib/inventory-truth';
import { Plus, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { StandardUnit } from '@frigo/domain';

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; version: number } | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  // True while a conflict's authoritative reload has not succeeded (T13R-B P2-4).
  const [refetchFailed, setRefetchFailed] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<StandardUnit>('piece');
  const [category, setCategory] = useState('vegetable');
  const [storage, setStorage] = useState('fridge');
  const [expiryDays, setExpiryDays] = useState(5);

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });
  const items = inventoryQuery.data ?? [];
  const loading = inventoryQuery.isPending;

  // T13R-B P2-4: a conflict-class failure (CONFLICT / IDEMPOTENCY_CONFLICT /
  // STALE_SNAPSHOT …) means the displayed stock is stale. The authoritative
  // inventory is reloaded and the stale rows replaced; the copy claims a
  // successful refresh only when the reload actually succeeded, and the
  // mutation itself is never resubmitted automatically (retry: false).
  const presentMutationFailure = async (error: unknown, fallback: string) => {
    const code = error instanceof ApiError ? error.code : null;
    const presentation = presentDomainError(code, fallback);
    if (!presentation.refetch) {
      setRefetchFailed(false);
      setMutationError(presentation.message);
      return;
    }
    setMutationError(presentation.message);
    await invalidateInventoryDependents();
    const reloaded = await inventoryQuery.refetch({ throwOnError: false });
    const refreshed = reloaded.status === 'success';
    setRefetchFailed(!refreshed);
    setMutationError(presentRefetchOutcome(presentation, refreshed).message);
  };

  const updateQty = useMutation({
    retry: false,
    mutationFn: ({ id, newQty, version }: { id: string; newQty: number; version: number }) =>
      api.updateInventoryItem(id, { quantity: newQty }, version),
    onSuccess: invalidateInventoryDependents,
    onError: (error: unknown) => presentMutationFailure(error, 'Chưa cập nhật được số lượng. Vui lòng thử lại.'),
  });

  const deleteItem = useMutation({
    retry: false,
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.deleteInventoryItem(id, version),
    onSuccess: invalidateInventoryDependents,
    onError: (error: unknown) => presentMutationFailure(error, 'Chưa xóa được nguyên liệu. Vui lòng thử lại.'),
  });

  const addItem = useMutation({
    retry: false,
    mutationFn: (payload: any) => api.addInventoryItem(payload),
    onSuccess: () => {
      void invalidateInventoryDependents();
      setIsAddModalOpen(false);
      setName('');
      setQuantity(1);
    },
    onError: (error: unknown) => presentMutationFailure(error, 'Chưa thêm được nguyên liệu. Vui lòng thử lại.'),
  });

  const handleUpdateQty = (id: string, currentQty: number, delta: number, version: number) => {
    setMutationError(null);
    setRefetchFailed(false);
    updateQty.mutate({ id, newQty: Math.max(1, currentQty + delta), version });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setMutationError(null);
    setRefetchFailed(false);
    // T13: "Chưa rõ" means no expiry evidence exists. Sending a computed date
    // here would manufacture a dated fact the user never supplied.
    const expiryDate = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0]
      : null;
    addItem.mutate({
      name: name.trim(),
      quantity: Number(quantity),
      unit,
      category,
      storage,
      expiryDate,
      // Day chips are estimates, never dated facts.
      expiryEstimated: expiryDate !== null,
    });
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (filterCategory === 'all') return true;
    if (filterCategory === 'expiring') return item.freshness === 'expiring' || item.freshness === 'use_soon';
    return item.category === filterCategory;
  });

  const expiringCount = items.filter((i) => i.freshness === 'expiring' || i.freshness === 'use_soon').length;
  const vegCount = items.filter((i) => i.category === 'vegetable').length;

  const categories = [
    { id: 'all', label: `Tất cả (${items.length})` },
    { id: 'expiring', label: `Sắp hết (${expiringCount})` },
    { id: 'vegetable', label: `Rau củ (${vegCount})` },
    { id: 'meat', label: 'Thịt' },
    { id: 'egg', label: 'Trứng' },
    { id: 'dairy', label: 'Sữa/Bơ' },
    { id: 'spice', label: 'Gia vị' },
    { id: 'seafood', label: 'Hải sản' },
  ];

  return (
    <div className="min-h-screen bg-takosan-cream pb-36 relative">
      <TopBar />

      <div className="px-4 pt-3 space-y-4 animate-fade-in">
        {/* Title & Add Action */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-2xl text-slate-900 tracking-tight">
              Tủ lạnh của tôi
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              <span className="inline-flex items-center gap-1 text-takosan-green font-bold">
                🧊 {items.length} nguyên liệu
              </span>{' '}
              sẵn sàng nấu
            </p>
          </div>
        </div>

        {/* T13: entry point to the reconciliation surface for evidence that
            needs a human decision. */}
        <button
          type="button"
          onClick={() => navigate('/inventory-reconciliation')}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-card text-left tap-target cursor-pointer hover:border-takosan-green/40 transition-tap"
        >
          <span className="text-xs font-semibold text-slate-700">Đối chiếu tủ lạnh</span>
          <span className="text-[11px] text-takosan-green font-bold">Xem bằng chứng →</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên nguyên liệu..."
            className="w-full min-w-0 h-12 pl-11 pr-4 bg-white rounded-2xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-card transition-tap"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(c.id)}
              className={clsx(
                'px-4 py-2 rounded-full text-xs font-heading font-bold whitespace-nowrap transition-tap tap-target cursor-pointer',
                filterCategory === c.id
                  ? 'bg-takosan-green text-white shadow-card scale-105'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Inventory Item List */}
        <div className="space-y-2 pt-1">
          {mutationError && (
            <div className="text-xs text-rose-600 font-medium px-1 space-y-1" role="alert"
              data-refetch-state={refetchFailed ? 'failed' : 'ok'}>
              <p>{mutationError}</p>
              {refetchFailed && (
                <button type="button" className="underline font-semibold tap-target" disabled={inventoryQuery.isFetching}
                  onClick={async () => {
                    // Explicit read-only reload; the failed mutation is never retried here.
                    const reloaded = await inventoryQuery.refetch({ throwOnError: false });
                    if (reloaded.status === 'success') { setRefetchFailed(false); setMutationError(null); }
                  }}>
                  {inventoryQuery.isFetching ? 'Đang tải lại…' : 'Tải lại tủ lạnh'}
                </button>
              )}
            </div>
          )}
          {loading ? (
            <InlineLoading label="Đang tải tủ lạnh…" />
          ) : inventoryQuery.isError && inventoryQuery.data === undefined ? (
            <InlineError error={inventoryQuery.error} onRetry={() => inventoryQuery.refetch()} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              type="empty-fridge"
              title="Tủ lạnh đang trống"
              description="Hãy bấm quét ảnh tủ lạnh bằng AI hoặc thêm thủ công nguyên liệu bạn vừa mua nhé."
              actionText="Chụp tủ lạnh ngay"
              onAction={() => navigate('/scan')}
            />
          ) : (
            // Add/remove animate by stable server identity; reduced motion
            // makes the change instant via MotionConfig (layout/motion spec).
            <AnimatePresence initial={false}>
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.easing.standard }}
                >
                  <IngredientRow
                    id={item.id}
                    name={item.name}
                    quantity={item.quantity}
                    unit={item.unit}
                    category={item.category}
                    storage={item.storage}
                    freshness={item.freshness}
                    ingredientId={item.ingredientId}
                    expiryDate={item.expiryDate}
                    expiryKind={item.expiryKind}
                    estimatedExpiryDate={item.estimatedExpiryDate}
                    onClick={() => navigate(`/ingredients/${item.id}`)}
                    onUpdateQuantity={(delta) => handleUpdateQty(item.id, item.quantity, delta, item.version)}
                    onDelete={() => setPendingDelete({ id: item.id, version: item.version })}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Sticky Bottom Floating CTA */}
      <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full py-4 px-4 rounded-2xl bg-takosan-green hover:bg-takosan-green-hover text-white font-heading font-bold text-[15px] shadow-float active:scale-98 transition-tap pointer-events-auto flex items-center justify-center gap-2 tap-target"
        >
          <Plus className="w-5.5 h-5.5 stroke-[2.5]" />
          <span>Thêm nguyên liệu</span>
        </button>
      </div>

      {/* Manual Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/80 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">
                Thêm nguyên liệu vào tủ
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 tap-target flex items-center justify-center transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên nguyên liệu
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Thịt ba chỉ, Trứng gà, Cà chua..."
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green font-medium text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số lượng
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green font-medium text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đơn vị
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as StandardUnit)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green font-medium text-sm text-slate-900 bg-white"
                  >
                    <option value="g">gam (g)</option>
                    <option value="kg">kg</option>
                    <option value="piece">quả / củ / bìa / miếng</option>
                    <option value="bunch">bó</option>
                    <option value="pack">gói / hộp</option>
                    <option value="ml">ml</option>
                    <option value="l">lít</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phân loại
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green font-medium text-sm text-slate-900 bg-white"
                  >
                    <option value="vegetable">Rau củ</option>
                    <option value="meat">Thịt</option>
                    <option value="egg">Trứng</option>
                    <option value="seafood">Hải sản</option>
                    <option value="dairy">Sữa / Bơ</option>
                    <option value="spice">Gia vị</option>
                    <option value="grain">Gạo / Mì</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bảo quản
                  </label>
                  <select
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green font-medium text-sm text-slate-900 bg-white"
                  >
                    <option value="fridge">Ngăn mát</option>
                    <option value="freezer">Ngăn đông</option>
                    <option value="pantry">Tủ đồ khô</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hạn sử dụng dự kiến
                </label>
                <div className="flex gap-2">
                  {[
                    { days: 0, label: 'Chưa rõ' },
                    { days: 2, label: '2 ngày' },
                    { days: 5, label: '5 ngày' },
                    { days: 10, label: '10 ngày' },
                    { days: 30, label: '1 tháng' },
                  ].map((d) => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setExpiryDays(d.days)}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-medium border transition-tap tap-target cursor-pointer',
                        expiryDays === d.days
                          ? 'bg-takosan-mint border-takosan-green text-takosan-green-deep font-semibold'
                          : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button fullWidth size="lg" type="submit">
                  Lưu vào tủ lạnh
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Xóa nguyên liệu?"
        description="Nguyên liệu này sẽ bị xóa khỏi tủ lạnh của bạn."
        confirmText="Xóa"
        destructive
        onConfirm={() => {
          if (pendingDelete) {
            setMutationError(null);
            setRefetchFailed(false);
            deleteItem.mutate(pendingDelete);
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

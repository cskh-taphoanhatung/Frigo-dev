import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { TopBar } from '../components/common/TopBar';
import { StatusChip } from '../components/common/StatusChip';
import { Button } from '../components/common/Button';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { api, ApiError } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { presentDomainError, presentExpiry, presentOpenedState, presentPurchaseDate, presentRefetchOutcome, provenanceLabel } from '../lib/inventory-truth';
import { ALL_RECIPES } from '@frigo/recipes';
import { getIngredientImage } from '../lib/ingredient-images';
import { Clock, ChefHat, Calendar, Layers, ArrowRight, PackageOpen, Receipt } from 'lucide-react';
import { clsx } from 'clsx';
import { resolveRecipeImage, recipeImageErrorHandler } from '../lib/recipe-media';

const EXPIRY_TONE_CLASS: Record<string, string> = {
  unknown: 'bg-slate-100 text-slate-700 border-slate-200',
  expired: 'bg-rose-50 text-rose-800 border-rose-200',
  expiring: 'bg-amber-50 text-amber-900 border-amber-200',
  estimated: 'bg-sky-50 text-sky-900 border-sky-200',
  fresh: 'bg-takosan-mint text-takosan-green-deep border-takosan-mint-deep',
};

const STORAGE_LABEL: Record<string, string> = {
  fridge: 'Ngăn mát tủ lạnh', freezer: 'Ngăn đông đá', pantry: 'Tủ đồ khô',
};

const CATEGORY_LABEL: Record<string, string> = {
  vegetable: 'Rau củ', meat: 'Thịt', egg: 'Trứng', seafood: 'Hải sản',
  dairy: 'Sữa / Bơ', spice: 'Gia vị', grain: 'Gạo / Mì', other: 'Khác',
};

type EditDraft = { name: string; unit: string; category: string; storage: string; expiryDate: string };
const EMPTY_DRAFT: EditDraft = { name: '', unit: '', category: '', storage: '', expiryDate: '' };

/** The lot an edit draft was opened for. A draft is never submitted elsewhere. */
type DraftOwner = { routeId: string; itemId: string };

export const IngredientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // T13R-A P1-3: the route's lot id keys the detail so every draft, baseline
  // and error state is discarded on a same-component route change. A chicken
  // draft cannot survive into the tofu view, let alone be saved there.
  return <LotDetail key={id ?? ''} routeId={id ?? ''} />;
};

const LotDetail: React.FC<{ routeId: string }> = ({ routeId }) => {
  const id = routeId || undefined;
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(EMPTY_DRAFT);
  const [editBaseline, setEditBaseline] = useState<EditDraft>(EMPTY_DRAFT);
  const [draftOwner, setDraftOwner] = useState<DraftOwner | null>(null);
  // True while the authoritative reload after a conflict has not succeeded.
  const [refetchFailed, setRefetchFailed] = useState(false);

  // Adopted households read canonical lot truth; the legacy projection is
  // never the source for provenance or expiry semantics.
  const lotQuery = useQuery({
    queryKey: queryKeys.inventoryLot(id ?? ''),
    queryFn: () => api.getInventoryLot(id as string),
    enabled: Boolean(id),
    retry: false,
  });

  const legacyQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
    // Only needed when the household has no lot authority yet.
    enabled: Boolean(id) && lotQuery.isError,
  });

  const lot = lotQuery.data ?? null;
  const legacyItem = lot ? null : (legacyQuery.data ?? []).find((entry: any) => entry.id === id) ?? null;
  const item: any = lot ?? legacyItem;

  const mutate = useMutation({
    retry: false,
    // The target is fixed at submit time from the verified draft owner, not
    // re-read from whatever the component happens to display later.
    mutationFn: async ({ target, updates }: { target: { id: string; version: number }; updates: Record<string, unknown> }) =>
      api.updateInventoryItem(target.id, updates, target.version),
    onSuccess: async () => {
      setActionError(null);
      setEditing(false);
      setDraftOwner(null);
      await invalidateInventoryDependents();
      await lotQuery.refetch();
    },
    onError: async (error: unknown) => {
      const code = error instanceof ApiError ? error.code : null;
      const presentation = presentDomainError(code, 'Chưa cập nhật được nguyên liệu. Vui lòng thử lại.');
      if (!presentation.refetch) {
        setActionError(presentation.message);
        return;
      }
      // T13R-B P2-4: a stale/conflict state is only recoverable after the
      // authoritative lot is actually reloaded. React Query swallows refetch
      // failures by default, so the outcome is checked explicitly and the
      // copy never claims "latest state loaded" unless it is. The mutation is
      // never resubmitted here; the user re-saves against the fresh version.
      setActionError(presentation.message);
      await invalidateInventoryDependents();
      const reloaded = await lotQuery.refetch({ throwOnError: false });
      const refreshed = reloaded.status === 'success';
      setRefetchFailed(!refreshed);
      setActionError(presentRefetchOutcome(presentation, refreshed).message);
    },
  });

  if (lotQuery.isPending && !legacyItem) {
    return (
      <div className="min-h-screen bg-takosan-cream">
        <TopBar showBack title="Chi tiết nguyên liệu" />
        <div className="p-6"><InlineLoading label="Đang tải nguyên liệu…" /></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-takosan-cream">
        <TopBar showBack title="Chi tiết nguyên liệu" />
        <div className="p-6 text-center">
          {legacyQuery.isError ? (
            <InlineError error={legacyQuery.error} onRetry={() => void legacyQuery.refetch()} />
          ) : (
            <p className="text-xs text-slate-500">Không tìm thấy nguyên liệu này trong tủ.</p>
          )}
          <Button className="mt-4" onClick={() => navigate('/fridge')}>Về tủ lạnh</Button>
        </div>
      </div>
    );
  }

  const expiry = presentExpiry(item);
  const status = item.freshness === 'out_of_stock' ? 'out_of_stock'
    : expiry.tone === 'unknown' ? 'unknown'
      : expiry.tone === 'estimated' ? 'estimated' : item.freshness;
  const matchingRecipes = ALL_RECIPES.filter((recipe) =>
    recipe.ingredients.some((ingredient) =>
      ingredient.ingredientId === item.ingredientId
      || ingredient.name.toLowerCase() === String(item.name).toLowerCase()));

  const startEdit = () => {
    setActionError(null);
    setRefetchFailed(false);
    const initialDraft = {
      name: item.name, unit: item.unit, category: item.category ?? 'other',
      storage: item.storage ?? 'fridge', expiryDate: expiry.date ?? '',
    };
    setDraft(initialDraft);
    setEditBaseline(initialDraft);
    setDraftOwner({ routeId, itemId: String(item.id) });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftOwner(null);
  };

  const submitDraft = () => {
    // Draft owner == current route == current authoritative item, or no
    // mutation at all. Any mismatch means the draft belongs to another lot.
    if (!draftOwner || draftOwner.routeId !== routeId || String(item.id) !== draftOwner.itemId) {
      setEditing(false);
      setDraftOwner(null);
      setDraft(EMPTY_DRAFT);
      setEditBaseline(EMPTY_DRAFT);
      setActionError('Bản chỉnh sửa thuộc nguyên liệu khác nên chưa được lưu. Vui lòng mở lại và sửa trên nguyên liệu này.');
      return;
    }
    const updates: Record<string, unknown> = {};
    // Refetches must not turn untouched draft fields into corrections.
    if (draft.name.trim() !== editBaseline.name.trim()) updates.name = draft.name.trim();
    if (draft.unit !== editBaseline.unit) updates.unit = draft.unit;
    if (draft.category !== editBaseline.category) updates.category = draft.category;
    if (draft.expiryDate !== editBaseline.expiryDate) {
      updates.expiryDate = draft.expiryDate || null;
      // The date picker is an explicit dated fact, so the correction
      // establishes KNOWN expiry rather than another estimate.
      updates.expiryEstimated = false;
    }
    if (draft.storage !== editBaseline.storage) updates.storage = draft.storage;
    if (Object.keys(updates).length === 0) { cancelEdit(); return; }
    mutate.mutate({ target: { id: String(item.id), version: Number(item.version) }, updates });
  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-12">
      <TopBar showBack title={item.name} subtitle="Thông tin nguyên liệu" />

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-xl p-4 flex items-center gap-4 border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 overflow-hidden shrink-0">
            <img src={getIngredientImage(item.ingredientId, item.name)} alt={item.name} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-heading font-bold text-xl text-slate-900 leading-tight">{item.name}</h3>
              <StatusChip status={status} />
            </div>
            <p className="text-sm font-semibold text-takosan-green">{item.quantity} {item.unit}</p>
          </div>
        </div>

        {actionError && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 font-medium space-y-2" role="alert"
            data-refetch-state={refetchFailed ? 'failed' : 'ok'}>
            <p>{actionError}</p>
            {refetchFailed && (
              <button type="button" className="underline font-semibold tap-target" disabled={lotQuery.isFetching}
                onClick={async () => {
                  // Explicit read-only reload; still no mutation retry.
                  const reloaded = await lotQuery.refetch({ throwOnError: false });
                  if (reloaded.status === 'success') { setRefetchFailed(false); setActionError(null); }
                }}>
                {lotQuery.isFetching ? 'Đang tải lại…' : 'Tải lại trạng thái mới nhất'}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <Layers className="w-4 h-4 text-takosan-green" />
              <span className="text-[11px] font-semibold">Vị trí</span>
            </div>
            <p className="font-heading font-semibold text-sm text-slate-900">
              {STORAGE_LABEL[item.storage] ?? 'Ngăn mát tủ lạnh'}
            </p>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <Calendar className="w-4 h-4 text-takosan-green" />
              <span className="text-[11px] font-semibold">Hạn sử dụng</span>
            </div>
            <p className={clsx('font-heading font-semibold text-xs px-2 py-1 rounded-lg border inline-block',
              EXPIRY_TONE_CLASS[expiry.tone])} data-testid="lot-expiry">
              {expiry.label}
            </p>
          </div>
        </div>

        {lot && (
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Receipt className="w-4 h-4 text-takosan-green" />
              <span className="text-[11px] font-semibold">Nguồn gốc &amp; lô</span>
            </div>
            <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-slate-500">Nguồn</dt>
              <dd className="text-slate-900 font-semibold text-right" data-testid="lot-provenance">
                {provenanceLabel(lot.dataSource)}
              </dd>
              <dt className="text-slate-500">Ngày mua</dt>
              <dd className="text-slate-900 font-semibold text-right">{presentPurchaseDate(lot.purchasedAt)}</dd>
              <dt className="text-slate-500">Trạng thái mở</dt>
              <dd className="text-slate-900 font-semibold text-right" data-testid="lot-opened">{presentOpenedState(lot.openedAt)}</dd>
              <dt className="text-slate-500">Mã lô</dt>
              <dd className="text-slate-900 font-mono text-[10px] text-right break-all">{lot.lotId}</dd>
              <dt className="text-slate-500">Phiên bản lô</dt>
              <dd className="text-slate-900 font-semibold text-right">v{lot.lotVersion}</dd>
            </dl>
          </div>
        )}

        {!editing ? (
          <Button fullWidth variant="outline" onClick={startEdit} className="flex items-center justify-center gap-2">
            <PackageOpen className="w-4 h-4 text-takosan-green" />
            <span>Sửa thông tin nguyên liệu</span>
          </Button>
        ) : (
          <form
            className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3"
            data-draft-owner={draftOwner?.itemId ?? ''}
            onSubmit={(event) => {
              event.preventDefault();
              submitDraft();
            }}
          >
            <div>
              <label htmlFor="lot-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Tên nguyên liệu
              </label>
              <input
                id="lot-name-input"
                required
                maxLength={100}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-slate-200/80 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lot-unit-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn vị
                </label>
                <select
                  id="lot-unit-input"
                  value={draft.unit}
                  onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200/80 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green"
                >
                  <option value="g">gam (g)</option>
                  <option value="kg">kg</option>
                  <option value="piece">quả / củ / bìa / miếng</option>
                  <option value="bunch">bó</option>
                  <option value="pack">gói / hộp</option>
                  <option value="slice">lát</option>
                  <option value="ml">ml</option>
                  <option value="l">lít</option>
                </select>
              </div>
              <div>
                <label htmlFor="lot-category-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Danh mục
                </label>
                <select
                  id="lot-category-input"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200/80 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green"
                >
                  {!Object.hasOwn(CATEGORY_LABEL, editBaseline.category) && <option value={editBaseline.category}>{editBaseline.category}</option>}
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="lot-expiry-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Hạn sử dụng chính xác
              </label>
              <input
                id="lot-expiry-input"
                type="date"
                value={draft.expiryDate}
                onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-slate-200/80 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Ngày bạn chọn được lưu là hạn dùng đã biết chắc chắn.
              </p>
            </div>
            <div>
              <label htmlFor="lot-storage-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Chuyển vị trí bảo quản
              </label>
              <select
                id="lot-storage-input"
                value={draft.storage}
                onChange={(event) => setDraft({ ...draft, storage: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-slate-200/80 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green"
              >
                <option value="fridge">Ngăn mát</option>
                <option value="freezer">Ngăn đông</option>
                <option value="pantry">Tủ đồ khô</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" fullWidth disabled={mutate.isPending || !draft.name.trim()}>
                {mutate.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit}>Hủy</Button>
            </div>
          </form>
        )}

        <div className="pt-2">
          <h4 className="font-heading font-bold text-base text-slate-900 flex items-center gap-1.5 mb-3">
            <ChefHat className="w-4 h-4 text-takosan-green" />
            <span>Món ngon có thể nấu ({matchingRecipes.length})</span>
          </h4>

          <div className="space-y-2.5">
            {matchingRecipes.map((recipe) => (
              <div
                key={recipe.id}
                onClick={() => navigate(`/recipes/${recipe.slug}`)}
                className="bg-white rounded-xl p-3 flex items-center gap-3.5 border border-slate-200/80 shadow-xs cursor-pointer hover:border-takosan-green/40 active:scale-[0.99] transition-tap"
              >
                <img src={resolveRecipeImage(recipe).src} alt={recipe.title} className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-100" loading="lazy" onError={recipeImageErrorHandler(resolveRecipeImage(recipe).fallbackSrc)} />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/60 uppercase">
                    {recipe.cuisine}
                  </span>
                  <h5 className="font-heading font-semibold text-sm text-slate-900 truncate mt-1">{recipe.title}</h5>
                  <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{recipe.cookTimeMinutes} phút</span>
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

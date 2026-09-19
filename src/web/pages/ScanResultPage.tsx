import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useScanStore } from '../stores/useScanStore';
import { api } from '../services/api';
import { TopBar } from '../components/common/TopBar';
import { Button } from '../components/common/Button';
import { getIngredientImage } from '../lib/ingredient-images';
import { Plus, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { StandardUnit } from '@frigo/domain';
import { capturePrivateSession } from '../lib/private-session';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { presentConfidence, presentDomainError, presentRefetchOutcome } from '../lib/inventory-truth';
import { ApiError } from '../services/http';
import { ScanProcessingState } from '../components/scan/ScanProcessingState';

const UNITS: StandardUnit[] = ['piece', 'g', 'kg', 'ml', 'l', 'pack', 'bunch', 'slice'];
const fieldClass = 'mt-1 w-full min-w-0 h-11 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:border-takosan-green focus:outline-none';
const confidenceClass = {
  unknown: 'text-slate-600 bg-slate-100',
  low: 'text-amber-900 bg-amber-100',
  medium: 'text-amber-800 bg-amber-50',
  high: 'text-takosan-green-deep bg-takosan-mint',
};

function scanErrorText(code?: string, _detail?: string): string {
  if (code === 'AI_SCAN_NO_USABLE_ITEMS') {
    return 'Ảnh chưa đủ rõ để nhận diện món ăn. Hãy chụp gần hơn, đủ sáng và không bị lóa.';
  }
  if (code === 'AI_SCAN_TIMEOUT' || code === 'REQUEST_TIMEOUT') {
    return 'Dịch vụ nhận diện phản hồi quá lâu. Hãy thử lại với ảnh nhỏ và rõ hơn.';
  }
  if (code === 'AI_SCAN_UNAVAILABLE' || code === 'MODEL_NOT_FOUND' || code === 'AUTHENTICATION_FAILED' ||
    code === 'PERMISSION_DENIED' || code === 'LICENSE_REQUIRED') {
    return 'Dịch vụ nhận diện đang tạm thời không khả dụng. Hãy thử lại hoặc nhập thủ công.';
  }
  if (code === 'NETWORK_ERROR' || code === 'RATE_LIMITED' || code === 'UPSTREAM_ERROR') {
    return 'Dịch vụ nhận diện đang bận hoặc mất kết nối. Vui lòng thử lại sau ít phút.';
  }
  if (code === 'INVALID_RESPONSE' || code === 'SCHEMA_VALIDATION') {
    return 'Ảnh chưa đủ rõ để nhận diện món ăn. Hãy chụp gần hơn, đủ sáng và không bị lóa.';
  }
  if (code === 'IMAGE_NOT_FOUND' || code === 'IMAGE_UNAVAILABLE') {
    return 'Ảnh quét không còn khả dụng. Hãy chọn và tải lên ảnh mới.';
  }
  return 'Không thể xử lý bản quét. Hãy thử lại với ảnh rõ hơn.';
}

export const ScanResultPage: React.FC = () => {
  const { id: paramScanId } = useParams<{ id: string }>();
  const scanId = useScanStore((state) => state.scanId);
  const targetScanId = paramScanId || scanId || '';
  return <ScanReview key={targetScanId} effectiveScanId={targetScanId} />;
};

const ScanReview: React.FC<{ effectiveScanId: string }> = ({ effectiveScanId }) => {
  const navigate = useNavigate();
  const { scanId, reviewStatus, items: storedItems, updateItem, addItem, removeItem, reset } = useScanStore();
  // A route change must hide the previous scan before hydration's first effect.
  const matchesScan = scanId === effectiveScanId;
  const items = matchesScan ? storedItems : [];
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addUnit, setAddUnit] = useState<StandardUnit>('piece');
  const [pollError, setPollError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'pending' | 'ready' | 'confirmed' | 'failed'>(
    !effectiveScanId ? 'failed'
      : matchesScan && reviewStatus ? reviewStatus
        : items.length > 0 || (matchesScan && effectiveScanId.startsWith('scan_offline_')) ? 'ready' : 'pending'
  );
  const [loadError, setLoadError] = useState<string | null>(
    effectiveScanId ? null : 'Không tìm thấy bản quét. Vui lòng quay lại và quét ảnh mới.'
  );
  const [retryIndex, setRetryIndex] = useState(0);
  const canEdit = matchesScan && scanStatus === 'ready' && !isConfirming;
  const isConfirmed = matchesScan && scanStatus === 'confirmed';
  const acceptedCount = items.filter((item) => !item.rejected).length;

  useEffect(() => {
    if (!effectiveScanId || scanStatus !== 'pending') return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const isCurrent = capturePrivateSession();
    const active = () => !cancelled && isCurrent();
    const poll = async () => {
      if (!active()) return;
      try {
        const scan = await api.getScan(effectiveScanId);
        if (!active()) return;
        if (scan.id !== effectiveScanId) {
          setScanStatus('failed');
          setLoadError('Dữ liệu trả về không khớp với bản quét đang mở. Vui lòng tải lại.');
          return;
        }
        setPollError(null);
        if (scan.status === 'ready' || scan.status === 'confirmed') {
          setScanStatus(scan.status);
          if (!active()) return;
          useScanStore.getState().setScanResults(effectiveScanId, scan.items || [], scan.status);
          return;
        }
        if (scan.status === 'failed') {
          setScanStatus('failed');
          setPollError(scanErrorText(scan.errorCode, scan.errorMessage));
          return;
        }
      } catch {
        if (!active()) return;
        setPollError('Không thể cập nhật trạng thái bản quét. Kiểm tra kết nối rồi thử lại.');
      }
      attempts += 1;
      if (active() && attempts < 45) {
        timer = window.setTimeout(poll, 2000);
      } else if (active()) {
        setPollError('Bản quét đang xử lý lâu hơn dự kiến. Bạn có thể kiểm tra lại hoặc chọn ảnh mới.');
      }
    };
    timer = window.setTimeout(poll, 500);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [effectiveScanId, scanStatus, retryIndex]);

  const handleEstimateExpiry = (id: string, days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const expiryDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    updateItem(id, { expiryDate, expiryEstimated: true });
  };

  const handleConfirm = async () => {
    if (items.length === 0 || !canEdit || useScanStore.getState().scanId !== effectiveScanId) return;
    const isCurrent = capturePrivateSession();
    const active = () => mounted.current && isCurrent()
      && useScanStore.getState().scanId === effectiveScanId;
    if (!active()) return;
    setConfirmError(null);
    setIsConfirming(true);
    try {
      await api.confirmScan(effectiveScanId, items);
      if (!active()) return;
      void invalidateInventoryDependents();
      if (!active()) return;
      reset();
      navigate('/fridge');
    } catch (error) {
      if (!active()) return;
      const presentation = presentDomainError(error instanceof ApiError ? error.code : null,
        'Chưa lưu được nguyên liệu. Vui lòng thử lại.');
      if (presentation.refetch) {
        try {
          const scan = await api.getScan(effectiveScanId);
          if (!active()) return;
          if (scan.id !== effectiveScanId) throw new Error('Mismatched scan response');
          // Conflicts invalidate local edits; review authoritative evidence again.
          setScanStatus(scan.status === 'ready' || scan.status === 'confirmed' ? scan.status : 'failed');
          if (!active()) return;
          useScanStore.getState().setScanResults(effectiveScanId, scan.items || [],
            scan.status === 'ready' || scan.status === 'confirmed' ? scan.status : null);
          if (!active()) return;
          void invalidateInventoryDependents();
        } catch {
          if (!active()) return;
          setScanStatus('failed');
          if (!active()) return;
          setLoadError('Thông tin đã thay đổi nhưng chưa tải lại được. Vui lòng tải lại trước khi thử xác nhận.');
          if (!active()) return;
          setIsConfirming(false);
          return;
        }
      }
      if (!active()) return;
      setConfirmError(presentRefetchOutcome(presentation, presentation.refetch ? true : null).message);
      if (!active()) return;
      setIsConfirming(false);
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !canEdit) return;
    addItem({
      rawName: addName.trim(),
      estimatedQuantity: Number(addQty),
      unit: addUnit,
      storage: 'fridge',
    });
    setAddName('');
    setAddQty(1);
    setIsManualAddOpen(false);
  };

  return (
    <div className="min-h-screen bg-takosan-cream pb-28">
      <TopBar showBack title="Kết quả nhận diện AI"
        subtitle={isConfirmed ? 'Bản quét đã xác nhận · Chỉ xem' : 'Kiểm tra & chỉnh sửa trước khi xác nhận'} />

      <div className="px-4 pt-3 space-y-4">
        {scanStatus === 'pending' && <ScanProcessingState stage="analyzing" kind="fridge" compact />}
        {confirmError && <p role="alert" className="text-sm text-red-700">{confirmError}</p>}
        {loadError && <p role="alert" className="text-sm text-red-700">
          {loadError}
          {effectiveScanId && <button className="ml-2 underline tap-target" onClick={() => {
            setLoadError(null);
            setScanStatus('pending');
            setRetryIndex((value) => value + 1);
          }}>Thử tải lại</button>}
        </p>}
        {/* Banner Alert */}
        <div className={scanStatus === 'failed'
          ? 'bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3'
          : 'bg-takosan-mint/80 border border-takosan-mint-deep/70 rounded-xl p-3.5 flex items-start gap-3'}
          role={isConfirmed ? 'status' : undefined}>
          {scanStatus === 'failed'
            ? <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-5 h-5 text-takosan-green shrink-0 mt-0.5" />}
          <div className="text-xs">
            <p className="font-heading font-bold text-sm text-slate-900">
              {isConfirmed
                ? `Đã xác nhận ${acceptedCount} nguyên liệu`
                : items.length > 0
                ? `${items.length} nguyên liệu cần kiểm tra`
                : scanStatus === 'failed'
                  ? 'Bản quét không thể xử lý'
                  : scanStatus === 'ready'
                    ? 'Chưa có nguyên liệu trong danh sách'
                    : 'Đang chờ AI hoàn tất bản quét'}
            </p>
            <p className="text-slate-600 mt-0.5">
              {isConfirmed
                ? 'Thông tin bản quét đã được lưu. Bạn có thể xem hoặc chỉnh sửa lô từ trang tủ lạnh.'
                : items.length > 0
                ? 'Sửa tên, số lượng, đơn vị, nơi bảo quản, hạn dùng hoặc từ chối từng dòng trước khi lưu.'
                : scanStatus === 'failed'
                  ? 'Vui lòng quay lại và thử lại với ảnh khác.'
                  : scanStatus === 'ready'
                    ? 'Bạn có thể thêm nguyên liệu thủ công trước khi xác nhận.'
                    : 'Kết quả sẽ tự động xuất hiện khi queue xử lý xong.'}
            </p>
          </div>
        </div>
        {pollError && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center justify-between gap-3">
            <span>{pollError}</span>
            <div className="flex items-center gap-2 shrink-0">
              {scanStatus === 'pending' && (
                <button className="underline font-semibold" onClick={() => { setPollError(null); setRetryIndex((value) => value + 1); }}>
                  Kiểm tra lại
                </button>
              )}
              {scanStatus === 'failed' && (
                <button className="underline font-semibold" onClick={() => { reset(); navigate('/scan'); }}>
                  Quét ảnh mới
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detected Items List */}
        <p className="text-xs text-slate-600">
          Bản quét tủ lạnh bổ sung số lượng vào nguyên liệu phù hợp đã có; không đổi nơi bảo quản hay hạn dùng của lô cũ.
        </p>
        <form id="scan-review" className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          void handleConfirm();
        }}>
          {items.map((item, index) => {
            const confidence = presentConfidence(item.confidence);
            const persisted = item.sourceItemId !== undefined;
            const raw = item.rawEvidence;
            const corrected = raw && (
              (raw.rawName != null && raw.rawName !== item.rawName)
              || (raw.estimatedQuantity != null && raw.estimatedQuantity !== item.estimatedQuantity)
              || (raw.unit != null && raw.unit !== item.unit)
            );
            return (
              <article key={item.id} data-scan-item-id={item.id} aria-label={`Nguyên liệu ${index + 1}`}
                className={`rounded-xl p-3 border shadow-xs ${item.rejected ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200/80'}`}>
                <div className="flex items-start gap-3">
                  <img src={getIngredientImage(item.canonicalId ?? undefined, item.rawName)} alt=""
                    className="w-10 h-10 object-contain shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading font-semibold text-sm text-slate-900 break-words">{item.rawName}</h2>
                    {persisted ? (
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-semibold ${confidenceClass[confidence.tone]}`}>
                        {confidence.label}
                      </span>
                    ) : <span className="text-xs text-slate-600">Nhập thủ công</span>}
                    {persisted && (
                      <p className="text-xs text-slate-600 mt-1 break-words" data-raw-evidence>
                        AI đọc: {raw
                          ? `${raw.rawName ?? 'Không rõ tên'} · ${raw.estimatedQuantity ?? 'Không rõ số lượng'} ${raw.unit ?? 'Không rõ đơn vị'}`
                          : 'Không có dữ liệu gốc'}
                      </p>
                    )}
                    {corrected && <p className="text-xs text-amber-800 mt-1">Đã chỉnh sửa so với dữ liệu gốc</p>}
                    {item.rejected && <p className="text-xs font-semibold text-rose-800 mt-1">Đã từ chối · Không thêm vào tủ lạnh</p>}
                  </div>
                  <button type="button" disabled={!canEdit}
                    onClick={() => persisted ? updateItem(item.id, { rejected: !item.rejected }) : removeItem(item.id)}
                    aria-pressed={persisted ? Boolean(item.rejected) : undefined}
                    className="p-2 rounded-lg text-rose-700 hover:bg-rose-100 tap-target shrink-0 text-xs font-semibold"
                    aria-label={persisted ? (item.rejected ? 'Khôi phục dòng này' : 'Từ chối dòng này') : 'Xóa dòng thủ công'}>
                    {persisted ? (item.rejected ? 'Khôi phục' : 'Từ chối') : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
                <fieldset disabled={!canEdit} className="mt-3 grid grid-cols-2 gap-3 min-w-0">
                  <label className="col-span-2 text-xs font-semibold text-slate-700">
                    Tên nguyên liệu
                    <input className={fieldClass} value={item.rawName} required pattern=".*\S.*"
                      onChange={(event) => updateItem(item.id, { rawName: event.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Số lượng
                    <input className={fieldClass} type="number" min="0.001" max="10000" step="any" required
                      value={item.estimatedQuantity || ''}
                      onChange={(event) => updateItem(item.id, { estimatedQuantity: Number(event.target.value) })} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Đơn vị
                    <select className={fieldClass} value={item.unit}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value as StandardUnit })}>
                      {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Bảo quản
                    <select className={fieldClass} value={item.storage}
                      onChange={(event) => updateItem(item.id, { storage: event.target.value as typeof item.storage })}>
                      <option value="fridge">Ngăn mát</option>
                      <option value="freezer">Ngăn đông</option>
                      <option value="pantry">Kệ bếp</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Hạn dùng
                    <input className={`${fieldClass} px-1`} type="date" value={item.expiryDate ?? ''}
                      onChange={(event) => updateItem(item.id, {
                        expiryDate: event.target.value || undefined, expiryEstimated: false,
                      })} />
                  </label>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-600" data-expiry-state>
                      {isConfirmed
                        // A confirmed line reports the review the server recorded
                        // (T13R-A P2-B): the accepted date, its estimate basis, or
                        // an explicit "no expiry accepted" — never a fresh guess.
                        ? (item.rejected ? 'Đã bỏ qua: không có hạn dùng'
                          : !item.expiryDate ? 'Đã xác nhận không rõ hạn dùng'
                            : item.expiryEstimated ? 'Hạn dùng ước tính đã xác nhận' : 'Ngày do bạn xác nhận')
                        : (!item.expiryDate ? 'Chưa rõ hạn dùng' : item.expiryEstimated ? 'Hạn dùng ước tính' : 'Ngày do bạn xác nhận')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[3, 7].map((days) => (
                        <button key={days} type="button" className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 tap-target"
                          onClick={() => handleEstimateExpiry(item.id, days)}>Ước tính {days} ngày</button>
                      ))}
                      <button type="button" className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 tap-target"
                        onClick={() => updateItem(item.id, { expiryDate: undefined, expiryEstimated: false })}>Không rõ hạn dùng</button>
                    </div>
                  </div>
                </fieldset>
              </article>
            );
          })}
        </form>

        {/* Add Missing Item Button */}
        {!isConfirmed && <Button
          variant="outline"
          fullWidth
          size="md"
          disabled={!canEdit}
          onClick={() => setIsManualAddOpen(true)}
          className="flex items-center justify-center gap-1.5 text-xs text-slate-700"
        >
          <Plus className="w-4 h-4 text-takosan-green" />
          <span>Thêm nguyên liệu AI còn thiếu</span>
        </Button>}
      </div>

      {/* Fixed Confirm CTA Bar */}
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 md:left-20 lg:left-64 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-lg">
        {isConfirmed ? <Button fullWidth size="lg" onClick={() => navigate('/fridge')}>
          Xem tủ lạnh
        </Button> : <Button
          fullWidth
          size="lg"
          type="submit"
          form="scan-review"
          isLoading={isConfirming}
          disabled={items.length === 0 || !canEdit}
          className="flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>Xác nhận nguyên liệu ({acceptedCount} món)</span>
        </Button>}
      </div>

      {/* Manual Add Sheet */}
      {isManualAddOpen && canEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-end justify-center p-0 animate-fade-in">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-5 shadow-2xl border-t border-slate-200/80 animate-slide-up">
            {/* Grab bar */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">
                Thêm nguyên liệu thủ công
              </h3>
              <button
                onClick={() => setIsManualAddOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors tap-target flex items-center justify-center"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualItem} className="space-y-3.5">
              <div>
                <label htmlFor="scan-add-name" className="block text-xs font-semibold text-slate-700 mb-1.5">Tên nguyên liệu</label>
                <input
                  id="scan-add-name"
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Ví dụ: Nấm hương, Hành lá..."
                  className="w-full h-11 px-3 rounded-lg border border-slate-200/80 text-sm font-medium text-slate-900 bg-white focus:border-takosan-green focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="scan-add-quantity" className="block text-xs font-semibold text-slate-700 mb-1.5">Số lượng</label>
                  <input
                    id="scan-add-quantity"
                    type="number"
                    min="0.001"
                    max="10000"
                    step="any"
                    required
                    value={addQty}
                    onChange={(e) => setAddQty(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-lg border border-slate-200/80 text-sm font-medium text-slate-900 bg-white focus:border-takosan-green focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="scan-add-unit" className="block text-xs font-semibold text-slate-700 mb-1.5">Đơn vị</label>
                  <select
                    id="scan-add-unit"
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value as StandardUnit)}
                    className="w-full h-11 px-2.5 rounded-lg border border-slate-200/80 text-xs font-semibold text-slate-800 bg-white focus:border-takosan-green focus:outline-none transition-colors"
                  >
                    {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button fullWidth size="md" type="submit">
                  Thêm vào danh sách
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

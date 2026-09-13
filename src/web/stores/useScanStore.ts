import { create } from 'zustand';
import { StandardUnit } from '@frigo/domain';
import { onPrivateSessionReset } from '../lib/private-session';

export interface ScanDraftItem {
  id: string;
  sourceItemId?: string;
  rawName: string;
  canonicalId?: string | null;
  estimatedQuantity: number;
  unit: StandardUnit;
  confidence?: number | null;
  storage: 'fridge' | 'freezer' | 'pantry';
  expiryDate?: string;
  expiryEstimated?: boolean;
  rejected?: boolean;
  reviewState?: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  rawEvidence?: Readonly<{
    rawName?: string | null;
    estimatedQuantity?: number | null;
    unit?: string | null;
  }>;
}

type ScanItemEdits = Pick<ScanDraftItem,
  'rawName' | 'estimatedQuantity' | 'unit' | 'storage' | 'expiryDate' | 'expiryEstimated' | 'rejected'>;

interface ScanState {
  imagePreviewUrl: string | null;
  imageBase64: string | null;
  scanType: 'fridge' | 'food' | 'receipt';
  isProcessing: boolean;
  statusText: string;
  scanId: string | null;
  items: ScanDraftItem[];
  setImage: (url: string, base64?: string) => void;
  setScanType: (type: 'fridge' | 'food' | 'receipt') => void;
  setProcessing: (processing: boolean, status?: string) => void;
  setScanResults: (scanId: string, items: ScanDraftItem[]) => void;
  updateItem: (id: string, updates: Partial<ScanItemEdits>) => void;
  addItem: (item: Omit<ScanItemEdits, 'rejected'>) => void;
  removeItem: (id: string) => void;
  reset: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  imagePreviewUrl: null,
  imageBase64: null,
  scanType: 'fridge',
  isProcessing: false,
  statusText: '',
  scanId: null,
  items: [],

  setImage: (url, base64) => set({ imagePreviewUrl: url, imageBase64: base64 || null }),
  setScanType: (type) => set({ scanType: type }),
  setProcessing: (isProcessing, statusText = '') => set({ isProcessing, statusText }),
  setScanResults: (scanId, items) => set({
    scanId,
    items: items.map((item) => ({
      ...item,
      // Server membership, not an ID prefix, distinguishes predictions from local drafts.
      sourceItemId: item.id,
      rejected: item.rejected ?? item.reviewState === 'REJECTED',
      rawEvidence: item.rawEvidence ? { ...item.rawEvidence } : undefined,
    })),
    isProcessing: false,
  }),

  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((item) => item.id === id ? { ...item, ...updates } : item),
  })),

  addItem: (item) => set((state) => ({
    items: [
      ...state.items,
      {
        ...item,
        id: `draft_${Date.now()}_${Math.random()}`,
      },
    ],
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id || item.sourceItemId !== undefined),
  })),

  reset: () => set({
    imagePreviewUrl: null,
    imageBase64: null,
    scanType: 'fridge',
    isProcessing: false,
    statusText: '',
    scanId: null,
    items: [],
  }),
}));

onPrivateSessionReset(() => useScanStore.getState().reset());

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScanProcessingState } from '../../src/web/components/scan/ScanProcessingState';

describe('ScanProcessingState', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
  });

  it('explains the async OCR path without claiming completion', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<ScanProcessingState stage="analyzing" kind="receipt" />);
    });
    expect(host.querySelector('[data-testid="scan-processing-state"]')).toBeTruthy();
    expect(host.textContent).toContain('Đang xử lý hóa đơn');
    expect(host.textContent).toContain('AI đang đọc nội dung');
    expect(host.textContent).toContain('kết quả chỉ hiện khi AI xử lý xong');
    expect(host.textContent).not.toContain('Đã hoàn tất');
  });
});

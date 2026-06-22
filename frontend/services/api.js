// ============================================================
// services/api.js
// ============================================================

import { getMockResponse } from './mockData';

const configuredBaseUrl = import.meta.env.VITE_API_URL || '/api';
const BASE_URL = configuredBaseUrl.replace(/\/$/, '');
// FIX #5: Mock chỉ bật khi VITE_ENABLE_MOCK_FALLBACK=true (explicit opt-in).
// Không tự bật khi chạy `npm run dev`, tránh che lỗi API thật ở môi trường demo.
// Để bật local: thêm VITE_ENABLE_MOCK_FALLBACK=true vào file .env.local
const MOCK_FALLBACK_ENABLED = import.meta.env.VITE_ENABLE_MOCK_FALLBACK === 'true';

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${normalizedPath}`;
}

async function readError(res, path) {
  const body = await res.text().catch(() => '');
  const detail = body ? ` - ${body.slice(0, 180)}` : '';
  return new Error(`API Error ${res.status}: ${path}${detail}`);
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };

  try {
    const res = await fetch(buildUrl(path), {
      headers,
      ...options,
    });

    if (!res.ok) throw await readError(res, path);
    return res.json();
  } catch (error) {
    if (MOCK_FALLBACK_ENABLED) {
      try {
        console.warn(`API unavailable for ${path}; using frontend mock data.`, error.message);
        return getMockResponse(path, options);
      } catch (mockError) {
        console.warn(mockError.message);
      }
    }
    throw error;
  }
}

// ── Unwrap helper ──────────────────────────────────────────
// Blockchain controllers trả { success, data: {...} }
// Mock endpoints trả flat object
// Hàm này chuẩn hoá về flat object cho cả hai
function unwrap(res) {
  if (res && typeof res === 'object' && 'success' in res && 'data' in res) {
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      return {
        ...res.data,
        txHash: res.txHash ?? res.data.txHash ?? res.data.blockchain_tx_hash,
        etherscanUrl: res.etherscanUrl ?? res.data.etherscanUrl ?? res.data.etherscan_url,
      };
    }
    return res.data;
  }
  return res;
}

async function requestUnwrap(path, options = {}) {
  const res = await request(path, options);
  return unwrap(res);
}

// ── Dashboard ──────────────────────────────────────────────
export const dashboardApi = {
  getMetrics:       () => request('/dashboard/metrics'),
  getRecentBatches: () => request('/dashboard/recent-batches'),
  getAlerts:        () => request('/dashboard/alerts'),
};

// ── Batch Management ────────────────────────────────────────
export const batchApi = {
  // Map tới GET /batches?search=&type=&status=
  // Dùng requestUnwrap để tương thích khi /batches chuyển sang blockchain route
  // (blockchain trả { success, data: [...] }, mock trả array thẳng)
  list: (filters = {}) => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v != null)
      )
    ).toString();
    return requestUnwrap(`/batches${params ? `?${params}` : ''}`);
  },

  create: (data) => requestUnwrap('/batches', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  import: (formData) => requestUnwrap('/batches/import', {
    method: 'POST',
    body: formData,
  }),

  getStatus: (batchId) => requestUnwrap(`/batches/${batchId}/status`),
  getOwner:  (batchId) => requestUnwrap(`/batches/${batchId}/owner`),

  transfer: (batchId, data) => requestUnwrap(`/batches/${batchId}/transfer`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateCustody: (batchId, data) => requestUnwrap(`/batches/${batchId}/custody-log`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Không có route GET /batches/:id trên backend
  // Dùng getStatus + getOwner riêng nếu cần — giữ lại để không break import cũ
  // nhưng log warning rõ ràng
  getById: (id) => {
    console.warn(`batchApi.getById(${id}) — route này không tồn tại trên backend. Dùng getStatus() hoặc getOwner() thay thế.`);
    return Promise.reject(new Error(`GET /batches/${id} không tồn tại. Dùng /batches/${id}/status hoặc /batches/${id}/owner`));
  },
  getNotifications: ()   => request('/batches/notifications'),
  dismissNotif:     (id) => request(`/batches/notifications/${id}`, { method: 'DELETE' }),
};

// ── Issue Management (Removed as it is unused) ──────────────────────────

// ── Scan / QR ──────────────────────────────────────────────
export const scanApi = {
  getBatchByToken: (tokenId) => request(`/scan/${tokenId}`),

  reportIssue: (data) => request('/scan/report-issue', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // FIX: upload-evidence là 501 — wrap để không block flow
  uploadEvidence: async (formData) => {
    try {
      const res = await fetch(buildUrl('/scan/upload-evidence'), {
        method: 'POST',
        body: formData,
        // Không set Content-Type — browser tự set multipart boundary
      });
      if (res.status === 501) {
        console.warn('upload-evidence chưa được implement (501), bỏ qua upload.');
        return { hash: null };
      }
      if (!res.ok) throw new Error(`Upload Error ${res.status}`);
      return res.json();
    } catch (err) {
      if (MOCK_FALLBACK_ENABLED) {
        console.warn('Upload evidence failed; using mock evidence hash:', err.message);
        return { hash: `mock-evidence-${Date.now()}` };
      }
      console.warn('Upload evidence failed, tiếp tục không có file:', err.message);
      return { hash: null };
    }
  },
};

export const traceApi = {
  list: (filters = {}) => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v != null)
      )
    ).toString();
    return requestUnwrap(`/traceability${params ? `?${params}` : ''}`);
  },
  getByToken: (tokenId) => requestUnwrap(`/traceability/${tokenId}`),
};

export const adminApi = {
  getStatus: () => requestUnwrap('/admin/status'),
  backup: async () => {
    const res = await fetch(buildUrl('/admin/backup'));
    if (!res.ok) throw await readError(res, '/admin/backup');
    return res.blob();
  },
  restore: (formData) => requestUnwrap('/admin/restore', {
    method: 'POST',
    body: formData,
  }),
  getAutoBackupConfig: () => requestUnwrap('/admin/auto-backup/config'),
  updateAutoBackupConfig: (data) => requestUnwrap('/admin/auto-backup/config', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getAutoBackupLogs: () => requestUnwrap('/admin/auto-backup/logs'),
  triggerManualBackup: () => requestUnwrap('/admin/auto-backup/now', {
    method: 'POST',
  }),
};

// ── Payment / Escrow ────────────────────────────────────────
// FIX: tất cả dùng requestUnwrap để handle cả mock (flat) và blockchain ({ success, data })
export const paymentApi = {
  lock: (data) => requestUnwrap('/payments/lock', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  release: (batchId, data) => requestUnwrap(`/payments/${batchId}/release`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getBalance:      () => requestUnwrap('/payments/escrow/balance'),
  getTransactions: () => requestUnwrap('/payments/escrow/transactions'),
};

// ── Certificates ──────────────────────────────────────────
export const certificateApi = {
  list: (filters = {}) => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v != null)
      )
    ).toString();
    return request(`/certificates${params ? `?${params}` : ''}`);
  },

  create: (data) => request('/certificates', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (certId, data) => request(`/certificates/${certId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (certId) => request(`/certificates/${certId}`, {
    method: 'DELETE',
  }),
};

// ── Escrow ─────────────────────────────────────────────────
// FIX: getBalance/getTransactions delegate sang paymentApi (đúng path blockchain)
// getDisputes dùng mock path /escrow/disputes (chưa có trong blockchain routes)
export const escrowApi = {
  getBalance:      () => paymentApi.getBalance(),
  getTransactions: () => paymentApi.getTransactions(),
  getDisputes:     () => request('/escrow/disputes'),
  openDispute:     (data) => request('/escrow/disputes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

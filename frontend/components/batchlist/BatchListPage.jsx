// ============================================================
// components/batchlist/BatchListPage.jsx
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { batchApi, certificateApi } from '../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../shared/StateViews';
import { StatusBadge } from '../dashboard/DashboardPage';
import BatchDetailModal from './BatchDetailModal';

// ── QR Storage helpers (localStorage) ─────────────────────
const QR_STORE_KEY = 'blocktrace-qr-store';
function saveQR(batchCode, qrDataUrl) {
  try {
    const store = JSON.parse(localStorage.getItem(QR_STORE_KEY) || '{}');
    store[batchCode] = qrDataUrl;
    localStorage.setItem(QR_STORE_KEY, JSON.stringify(store));
  } catch {}
}
function loadQR(batchCode) {
  try {
    const store = JSON.parse(localStorage.getItem(QR_STORE_KEY) || '{}');
    return store[batchCode] || null;
  } catch { return null; }
}
// FIX #6: dùng VITE_API_URL thay vì hardcode localhost:4000
const BACKEND_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
function resolveQrSrc(batchCode, _qrUrl) {
  const local = loadQR(batchCode);
  if (local) return local; // base64 từ lần tạo mới nhất
  if (!batchCode) return null;
  return `${BACKEND_BASE}/api/qr/${encodeURIComponent(batchCode)}`;
}

// ── QR Modal ───────────────────────────────────────────────
function QRModal({ batchCode, qrUrl, onClose }) {
  const qrSrc = resolveQrSrc(batchCode, qrUrl);

  function handlePrint() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>In mã QR</title></head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
      <div style="text-align:center;">
        <img src="${qrSrc}" style="max-width:300px;" />
        <div style="margin-top:12px;font-family:Arial;font-size:14px;">${batchCode}</div>
      </div></body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-fade-in" style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }} />
      <div className="animate-slide-up" style={{ position: 'relative', background: '#fff', borderRadius: 24, padding: 32, maxWidth: 380, width: '90%', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-icons-round" style={{ fontSize: 18, color: '#64748b' }}>close</span>
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Mã QR Lô Hàng</div>
        <div style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace', marginBottom: 20 }}>{batchCode}</div>
        {qrSrc ? (
          <img src={qrSrc} alt="QR Code" style={{ width: 220, height: 220, borderRadius: 16, background: 'white', padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }} />
        ) : (
          <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 16, margin: '0 auto', color: '#94a3b8', fontSize: 13 }}>
            Không có ảnh QR
          </div>
        )}
        {qrSrc && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            <a href={qrSrc} download={`${batchCode}-qr.png`}
              style={{ padding: '10px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, color: '#334155', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-round" style={{ fontSize: 16 }}>download</span> Tải PNG
            </a>
            <button onClick={handlePrint} className="btn-gradient"
              style={{ padding: '10px 18px', borderRadius: 10, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-round" style={{ fontSize: 16 }}>print</span> In QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Debounce hook ──────────────────────────────────────────
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FilterBar({ filters, onChange }) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            className="input-premium"
            value={filters.search}
            placeholder="Tìm mã lô, sản phẩm..."
            onChange={e => onChange({ ...filters, search: e.target.value })}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            className="input-premium"
            value={filters.qr}
            placeholder="Tìm theo mã QR / token"
            onChange={e => onChange({ ...filters, qr: e.target.value })}
            style={{ width: '100%' }}
          />
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          style={{ 
            padding: '10px 16px', borderRadius: '12px', background: showFilters ? '#ecfdf5' : '#f8fafc',
            border: `1px solid ${showFilters ? '#10b981' : '#e2e8f0'}`, color: showFilters ? '#10b981' : '#64748b',
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', height: '42px'
          }}
        >
          <span className="material-icons-round" style={{ fontSize: 18 }}>filter_list</span>
          Bộ lọc {showFilters ? 'ẩn' : 'mở rộng'}
        </button>
      </div>

      {showFilters && (
        <div className="animate-slide-down" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <select className="input-premium" value={filters.status} onChange={e => onChange({ ...filters, status: e.target.value })}>
            <option value="">Tất cả trạng thái</option>
            <option value="minted">Khởi tạo</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="transit">Đang vận chuyển</option>
            <option value="checkpoint">Trạm trung chuyển</option>
            <option value="delivering">Đang giao hàng</option>
            <option value="delivered">Đã giao</option>
            <option value="issue">Có vấn đề</option>
          </select>
          <select className="input-premium" value={filters.type} onChange={e => onChange({ ...filters, type: e.target.value })}>
            <option value="">Tất cả loại</option>
            <option value="fruit">Trái cây</option>
            <option value="rice">Gạo / Ngũ cốc</option>
            <option value="coffee">Cà phê</option>
            <option value="vegetable">Rau củ</option>
            <option value="dairy">Sữa / Chế phẩm</option>
            <option value="meat">Thịt</option>
            <option value="other">Khác</option>
          </select>
          <select className="input-premium" value={filters.sortBy} onChange={e => onChange({ ...filters, sortBy: e.target.value })}>
            <option value="createdDesc">Mới nhất</option>
            <option value="createdAsc">Cũ nhất</option>
            <option value="expiryAsc">Hạn dùng tăng</option>
            <option value="expiryDesc">Hạn dùng giảm</option>
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="input-premium" type="date" style={{ width: '100%' }} value={filters.expiryFrom} onChange={e => onChange({ ...filters, expiryFrom: e.target.value })} title="Hạn dùng từ ngày" />
            <input className="input-premium" type="date" style={{ width: '100%' }} value={filters.expiryTo} onChange={e => onChange({ ...filters, expiryTo: e.target.value })} title="Hạn dùng đến ngày" />
          </div>
        </div>
      )}
    </div>
  );
}

function NewBatchForm({ onCreated }) {
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [producerName, setProducerName] = useState('');
  const [origin, setOrigin] = useState('');
  const [preciseOrigin, setPreciseOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [carrier, setCarrier] = useState('');
  const [foodType, setFoodType] = useState('other');
  const [expiryDate, setExpiryDate] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [senderName, setSenderName] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [certificateIds, setCertificateIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdBatch, setCreatedBatch] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  useEffect(() => {
    certificateApi.list()
      .then(data => setCertificates(data || []))
      .catch(err => console.warn('Failed to load certificates:', err.message))
      .finally(() => setLoadingCerts(false));
  }, []);

  const handleCertificateToggle = (certId) => {
    setCertificateIds(prev =>
      prev.includes(certId) ? prev.filter(id => id !== certId) : [...prev, certId]
    );
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const batch = await batchApi.create({
        productName, quantity, producerName,
        origin: preciseOrigin || origin, preciseOrigin,
        destination, carrier, type: foodType, expiryDate,
        certificateIds: certificateIds.length > 0 ? certificateIds : undefined,
        senderName: senderName || undefined,
        senderContact: senderContact || undefined,
      });
      // Lưu QR vào localStorage để không mất sau reload
      if (batch.batchCode && batch.qrDataUrl) {
        saveQR(batch.batchCode, batch.qrDataUrl);
      }
      setCreatedBatch(batch);
      setProductName(''); setQuantity(''); setProducerName('');
      setOrigin(''); setPreciseOrigin(''); setDestination('');
      setCarrier(''); setFoodType('other');
      setExpiryDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setSenderName(''); setSenderContact(''); setCertificateIds([]);
      onCreated?.();
    } catch (err) {
      setError(err?.message || 'Không thể tạo lô hàng mới.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (!createdBatch?.qrDataUrl) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>In mã QR</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">` +
      `<div style="text-align:center;"><img src="${createdBatch.qrDataUrl}" alt="QR code" style="max-width:100%;height:auto;" /><div style="margin-top:12px;font-family:Arial;font-size:14px;">${createdBatch.batchCode}</div></div>` +
      `</body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '32px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Tạo lô hàng mới</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: '4px' }}>Khởi tạo bản ghi Blockchain và tự động cấp mã QR.</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div><label style={labelStyle}>Tên sản phẩm *</label><input className="input-premium" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ví dụ: Gạo ST25" required style={{width:'100%'}} /></div>
          <div><label style={labelStyle}>Số lượng *</label><input className="input-premium" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Ví dụ: 1.200 kg" required style={{width:'100%'}} /></div>
          <div><label style={labelStyle}>Nhà sản xuất</label><input className="input-premium" value={producerName} onChange={e => setProducerName(e.target.value)} placeholder="Ví dụ: HTX Nông Nghiệp" style={{width:'100%'}} /></div>
          <div><label style={labelStyle}>Đơn vị vận chuyển</label><input className="input-premium" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Ví dụ: ColdChain Express" style={{width:'100%'}} /></div>
          <div><label style={labelStyle}>Tỉnh/Thành phố *</label><input className="input-premium" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Ví dụ: Tiền Giang" required style={{width:'100%'}} /></div>
          <div><label style={labelStyle}>Địa điểm đến *</label><input className="input-premium" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ví dụ: TP HCM" required style={{width:'100%'}} /></div>
        </div>

        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div>
            <label style={labelStyle}>Loại thực phẩm</label>
            <select className="input-premium" value={foodType} onChange={e => setFoodType(e.target.value)} style={{width:'100%'}}>
              <option value="fruit">Trái cây</option><option value="rice">Gạo / Ngũ cốc</option>
              <option value="coffee">Cà phê</option><option value="vegetable">Rau củ</option>
              <option value="dairy">Sữa / Chế phẩm</option><option value="meat">Thịt</option><option value="other">Khác</option>
            </select>
          </div>
          <div><label style={labelStyle}>Hạn sử dụng</label><input className="input-premium" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={{width:'100%'}} /></div>
        </div>

        {!loadingCerts && certificates.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <label style={labelStyle}>Chứng chỉ/Chứng nhận đính kèm</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {certificates.map(cert => (
                <label key={cert.cert_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: certificateIds.includes(cert.cert_id) ? '#ecfdf5' : '#f8fafc', border: certificateIds.includes(cert.cert_id) ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={certificateIds.includes(cert.cert_id)} onChange={() => handleCertificateToggle(cert.cert_id)} style={{ cursor: 'pointer', accentColor: '#10b981', transform: 'scale(1.2)' }} />
                  {cert.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="animate-fade-in" style={{ padding: '12px 16px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>{error}</div>
        )}

        <div style={{ marginTop: '12px' }}>
          <button className="btn-gradient" type="submit" disabled={loading} style={{ padding: '14px 32px', fontSize: '16px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Đang tạo dữ liệu Blockchain...' : 'Tạo Lô & Cấp QR Code'}
          </button>
        </div>
      </form>

      {createdBatch && (
        <div className="animate-slide-up" style={{ marginTop: '32px', padding: '24px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: '20px', textAlign: 'center' }}>Mã QR Lô Hàng</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <img src={createdBatch.qrDataUrl} alt="QR code" style={{ width: 200, height: 200, borderRadius: '16px', background: 'white', padding: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Mã Token ID</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{createdBatch.batchCode}</div>
            </div>
            <div style={{ padding: '10px 16px', background: '#ecfdf5', borderRadius: 10, fontSize: 13, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-round" style={{ fontSize: 16 }}>save</span>
              Mã QR đã được lưu tự động — có thể xem lại từ thẻ lô hàng bất kỳ lúc nào.
            </div>
            {createdBatch.etherscanUrl && (
              <a href={createdBatch.etherscanUrl} target="_blank" rel="noreferrer"
                style={{ padding: '10px 16px', background: '#eff6ff', borderRadius: 10, fontSize: 13, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 700 }}>
                <span className="material-icons-round" style={{ fontSize: 16 }}>open_in_new</span>
                Xem giao dich tren Sepolia Etherscan
              </a>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <a href={createdBatch.qrDataUrl} download={`${createdBatch.batchCode}-qr.png`} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#334155', textDecoration: 'none', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-icons-round" style={{ fontSize: 16 }}>download</span> Tải Ảnh PNG
              </a>
              <button className="btn-gradient" onClick={handlePrint} style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-icons-round" style={{ fontSize: 16 }}>print</span> In Mã QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkUploadForm({ onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setMessage('');
    if (!file) { setError('Vui lòng chọn file CSV hoặc Excel để nhập dữ liệu.'); return; }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) { setError('Chỉ chấp nhận file CSV hoặc Excel (.csv, .xlsx, .xls).'); return; }
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const result = await batchApi.import(formData);
      setMessage(`Nhập thành công ${result.importedCount} lô; ${result.failedCount} dòng lỗi.`);
      if (result.failedCount) setError(`Một vài dòng bị lỗi: ${result.failures.map(f => `#${f.row}`).join(', ')}`);
      setFile(null); onImported?.();
    } catch (err) {
      setError(err?.message || 'Quá trình nhập file thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '32px', marginBottom: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Nhập dữ liệu hàng loạt</div>
        <div style={{ fontSize: 14, color: '#64748b', marginTop: '4px' }}>Tạo nhiều lô hàng cùng lúc bằng file CSV / Excel.</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
        <div style={{ flex: '1 1 300px' }}>
          <label style={labelStyle}>Tệp đính kèm (CSV, XLSX)</label>
          <input type="file" className="input-premium" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} style={{width:'100%', cursor:'pointer'}} />
          <a href="/batch-import-template.csv" download="batch-import-template.csv" style={{ display: 'inline-block', marginTop: '12px', fontSize: '13px', color: '#10b981', textDecoration: 'underline', fontWeight: 500 }}>Tải mẫu CSV / Excel</a>
        </div>
        {message && <div style={{ padding: '12px', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}>{message}</div>}
        {error && <div style={{ padding: '12px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>{error}</div>}
        <div><button className="btn-gradient" type="submit" disabled={loading} style={{ padding: '12px 24px', fontSize: '15px', opacity: loading ? 0.7 : 1 }}>{loading ? 'Đang xử lý...' : 'Bắt đầu Nhập'}</button></div>
      </form>
    </div>
  );
}

// ── BatchCard — wrapped in memo để tránh re-render không cần thiết ──
const BatchCard = memo(function BatchCard({ row, onQROpen, onSelect }) {
  const qrSrc = resolveQrSrc(row.batchCode, row.qrUrl);

  return (
    <div className="batch-card animate-slide-up" onClick={() => onSelect?.(row)} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{row.productName}</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>{row.batchCode}</div>
        </div>
        <StatusBadge status={row.status} />
      </div>

      {/* QR hiện thẳng trên card — bấm để mở modal to hơn */}
      <div
        onClick={e => { e.stopPropagation(); onQROpen?.(row); }}
        title="Bấm để xem QR to hơn"
        style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, cursor: 'zoom-in',
          background: '#f8fafc', borderRadius: 14, padding: '10px',
          border: '1px solid #e2e8f0', transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#f0fdf4'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
      >
        <img
          src={qrSrc}
          alt={`QR ${row.batchCode}`}
          style={{ width: 110, height: 110, borderRadius: 8, display: 'block' }}
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
        />
        <div style={{ display: 'none', width: 110, height: 110, alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12, flexDirection: 'column', gap: 6 }}>
          <span className="material-icons-round" style={{ fontSize: 32, color: '#cbd5e1' }}>qr_code</span>
          Đang tải...
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div><div style={cardLabelStyle}>Loại</div><div style={cardValueStyle}>{row.type || 'Khác'}</div></div>
        <div><div style={cardLabelStyle}>Hạn sử dụng</div><div style={cardValueStyle}>{row.expiryDate || 'N/A'}</div></div>
        <div><div style={cardLabelStyle}>Số lượng</div><div style={{...cardValueStyle, color: '#0f172a', fontWeight: 600 }}>{row.quantity}</div></div>
        <div><div style={cardLabelStyle}>Nông hộ</div><div style={cardValueStyle}>{row.farmName || '—'}</div></div>
      </div>

      <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <div style={{ fontSize: '13px', color: '#64748b' }}>Từ <span style={{fontWeight:600, color:'#334155'}}>{row.origin}</span></div>
        <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="material-icons-round" style={{ fontSize: 13 }}>zoom_in</span> Bấm để phóng to
        </span>
      </div>
    </div>
  );
});

function BatchTable({ filters, reloadKey, onSelectBatch }) {
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid');
  const [qrModal, setQrModal] = useState(null); // { batchCode, qrUrl }
  const pageSize = 12;

  // Debounced filters để tránh gọi API liên tục khi đang gõ
  const debouncedSearch = useDebounce(filters.search, 300);
  const debouncedQr = useDebounce(filters.qr, 300);

  const apiFilters = useMemo(() => ({
    search: debouncedSearch,
    qr: debouncedQr,
    type: filters.type,
    status: filters.status,
  }), [debouncedSearch, debouncedQr, filters.type, filters.status]);

  const { data, loading, error, refetch } = useFetch(
    () => batchApi.list(apiFilters),
    [apiFilters.search, apiFilters.type, apiFilters.status, apiFilters.qr, reloadKey]
  );

  // Giữ data cũ khi đang reload (stale-while-revalidate) — tránh màn hình trắng
  const staleData = useRef(null);
  if (data) staleData.current = data;
  const displayData = data || staleData.current;

  useEffect(() => { setPage(1); }, [filters.search, filters.type, filters.status, filters.qr, filters.sortBy, filters.expiryFrom, filters.expiryTo, reloadKey]);

  const processedItems = useMemo(() => {
    const items = Array.isArray(displayData) ? displayData : [];
    const filtered = items.filter(item => {
      const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
      const matchesFrom = filters.expiryFrom ? expiry && expiry >= new Date(filters.expiryFrom) : true;
      const matchesTo = filters.expiryTo ? expiry && expiry <= new Date(filters.expiryTo) : true;
      return matchesFrom && matchesTo;
    });
    return [...filtered].sort((a, b) => {
      if (filters.sortBy === 'expiryAsc') return new Date(a.expiryDate || '') - new Date(b.expiryDate || '');
      if (filters.sortBy === 'expiryDesc') return new Date(b.expiryDate || '') - new Date(a.expiryDate || '');
      if (filters.sortBy === 'createdAsc') return new Date(a.createdAt || '') - new Date(b.createdAt || '');
      return new Date(b.createdAt || '') - new Date(a.createdAt || '');
    });
  }, [displayData, filters.expiryFrom, filters.expiryTo, filters.sortBy]);

  const pageCount = Math.max(1, Math.ceil(processedItems.length / pageSize));
  const pageItems = processedItems.slice((page - 1) * pageSize, page * pageSize);
  const cols = ['Mã lô', 'Sản phẩm', 'Loại', 'Hạn sử dụng', 'Nông hộ', 'Số lượng', 'Xuất phát', 'Điểm đến', 'QR', 'Trạng thái'];

  return (
    <div className="animate-fade-in">
      {/* QR Modal */}
      {qrModal && <QRModal batchCode={qrModal.batchCode} qrUrl={qrModal.qrUrl} onClose={() => setQrModal(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#334155' }}>
            Kết quả ({Array.isArray(displayData) ? displayData.length : 0} lô hàng)
          </div>
          {/* Loading indicator nhỏ — không xóa data cũ */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981' }}>
              <span className="material-icons-round" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>sync</span>
              Đang tải...
            </div>
          )}
        </div>
        <div className="view-toggle">
          <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
            <span className="material-icons-round" style={{fontSize: '18px'}}>grid_view</span> Lưới
          </button>
          <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
            <span className="material-icons-round" style={{fontSize: '18px'}}>view_list</span> Bảng
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!error && (
        <>
          {!displayData?.length && !loading ? (
            <div className="glass-panel" style={{ padding: '40px' }}>
              <EmptyState icon="inventory_2" title="Không có lô hàng nào" subtitle="Thử thay đổi bộ lọc hoặc tạo lô mới." />
            </div>
          ) : viewMode === 'grid' ? (
            <div className="batch-card-grid" style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
              {pageItems.map(row => (
                <BatchCard
                  key={row.id}
                  row={row}
                  onQROpen={r => setQrModal({ batchCode: r.batchCode, qrUrl: r.qrUrl })}
                  onSelect={onSelectBatch}
                />
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {cols.map(c => <th key={c} style={thStyle}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(row => (
                    <tr key={row.id} onClick={() => onSelectBatch?.(row)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>{row.batchCode}</td>
                      <td style={{...tdStyle, fontWeight: 500}}>{row.productName}</td>
                      <td style={tdStyle}>{row.type || 'Khác'}</td>
                      <td style={tdStyle}>{row.expiryDate || 'N/A'}</td>
                      <td style={tdStyle}>{row.farmName}</td>
                      <td style={tdStyle}>{row.quantity}</td>
                      <td style={tdStyle}>{row.origin}</td>
                      <td style={tdStyle}>{row.destination}</td>
                      <td style={tdStyle}>
                        {(row.qrUrl || loadQR(row.batchCode)) ? (
                          <button onClick={e => { e.stopPropagation(); setQrModal({ batchCode: row.batchCode, qrUrl: row.qrUrl }); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>qr_code</span> Xem QR
                          </button>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {processedItems.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Hiển thị trang {page} / {pageCount}</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: page <= 1 ? '#f8fafc' : '#ffffff', color: page <= 1 ? '#94a3b8' : '#334155', fontWeight: 600, cursor: page <= 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>Trang Trước</button>
                <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
                  style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: page >= pageCount ? '#f8fafc' : '#ffffff', color: page >= pageCount ? '#94a3b8' : '#334155', fontWeight: 600, cursor: page >= pageCount ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>Trang Sau</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NotificationsPanel() {
  const { data, loading, refetch } = useFetch(batchApi.getNotifications);

  async function dismiss(id) { await batchApi.dismissNotif(id); refetch(); }
  async function dismissAll() {
    if (!data?.length) return;
    await Promise.all(data.map(n => batchApi.dismissNotif(n.id)));
    refetch();
  }

  if (!loading && (!data || data.length === 0)) return null;

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '24px', marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{color:'#f59e0b'}}>notifications_active</span> Thông báo hệ thống
        </div>
        {data?.length > 0 && (
          <button onClick={dismissAll} style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
            Đánh dấu đã đọc
          </button>
        )}
      </div>
      {loading && <LoadingState />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data?.map(n => (
          <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="material-icons-round" style={{ fontSize: '20px', color: n.type === 'error' ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                {n.type === 'error' ? 'error_outline' : 'info_outline'}
              </span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{n.title}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', lineHeight: '1.5' }}>{n.message}</div>
              </div>
            </div>
            <button onClick={() => dismiss(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '20px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' };
const cardLabelStyle = { fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const cardValueStyle = { fontSize: '14px', color: '#334155' };
const thStyle = { padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '16px 20px', color: '#334155', fontSize: '14px' };

export default function BatchListPage({ onScanRequested }) {
  const [filters, setFilters] = useState({ search: '', qr: '', type: '', status: '', sortBy: 'createdDesc', expiryFrom: '', expiryTo: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedBatch, setSelectedBatch] = useState(null);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(to right, #ecfdf5, transparent)', padding: '24px', borderRadius: '24px' }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-icons-round" style={{ color: '#10b981', fontSize: '32px' }}>inventory_2</span>
        </div>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Danh sách Lô hàng</div>
          <div style={{ fontSize: '15px', color: '#475569', maxWidth: '600px', marginTop: '6px', lineHeight: '1.5' }}>
            Quản lý và truy xuất nguồn gốc lô hàng theo thời gian thực. Bấm vào lô hàng để xem tiến trình chuỗi cung ứng.
          </div>
        </div>
      </div>

      <NewBatchForm onCreated={() => setReloadKey(k => k + 1)} />
      <FilterBar filters={filters} onChange={setFilters} />
      <BatchTable filters={filters} reloadKey={reloadKey} onScanRequested={onScanRequested} onSelectBatch={setSelectedBatch} />
      <BulkUploadForm onImported={() => setReloadKey(k => k + 1)} />
      <NotificationsPanel />

      {selectedBatch && (
        <BatchDetailModal
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onUpdated={() => setReloadKey(k => k + 1)}
        />
      )}
    </div>
  );
}

// ============================================================
// components/scan/ScanPage.jsx  →  "Cập nhật đơn hàng"
// ============================================================

import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { scanApi, batchApi } from '../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../shared/StateViews';

const SCAN_HISTORY_STORAGE_KEY = 'blocktrace-scan-history';

// ── Shared Styles ──────────────────────────────────────────
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' };

// ── 1. Batch Info Panel ────────────────────────────────────
function BatchInfoPanel({ data, showHash }) {
  if (!data) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
      <span className="material-icons-round" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12, display: 'block' }}>search</span>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>Chưa có dữ liệu</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>Nhập mã lô hoặc quét QR để xem thông tin.</div>
    </div>
  );

  const expiryStatus = (() => {
    if (!data.expDate) return 'Không rõ';
    const parsed = Date.parse(data.expDate);
    if (Number.isNaN(parsed)) return data.expDate;
    return parsed < Date.now() ? 'Đã hết hạn' : 'Còn hạn';
  })();

  const rows = [
    { label: 'Token ID',        key: 'tokenId',      mono: true, icon: 'token' },
    { label: 'Sản phẩm',       key: 'productName',  icon: 'inventory_2' },
    { label: 'Mã lô',          key: 'batchCode',    mono: true, icon: 'qr_code' },
    { label: 'Số lượng',       key: 'quantity',     icon: 'scale' },
    { label: 'Cơ sở chế biến', key: 'facility',     icon: 'factory' },
    { label: 'Xuất xứ',        key: 'origin',       icon: 'location_on' },
    { label: 'Ngày sản xuất',  key: 'mfgDate',      icon: 'event' },
    { label: 'Hạn sử dụng',    key: 'expDate',      icon: 'event_available' },
    { label: 'Tình trạng hạn',  key: 'expiryStatus', icon: 'schedule' },
    { label: 'Đơn vị vận tải', key: 'carrier',      icon: 'local_shipping' },
    { label: 'Trạng thái',     key: 'status',       icon: 'flag' },
  ];

  const values = { ...data, expiryStatus };
  const etherscanUrl = data.etherscanUrl || (data.hash ? `https://sepolia.etherscan.io/tx/${data.hash}` : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header Card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', marginBottom: 8, borderBottom: '2px solid #f1f5f9' }}>
        <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-icons-round" style={{ color: 'white', fontSize: 24 }}>inventory_2</span>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{data.productName || 'Sản phẩm'}</div>
          <div style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>{data.batchCode || data.tokenId}</div>
        </div>
      </div>

      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
            <span className="material-icons-round" style={{ fontSize: 16, color: '#94a3b8' }}>{r.icon}</span>
            {r.label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', fontFamily: r.mono ? 'monospace' : 'inherit', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>
            {values[r.key] ?? '—'}
          </span>
        </div>
      ))}

      {showHash && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 12, fontFamily: 'monospace', fontSize: 12, color: '#15803d', border: '1px solid #bbf7d0' }}>
          <span style={{ fontWeight: 600 }}>Hash on-chain:</span> {data.hash ?? 'Chưa có'}
        </div>
      )}
      {etherscanUrl && (
        <a href={etherscanUrl} target="_blank" rel="noreferrer" style={{ marginTop: 10, padding: '10px 14px', background: '#eff6ff', borderRadius: 12, fontSize: 13, color: '#1d4ed8', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 700 }}>
          <span className="material-icons-round" style={{ fontSize: 16 }}>open_in_new</span>
          Xem giao dich moi nhat tren Sepolia Etherscan
        </a>
      )}
      {!showHash && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbeb', borderRadius: 12, fontSize: 12, color: '#92400e', border: '1px solid #fde68a' }}>
          Hash on-chain được ẩn. Quét bằng QR hoặc tra cứu bằng NFT token để xem hash.
        </div>
      )}
    </div>
  );
}

// ── 2. Order Update Panel (Timeline + Upload) ─────────────
const SUPPLY_CHAIN_STEPS = [
  { id: 'minted',     label: 'Khởi tạo',         icon: 'add_circle',      desc: 'Lô hàng được đăng ký trên Blockchain' },
  { id: 'transit',    label: 'Đang vận chuyển',   icon: 'local_shipping',  desc: 'Lô hàng rời kho, đang trên đường đi' },
  { id: 'checkpoint', label: 'Trạm trung chuyển', icon: 'warehouse',       desc: 'Tới trạm kiểm tra / trung chuyển' },
  { id: 'delivering', label: 'Đang giao hàng',    icon: 'delivery_dining', desc: 'Đang giao tới người nhận cuối' },
  { id: 'delivered',  label: 'Đã giao',           icon: 'check_circle',    desc: 'Lô hàng đã giao thành công' },
];

function getStepIndex(status, custodyLogs) {
  const m = {
    'minted': 0, 'pending': 0, 'created': 0, 'Khởi tạo': 0,
    'transit': 1, 'in_transit': 1, 'Đang vận chuyển': 1, 'Đã rời kho': 1,
    'checkpoint': 2, 'Trạm trung chuyển': 2, 'Tới trạm trung chuyển': 2,
    'delivering': 3, 'Đang giao hàng': 3,
    'delivered': 4, 'Đã giao': 4, 'Đã giao thành công': 4, 'Đã nhận hàng': 4,
  };
  
  if (status !== 'issue' && m[status] !== undefined) {
    return m[status];
  }

  if (custodyLogs && custodyLogs.length > 0) {
    let maxIndex = 0;
    for (const log of custodyLogs) {
      const idx = m[log.status];
      if (idx !== undefined && idx > maxIndex) maxIndex = idx;
    }
    return maxIndex;
  }

  return 0;
}

function OrderUpdatePanel({ batchData, onUpdated }) {
  const [confirmStep, setConfirmStep] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Optimistic local step index: cập nhật ngay sau khi xác nhận thành công
  const [localStep, setLocalStep] = useState(null);
  const [justCompletedStep, setJustCompletedStep] = useState(null);

  if (!batchData) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
      <span className="material-icons-round" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12, display: 'block' }}>edit_note</span>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>Chọn lô hàng trước</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>Tra cứu lô hàng bên trái để bắt đầu cập nhật.</div>
    </div>
  );

  const currentStep = localStep !== null ? localStep : getStepIndex(batchData.status, batchData.custodyLogs);
  const nextStep = currentStep < SUPPLY_CHAIN_STEPS.length - 1 ? currentStep + 1 : null;

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  async function handleConfirm() {
    if (!file) { setError('Vui lòng tải ảnh xác nhận trước.'); return; }
    if (confirmStep === null) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let evidenceHash = null;
      let imageUrl = null;
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await scanApi.uploadEvidence(fd);
      evidenceHash = uploadRes.hash ?? `img-${Date.now()}`;
      imageUrl = uploadRes.imageUrl ?? null;

      const batchId = batchData.tokenId || batchData.batchCode;
      const stepData = SUPPLY_CHAIN_STEPS[confirmStep];
      const result = await batchApi.updateCustody(batchId, {
        status: stepData.id,
        evidenceHash,
        imageUrl,
        note: note || `Xác nhận ${stepData.label}`,
        timestamp: new Date().toISOString(),
      });

      setResult({
        message: `Đã xác nhận "${stepData.label}" thành công!`,
        etherscanUrl: result?.etherscanUrl,
      });
      // Optimistic update: tick ngay bước vừa hoàn thành
      setJustCompletedStep(confirmStep);
      setLocalStep(confirmStep);
      setConfirmStep(null);
      setFile(null);
      setPreview(null);
      setNote('');
      onUpdated?.();
    } catch (err) {
      setError(err.message || 'Không thể cập nhật.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {batchData.status === 'issue' && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span className="material-icons-round" style={{ color: '#ef4444', fontSize: 20, marginTop: 2 }}>error_outline</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b' }}>Đơn hàng đang có sự cố</div>
            <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2 }}>Tiến trình cung ứng đang được giữ nguyên ở mức độ hoàn thành cuối cùng.</div>
          </div>
        </div>
      )}

      {/* Progress Bar */}

      <div style={{ marginBottom: 24, padding: '16px 20px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Tiến độ</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{Math.round((currentStep / (SUPPLY_CHAIN_STEPS.length - 1)) * 100)}%</span>
        </div>
        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 99, width: `${(currentStep / (SUPPLY_CHAIN_STEPS.length - 1)) * 100}%`, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative', padding: '0 0 0 32px' }}>
        <div style={{ position: 'absolute', left: 19, top: 10, bottom: 10, width: 3, background: '#e2e8f0', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 19, top: 10, width: 3, borderRadius: 2, background: 'linear-gradient(to bottom, #10b981, #059669)', height: `${Math.min(100, (currentStep / (SUPPLY_CHAIN_STEPS.length - 1)) * 100)}%`, transition: 'height 0.6s ease' }} />

        {SUPPLY_CHAIN_STEPS.map((step, i) => {
          const isCompleted = i <= currentStep;
          const isCurrent = i === currentStep;
          const isNext = i === nextStep;
          const isActive = confirmStep === i;
          
          const logs = batchData.custodyLogs || [];
          const stepLog = logs.find(l => l.status === step.id || l.status === step.label);
          const stepLogEtherscanUrl = stepLog?.etherscanUrl || (stepLog?.txHash ? `https://sepolia.etherscan.io/tx/${stepLog.txHash}` : null);

          return (
            <div key={step.id} style={{ position: 'relative', marginBottom: i < SUPPLY_CHAIN_STEPS.length - 1 ? 8 : 0 }}>
              <div style={{ position: 'absolute', left: -32, top: 8, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCompleted ? 'linear-gradient(135deg, #10b981, #059669)' : isNext ? '#ffffff' : '#f1f5f9', border: isNext ? '3px dashed #10b981' : isCompleted ? 'none' : '2px solid #cbd5e1', transition: 'all 0.3s', zIndex: 2 }}>
                <span className="material-icons-round" style={{ fontSize: 14, color: isCompleted ? '#fff' : isNext ? '#10b981' : '#94a3b8' }}>
                  {isCompleted ? 'check' : step.icon}
                </span>
              </div>

              <div onClick={() => isNext && setConfirmStep(isActive ? null : i)}
                style={{
                  padding: '14px 18px', borderRadius: 14, marginBottom: 8,
                  cursor: isNext ? 'pointer' : 'default',
                  background: isActive ? '#ecfdf5' : isCurrent ? '#f0fdf4' : '#fafafa',
                  border: isActive ? '2px solid #10b981' : isNext ? '2px dashed #a7f3d0' : isCurrent ? '1px solid #bbf7d0' : '1px solid #f1f5f9',
                  transition: 'all 0.3s', opacity: !isCompleted && !isNext ? 0.45 : 1,
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isCompleted ? '#065f46' : isNext ? '#0f172a' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-icons-round" style={{ fontSize: 18, color: isCompleted ? '#10b981' : isNext ? '#3b82f6' : '#cbd5e1' }}>{step.icon}</span>
                      {step.label}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{step.desc}</div>
                    {stepLog && stepLog.note && (
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 8, fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: 8, borderLeft: '3px solid #cbd5e1' }}>
                        "{stepLog.note}"
                      </div>
                    )}
                    {stepLog && stepLog.imageUrl && (
                      <div style={{ marginTop: 12 }}>
                        <a href={stepLog.imageUrl.startsWith('/') ? `${(import.meta.env.VITE_API_URL||'/api').replace(/\/api\/?$/,'')}${stepLog.imageUrl}` : stepLog.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                          <img src={stepLog.imageUrl.startsWith('/') ? `${(import.meta.env.VITE_API_URL||'/api').replace(/\/api\/?$/,'')}${stepLog.imageUrl}` : stepLog.imageUrl} alt="Xác nhận" style={{ height: 60, borderRadius: 8, border: '1px solid #e2e8f0', objectFit: 'cover' }} />
                        </a>
                      </div>
                    )}
                    {stepLogEtherscanUrl && (
                      <a href={stepLogEtherscanUrl} target="_blank" rel="noreferrer" style={{ marginTop: 10, color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                        <span className="material-icons-round" style={{ fontSize: 15 }}>open_in_new</span>
                        Xem giao dich tren Etherscan
                      </a>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {i === justCompletedStep && (
                      <span className="animate-fade-in" style={{ fontSize: 12, fontWeight: 700, color: '#10b981', background: '#d1fae5', padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #6ee7b7' }}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>check_circle</span> Hoàn thành
                      </span>
                    )}
                    {isCompleted && !isCurrent && i !== justCompletedStep && <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', background: '#ecfdf5', padding: '4px 10px', borderRadius: 20 }}>✓</span>}
                    {isCurrent && i !== justCompletedStep && <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 20 }}>Hiện tại</span>}
                    {isNext && !isActive && <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', background: '#fffbeb', padding: '4px 10px', borderRadius: 20 }}>Bấm để xác nhận →</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload & Confirm Panel */}
      {confirmStep !== null && (
        <div className="animate-slide-up" style={{ marginTop: 20, padding: 24, background: '#ffffff', borderRadius: 20, border: '2px solid #10b981', boxShadow: '0 8px 30px rgba(16,185,129,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons-round" style={{ color: '#10b981', fontSize: 22 }}>verified</span>
              Xác nhận: {SUPPLY_CHAIN_STEPS[confirmStep].label}
            </div>
            <button onClick={() => { setConfirmStep(null); setFile(null); setPreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, display: 'flex' }}>
              <span className="material-icons-round">close</span>
            </button>
          </div>

          {/* Upload Zone */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Ảnh xác nhận trạng thái *</label>
            {!preview ? (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 20px', border: '2px dashed #cbd5e1', borderRadius: 16, cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#ecfdf5'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}>
                <span className="material-icons-round" style={{ fontSize: 44, color: '#94a3b8', marginBottom: 8 }}>add_photo_alternate</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Bấm để tải ảnh lên</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Ảnh hàng hóa, biên bản, nhiệt kế...</div>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            ) : (
              <div style={{ position: 'relative' }}>
                <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16, border: '1px solid #e2e8f0' }} />
                <button onClick={() => { setFile(null); setPreview(null); }}
                  style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-icons-round" style={{ color: 'white', fontSize: 18 }}>close</span>
                </button>
                <div style={{ marginTop: 8, fontSize: 13, color: '#10b981', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-icons-round" style={{ fontSize: 16 }}>check_circle</span> {file.name}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Ghi chú (tùy chọn)</label>
            <textarea className="input-premium" value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ghi chú thêm..." style={{ width: '100%', resize: 'vertical' }} />
          </div>

          {error && <div className="animate-fade-in" style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: 8, fontSize: 14, color: '#991b1b' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-gradient" onClick={handleConfirm} disabled={loading || !file}
              style={{ flex: 1, padding: '14px', fontSize: 15, opacity: (loading || !file) ? 0.6 : 1 }}>
              {loading ? 'Đang ghi lên Blockchain...' : 'Xác nhận & Ghi Blockchain'}
            </button>
            <button onClick={() => { setConfirmStep(null); setFile(null); setPreview(null); }}
              style={{ padding: '14px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Completed */}
      {currentStep >= SUPPLY_CHAIN_STEPS.length - 1 && (
        <div style={{ marginTop: 24, padding: '20px', background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)', borderRadius: 16, textAlign: 'center', border: '1px solid #a7f3d0' }}>
          <span className="material-icons-round" style={{ fontSize: 40, color: '#10b981', marginBottom: 8, display: 'block' }}>verified</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#065f46' }}>Chuỗi cung ứng hoàn tất!</div>
          <div style={{ fontSize: 14, color: '#047857', marginTop: 4 }}>Lô hàng đã giao thành công và ghi nhận trên Blockchain.</div>
        </div>
      )}

      {result && (
        <div className="animate-fade-in" style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderLeft: '4px solid #10b981', borderRadius: 8, fontSize: 14, color: '#065f46', fontWeight: 500 }}>
          <div>{result.message || result}</div>
          {result.etherscanUrl && (
            <a href={result.etherscanUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, textDecoration: 'none', fontWeight: 700 }}>
              <span className="material-icons-round" style={{ fontSize: 16 }}>open_in_new</span>
              Xem giao dich tren Sepolia Etherscan
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── 3. Issue Report Panel ──────────────────────────────────
function IssuePanel({ batchData, onSuccess }) {
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [issueEtherscanUrl, setIssueEtherscanUrl] = useState(null);

  const ISSUE_TYPES = [
    { value: 'quality',   label: 'Chất lượng không đạt', icon: '🔴' },
    { value: 'quantity',  label: 'Số lượng thiếu hụt',  icon: '🟡' },
    { value: 'coldchain', label: 'Đứt gãy Cold Chain',  icon: '🧊' },
    { value: 'document',  label: 'Sai thông tin chứng từ', icon: '📄' },
    { value: 'damaged',   label: 'Hàng hóa bị hư hỏng', icon: '💥' },
    { value: 'other',     label: 'Lý do khác',           icon: '📌' },
  ];

  if (!batchData) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
      <span className="material-icons-round" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12, display: 'block' }}>report</span>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>Chọn lô hàng trước</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>Tra cứu lô hàng bên trái để báo cáo sự cố.</div>
    </div>
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) { setError('Vui lòng nhập mô tả chi tiết.'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setIssueEtherscanUrl(null);

    try {
      let evidenceHash = null;
      if (evidenceFile) {
        const fd = new FormData();
        fd.append('file', evidenceFile);
        const uploadRes = await scanApi.uploadEvidence(fd);
        evidenceHash = uploadRes.hash ?? null;
      }

      const tokenId = batchData.tokenId || batchData.batchCode;
      const result = await scanApi.reportIssue({ tokenId, issueType, description, evidenceHash });
      setSuccess(`Báo cáo sự cố đã được ghi nhận thành công!${result?.etherscanUrl ? ` (Etherscan: ${result.etherscanUrl})` : ''}`);
      setIssueEtherscanUrl(result?.etherscanUrl || null);
      setIssueType('');
      setDescription('');
      setEvidenceFile(null);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>Loại sự cố *</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ISSUE_TYPES.map(t => (
            <button type="button" key={t.value} onClick={() => setIssueType(t.value)}
              style={{ padding: '10px 12px', borderRadius: 12, border: issueType === t.value ? '2px solid #ef4444' : '1px solid #e2e8f0', background: issueType === t.value ? '#fef2f2' : '#ffffff', color: issueType === t.value ? '#dc2626' : '#475569', fontWeight: 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Mô tả chi tiết *</label>
        <textarea className="input-premium" value={description} onChange={e => setDescription(e.target.value)}
          rows={4} placeholder="Mô tả tình trạng sự cố cụ thể..." style={{ width: '100%', resize: 'vertical' }} />
      </div>

      <div>
        <label style={labelStyle}>Đính kèm bằng chứng</label>
        <input type="file" className="input-premium" accept="image/*,video/*" onChange={e => setEvidenceFile(e.target.files[0])} style={{ width: '100%', cursor: 'pointer' }} />
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
          File sẽ được hash và ghi lên Blockchain vĩnh viễn.
        </div>
      </div>

      {error && <div className="animate-fade-in" style={{ padding: '12px 16px', background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: 8, fontSize: 14, color: '#991b1b' }}>{error}</div>}
      {success && (
        <div className="animate-fade-in" style={{ padding: '12px 16px', background: '#f0fdf4', borderLeft: '4px solid #10b981', borderRadius: 8, fontSize: 14, color: '#065f46', fontWeight: 500 }}>
          <div>{success}</div>
          {issueEtherscanUrl && (
            <a href={issueEtherscanUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, textDecoration: 'none', fontWeight: 700 }}>
              <span className="material-icons-round" style={{ fontSize: 16 }}>open_in_new</span>
              Xem giao dich tren Sepolia Etherscan
            </a>
          )}
        </div>
      )}

      <button type="submit" disabled={submitting || !issueType}
        style={{ padding: '14px', fontSize: 15, fontWeight: 600, borderRadius: 12, border: 'none', cursor: (submitting || !issueType) ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', boxShadow: '0 4px 14px rgba(239,68,68,0.3)', transition: 'all 0.2s', opacity: (submitting || !issueType) ? 0.6 : 1 }}>
        {submitting ? 'Đang ghi lên Blockchain...' : 'Gửi Báo cáo Sự cố'}
      </button>
    </form>
  );
}

// ── History Panel ──────────────────────────────────────────
function HistoryPanel({ history, onSelect, onClear }) {
  if (!history?.length) return null;
  return (
    <div style={{ marginTop: 20, padding: '16px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-icons-round" style={{ fontSize: 16, color: '#64748b' }}>history</span> Lịch sử tra cứu
        </div>
        <button type="button" onClick={onClear} style={{ fontSize: 12, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Xóa</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {history.slice(0, 5).map(entry => (
          <button key={entry.tokenId} type="button" onClick={() => onSelect(entry.tokenId, entry.source)}
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>{entry.tokenId}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{entry.productName || 'Không rõ'}</div>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', marginTop: 2 }}>
              {new Date(entry.scannedAt).toLocaleString('vi-VN')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function ScanPage({ initialTokenId }) {
  const [tokenId, setTokenId] = useState(initialTokenId || '');
  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [showHash, setShowHash] = useState(false);
  const [activePanel, setActivePanel] = useState('update');

  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    setCameraReady(!!navigator.mediaDevices);
    try {
      const saved = window.localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
      setScanHistory(saved ? JSON.parse(saved) : []);
    } catch (err) {
      console.warn('Không thể đọc lịch sử tra cứu.', err);
    }
    return () => stopCameraScan();
  }, []);

  useEffect(() => {
    if (initialTokenId) {
      setTokenId(initialTokenId);
      handleScan(initialTokenId, 'manual');
    }
  }, [initialTokenId]);

  function persistHistory(history) {
    try { window.localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(history)); }
    catch (err) { console.warn('Không thể lưu lịch sử.', err); }
  }

  function pushHistoryEntry(entry) {
    setScanHistory(prev => {
      const filtered = prev.filter(item => item.tokenId !== entry.tokenId);
      const next = [entry, ...filtered].slice(0, 10);
      persistHistory(next);
      return next;
    });
  }

  function clearHistory() {
    setScanHistory([]);
    try { window.localStorage.removeItem(SCAN_HISTORY_STORAGE_KEY); } catch {}
  }

  async function handleScan(optionalToken, source = 'manual') {
    const token = (optionalToken ?? tokenId).trim();
    if (!token) return;

    const isNft = token.toLowerCase().includes('nft');
    setShowHash(source === 'qr' || isNft);
    setLoading(true);
    setError(null);
    setBatchData(null);

    try {
      const data = await scanApi.getBatchByToken(token);
      setBatchData(data);
      setTokenId(token);
      pushHistoryEntry({
        tokenId: token,
        productName: data.productName || 'Không rõ',
        scannedAt: new Date().toISOString(),
        source,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function stopCameraScan() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  async function startCameraScan() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trinh duyet khong ho tro camera hoac dang khong chay tren localhost/HTTPS.');
      return;
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      mediaStreamRef.current = stream;

      setScanning(true);

      await new Promise(resolve => setTimeout(resolve, 50));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', '');
        videoRef.current.setAttribute('muted', '');
        try { await videoRef.current.play(); } catch {}
      }

      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = window.setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) { stopCameraScan(); await handleScan(barcodes[0].rawValue, 'qr'); }
          } catch {}
        }, 500);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      scanIntervalRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || !ctx || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (result?.data) { stopCameraScan(); await handleScan(result.data, 'qr'); }
        } catch {}
      }, 350);
    } catch (err) {
      setCameraError(err.message || 'Khong the khoi dong camera. Hay kiem tra quyen camera cua trinh duyet.');
      stopCameraScan();
    }
  }

  const panelTabs = [
    { id: 'update', label: 'Cập nhật đơn', icon: 'sync', color: '#10b981' },
    { id: 'issue',  label: 'Báo cáo sự cố', icon: 'report_problem', color: '#ef4444' },
  ];

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(to right, #eff6ff, transparent)', padding: 24, borderRadius: 24 }}>
        <div style={{ background: 'white', padding: 16, borderRadius: 16, boxShadow: '0 4px 10px rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-icons-round" style={{ color: '#3b82f6', fontSize: 32 }}>sync_alt</span>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Cập nhật đơn hàng</div>
          <div style={{ fontSize: 15, color: '#475569', maxWidth: 600, marginTop: 6, lineHeight: 1.5 }}>
            Tra cứu, cập nhật trạng thái và báo cáo sự cố cho lô hàng. Mọi thay đổi được ghi nhận vĩnh viễn trên Blockchain.
          </div>
        </div>
      </div>

      {/* Content: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* LEFT — Lookup + Info */}
        <div className="glass-panel" style={{ padding: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons-round" style={{ color: '#3b82f6' }}>info</span> Thông tin lô hàng
          </div>

          {/* Search Bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <input className="input-premium" value={tokenId} onChange={e => setTokenId(e.target.value)}
              placeholder="Nhập Token ID hoặc mã lô..."
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              style={{ flex: 1, minWidth: 180 }} />
            <button className="btn-gradient" onClick={() => handleScan(undefined, 'manual')} style={{ padding: '12px 20px', fontSize: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-icons-round" style={{ fontSize: 18 }}>search</span> Tra cứu
              </span>
            </button>
            <button onClick={scanning ? stopCameraScan : startCameraScan}
              style={{ padding: '12px 16px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: scanning ? '#fef2f2' : '#eff6ff', color: scanning ? '#ef4444' : '#2563eb', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>{scanning ? 'stop' : 'qr_code_scanner'}</span>
              {scanning ? 'Dừng' : 'QR'}
            </button>
          </div>

          {/* Camera */}
          {scanning && (
            <div style={{ marginBottom: 16 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000' }} />
              <div style={{ marginTop: 8, color: '#2563eb', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-icons-round" style={{ fontSize: 16, animation: 'fadeIn 1s ease-in-out infinite alternate' }}>radio_button_checked</span>
                Đang quét mã QR...
              </div>
            </div>
          )}
          {cameraError && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#b91c1c', fontSize: 13 }}>{cameraError}</div>}

          {loading && <LoadingState message="Đang tra cứu lô hàng..." />}
          {error && <ErrorState message={error} onRetry={() => handleScan(undefined, 'manual')} />}
          {!loading && <BatchInfoPanel data={batchData} showHash={showHash} />}

          <HistoryPanel history={scanHistory} onSelect={handleScan} onClear={clearHistory} />
        </div>

        {/* RIGHT — Actions */}
        <div className="glass-panel" style={{ padding: 28 }}>
          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {panelTabs.map(tab => (
              <button key={tab.id} onClick={() => setActivePanel(tab.id)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 14, border: activePanel === tab.id ? `2px solid ${tab.color}` : '1px solid rgba(255,255,255,0.4)', background: activePanel === tab.id ? (tab.id === 'update' ? '#ecfdf5' : '#fef2f2') : 'rgba(255,255,255,0.6)', color: activePanel === tab.id ? tab.color : '#64748b', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="material-icons-round" style={{ fontSize: 20 }}>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {activePanel === 'update'
            ? <OrderUpdatePanel batchData={batchData} onUpdated={() => handleScan(tokenId, 'manual')} />
            : <IssuePanel batchData={batchData} onSuccess={() => handleScan(tokenId, 'manual')} />
          }
        </div>
      </div>
    </div>
  );
}


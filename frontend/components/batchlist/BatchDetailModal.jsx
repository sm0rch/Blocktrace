// ============================================================
// components/batchlist/BatchDetailModal.jsx
// Modal chi tiết lô hàng: CHỈ XEM timeline chuỗi cung ứng (read-only)
// Chức năng cập nhật/upload ảnh nằm ở trang "Cập nhật đơn hàng"
// ============================================================

const SUPPLY_CHAIN_STEPS = [
  { id: 'minted',       label: 'Khởi tạo',         icon: 'add_circle',     desc: 'Lô hàng được đăng ký trên Blockchain' },
  { id: 'transit',      label: 'Đang vận chuyển',   icon: 'local_shipping', desc: 'Lô hàng rời kho, đang trên đường đi' },
  { id: 'checkpoint',   label: 'Trạm trung chuyển', icon: 'warehouse',      desc: 'Lô hàng tới trạm kiểm tra / trung chuyển' },
  { id: 'delivering',   label: 'Đang giao hàng',    icon: 'delivery_dining',desc: 'Đang giao tới người nhận cuối cùng' },
  { id: 'delivered',    label: 'Đã giao',           icon: 'check_circle',   desc: 'Lô hàng đã giao thành công tới đích' },
];

function getStepIndex(status, custodyLogs) {
  const statusMap = {
    'minted': 0, 'pending': 0, 'created': 0, 'Khởi tạo': 0,
    'transit': 1, 'in_transit': 1, 'Đang vận chuyển': 1, 'Đã rời kho': 1,
    'checkpoint': 2, 'Trạm trung chuyển': 2, 'Tới trạm trung chuyển': 2,
    'delivering': 3, 'Đang giao hàng': 3,
    'delivered': 4, 'Đã giao': 4, 'Đã giao thành công': 4, 'Đã nhận hàng': 4,
  };
  
  if (status !== 'issue' && statusMap[status] !== undefined) {
    return statusMap[status];
  }
  
  if (custodyLogs && custodyLogs.length > 0) {
    let maxIndex = 0;
    for (const log of custodyLogs) {
      const idx = statusMap[log.status];
      if (idx !== undefined && idx > maxIndex) maxIndex = idx;
    }
    return maxIndex;
  }
  
  return 0;
}

function ReadOnlyTimeline({ currentStep, custodyLogs }) {
  const logs = custodyLogs || [];

  return (
    <div style={{ position: 'relative', padding: '0 0 0 32px' }}>
      {/* Vertical Line */}
      <div style={{ position: 'absolute', left: 19, top: 10, bottom: 10, width: 3, background: '#e2e8f0', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 19, top: 10, width: 3, borderRadius: 2, background: 'linear-gradient(to bottom, #10b981, #059669)', height: `${Math.min(100, (currentStep / (SUPPLY_CHAIN_STEPS.length - 1)) * 100)}%`, transition: 'height 0.6s ease' }} />

      {SUPPLY_CHAIN_STEPS.map((step, i) => {
        const isCompleted = i <= currentStep;
        const isCurrent = i === currentStep;
        
        // Tìm log theo id (mới) hoặc label (cũ) để tương thích ngược
        const stepLog = logs.find(l => l.status === step.id || l.status === step.label);

        return (
          <div key={step.id} style={{ position: 'relative', marginBottom: i < SUPPLY_CHAIN_STEPS.length - 1 ? 8 : 0 }}>
            {/* Node */}
            <div style={{ position: 'absolute', left: -32, top: 8, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCompleted ? 'linear-gradient(135deg, #10b981, #059669)' : '#f1f5f9', border: isCompleted ? 'none' : '2px solid #cbd5e1', transition: 'all 0.3s', zIndex: 2 }}>
              <span className="material-icons-round" style={{ fontSize: 14, color: isCompleted ? '#ffffff' : '#94a3b8' }}>
                {isCompleted ? 'check' : step.icon}
              </span>
            </div>

            {/* Content */}
            <div style={{
              padding: '14px 18px', borderRadius: 14, marginBottom: 8,
              background: isCurrent ? '#f0fdf4' : isCompleted ? '#fafafa' : '#fafafa',
              border: isCurrent ? '1px solid #bbf7d0' : '1px solid #f1f5f9',
              transition: 'all 0.3s', opacity: isCompleted ? 1 : 0.45,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isCompleted ? '#065f46' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-icons-round" style={{ fontSize: 18, color: isCompleted ? '#10b981' : '#cbd5e1' }}>{step.icon}</span>
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
                      {/* FIX #6: resolve relative path qua env var, không hardcode localhost */}
                      {(() => {
                        const _base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
                        const _src = stepLog.imageUrl.startsWith('/') ? `${_base}${stepLog.imageUrl}` : stepLog.imageUrl;
                        return (
                          <a href={_src} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                            <img src={_src} alt="Xác nhận" style={{ height: 60, borderRadius: 8, border: '1px solid #e2e8f0', objectFit: 'cover' }} />
                          </a>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {isCompleted && !isCurrent && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', background: '#ecfdf5', padding: '4px 10px', borderRadius: 20 }}>Hoàn thành</span>
                  )}
                  {isCurrent && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 20, animation: 'fadeIn 1s ease-in-out infinite alternate' }}>Hiện tại</span>
                  )}
                  {!isCompleted && !isCurrent && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Chưa đến</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BatchDetailModal({ batch, onClose }) {
  if (!batch) return null;
  const currentStep = getStepIndex(batch.status, batch.custodyLogs);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Backdrop */}
      <div className="animate-fade-in" style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(8px)' }} />

      {/* Modal */}
      <div className="animate-slide-up" style={{ position: 'relative', width: '90%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', padding: 0 }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: '#ffffff', zIndex: 2, padding: '28px 32px 20px', borderBottom: '1px solid #f1f5f9', borderRadius: '24px 24px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-icons-round" style={{ color: 'white', fontSize: 28 }}>inventory_2</span>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{batch.productName}</div>
                <div style={{ fontSize: 14, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{batch.batchCode}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
              <span className="material-icons-round" style={{ color: '#64748b', fontSize: 20 }}>close</span>
            </button>
          </div>

          {/* Info Pills */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {batch.origin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#f8fafc', borderRadius: 20, fontSize: 13, color: '#475569' }}>
                <span className="material-icons-round" style={{ fontSize: 14, color: '#94a3b8' }}>location_on</span> {batch.origin}
              </div>
            )}
            {batch.destination && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#f8fafc', borderRadius: 20, fontSize: 13, color: '#475569' }}>
                <span className="material-icons-round" style={{ fontSize: 14, color: '#94a3b8' }}>flag</span> {batch.destination}
              </div>
            )}
            {batch.quantity && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#f8fafc', borderRadius: 20, fontSize: 13, color: '#475569' }}>
                <span className="material-icons-round" style={{ fontSize: 14, color: '#94a3b8' }}>scale</span> {batch.quantity}
              </div>
            )}
            {batch.expiryDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#f8fafc', borderRadius: 20, fontSize: 13, color: '#475569' }}>
                <span className="material-icons-round" style={{ fontSize: 14, color: '#94a3b8' }}>event</span> HSD: {batch.expiryDate}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px 32px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons-round" style={{ color: '#10b981', fontSize: 22 }}>timeline</span>
            Tiến trình chuỗi cung ứng
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: 28, padding: '16px 20px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Tiến độ tổng thể</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{Math.round((currentStep / (SUPPLY_CHAIN_STEPS.length - 1)) * 100)}%</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 99, width: `${(currentStep / (SUPPLY_CHAIN_STEPS.length - 1)) * 100}%`, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Timeline (read-only) */}
          <ReadOnlyTimeline currentStep={currentStep} custodyLogs={batch.custodyLogs} />

          {/* Completed message */}
          {currentStep >= SUPPLY_CHAIN_STEPS.length - 1 && (
            <div style={{ marginTop: 24, padding: '20px', background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)', borderRadius: 16, textAlign: 'center', border: '1px solid #a7f3d0' }}>
              <span className="material-icons-round" style={{ fontSize: 40, color: '#10b981', marginBottom: 8, display: 'block' }}>verified</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#065f46' }}>Chuỗi cung ứng hoàn tất!</div>
              <div style={{ fontSize: 14, color: '#047857', marginTop: 4 }}>Lô hàng đã được giao thành công và ghi nhận trên Blockchain.</div>
            </div>
          )}

          {/* Hint */}
          {currentStep < SUPPLY_CHAIN_STEPS.length - 1 && (
            <div style={{ marginTop: 24, padding: '16px 20px', background: '#eff6ff', borderRadius: 14, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-icons-round" style={{ color: '#3b82f6', fontSize: 20 }}>info</span>
              <div style={{ fontSize: 14, color: '#1e40af' }}>
                Để cập nhật trạng thái tiếp theo, vui lòng sử dụng trang <strong>"Cập nhật đơn hàng"</strong>.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

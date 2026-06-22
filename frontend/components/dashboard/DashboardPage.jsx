// ============================================================
// components/dashboard/DashboardPage.jsx
// Màn Home — metric cards + bảng lô gần nhất + alerts
// Dữ liệu: dashboardApi.getMetrics / getRecentBatches / getAlerts
// ============================================================

import { useFetch } from '../../hooks/useFetch';
import { dashboardApi } from '../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../shared/StateViews';

// ── Helpers ─────────────────────────────────────────────────
function formatVND(value) {
  if (value == null || isNaN(Number(value))) return '—';
  return Math.round(Number(value)).toLocaleString('vi-VN');
}

// ── Gradient map for MetricCard ─────────────────────────────
const gradientMap = {
  '#15803d': { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: '0 8px 24px -4px rgba(16,185,129,0.35)' },
  '#2563eb': { background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', shadow: '0 8px 24px -4px rgba(59,130,246,0.35)' },
  '#ef4444': { background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', shadow: '0 8px 24px -4px rgba(239,68,68,0.35)' },
  '#f59e0b': { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: '0 8px 24px -4px rgba(245,158,11,0.35)' },
};

// ── Metric Card ─────────────────────────────────────────────
function MetricCard({ label, value, unit, icon, color }) {
  const gradient = gradientMap[color] || { background: `linear-gradient(135deg, ${color} 0%, ${color} 100%)`, shadow: `0 8px 24px -4px ${color}40` };
  return (
    <div className="glass-card animate-slide-up" style={{
      padding: 24,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: gradient.background,
      boxShadow: gradient.shadow,
      borderRadius: 16,
      border: 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontWeight: 500, letterSpacing: 0.3 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
          {value ?? '—'} <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{unit}</span>
        </div>
      </div>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)', position: 'relative', zIndex: 1,
      }}>
        <span className="material-icons-round" style={{ color: '#ffffff', fontSize: 26 }}>{icon}</span>
      </div>
    </div>
  );
}

// ── Metrics Row ─────────────────────────────────────────────
function MetricsRow() {
  const { data, loading, error, refetch } = useFetch(dashboardApi.getMetrics);

  if (loading) return <LoadingState message="Đang tải chỉ số..." />;
  if (error)   return <ErrorState message={error} onRetry={refetch} />;

  // data shape: { totalBatches, inTransit, issueCount, escrowValue, currency }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 28 }}>
      <MetricCard label="Tổng lô hàng"      value={data?.totalBatches} unit="lô"  icon="inventory_2"    color="#15803d" />
      <MetricCard label="Đang vận chuyển"    value={data?.inTransit}    unit="lô"  icon="local_shipping" color="#2563eb" />
      <MetricCard label="Có vấn đề"          value={data?.issueCount}   unit="lô"  icon="warning_amber"  color="#ef4444" />
      <MetricCard label="Giá trị ký quỹ"    value={formatVND(data?.escrowValue)}  unit="₫" icon="account_balance_wallet" color="#f59e0b" />
    </div>
  );
}

// ── Recent Batches Table ─────────────────────────────────────
function RecentBatchesTable() {
  const { data, loading, error, refetch } = useFetch(dashboardApi.getRecentBatches);

  const cols = ['Mã lô', 'Sản phẩm', 'Nông hộ', 'Ngày xuất', 'Trạng thái'];

  return (
    <div className="glass-card animate-slide-up" style={{ padding: 28, marginBottom: 28, animationDelay: '0.1s', borderRadius: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 700, color: '#111827' }}>Lô hàng gần đây</span>
      </div>

      {loading && <LoadingState />}
      {error   && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfeff)' }}>
                {cols.map(c => (
                  <th key={c} style={{
                    padding: '12px 14px', textAlign: 'left',
                    fontWeight: 600, color: '#4b5563', fontSize: 12,
                    borderBottom: '2px solid #e5e7eb', letterSpacing: 0.3,
                  }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data?.length
                ? <tr><td colSpan={cols.length}>
                    <EmptyState icon="inbox" title="Chưa có lô hàng" subtitle="Dữ liệu từ API sẽ hiện ở đây." />
                  </td></tr>
                : data.map(row => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '13px 14px', fontFamily: 'monospace', color: '#15803d', fontWeight: 600 }}>{row.batchCode}</td>
                      <td style={{ padding: '13px 14px', color: '#111827' }}>{row.productName}</td>
                      <td style={{ padding: '13px 14px', color: '#374151' }}>{row.farmName}</td>
                      <td style={{ padding: '13px 14px', color: '#6b7280' }}>{row.exportDate}</td>
                      <td style={{ padding: '13px 14px' }}>
                        <StatusBadge status={row.status} />
                      </td>
                      {/* Hash intentionally hidden in overview; view via Scan/Traceability */}
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    // Các bước chuỗi cung ứng
    minted:     { label: 'Khởi tạo',          color: '#7c3aed', bg: '#f5f3ff' },
    pending:    { label: 'Chờ xác nhận',       color: '#f59e0b', bg: '#fffbeb' },
    transit:    { label: 'Đang vận chuyển',    color: '#2563eb', bg: '#eff6ff' },
    checkpoint: { label: 'Trạm trung chuyển', color: '#0891b2', bg: '#ecfeff' },
    delivering: { label: 'Đang giao hàng',    color: '#ea580c', bg: '#fff7ed' },
    delivered:  { label: 'Đã giao',            color: '#15803d', bg: '#f0fdf4' },
    issue:      { label: 'Có vấn đề',          color: '#ef4444', bg: '#fef2f2' },
  };
  const s = map[status] ?? { label: status ?? '—', color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
      borderLeft: `3px solid ${s.color}`,
    }}>
      {s.label}
    </span>
  );
}

// ── Alerts ────────────────────────────────────────────────────
function AlertsPanel({ onAlertClick }) {
  const { data, loading, error } = useFetch(dashboardApi.getAlerts);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-card animate-slide-up" style={{ padding: 28, animationDelay: '0.2s', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-icons-round" style={{ color: '#ef4444', fontSize: 20 }}>notifications_active</span>
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontFamily: 'Outfit, sans-serif' }}>Cảnh báo</span>
      </div>
      {loading && <LoadingState />}
      {!loading && !data?.length && <EmptyState icon="notifications_none" title="Không có cảnh báo" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data?.map(alert => (
          <div
            key={alert.id}
            onClick={() => onAlertClick && onAlertClick(alert.tokenId)}
            style={{
              display: 'flex', gap: 12, padding: '14px 16px',
              borderLeft: '4px solid #ef4444',
              alignItems: 'flex-start',
              cursor: 'pointer', transition: 'all 0.2s ease',
              borderRadius: 12,
              background: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(254,242,242,0.5)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateX(0)'; }}
          >
            <span className="material-icons-round" style={{
              color: '#ef4444', fontSize: 20, marginTop: 1,
              background: 'rgba(239,68,68,0.08)', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>warning_amber</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{alert.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{alert.message}</div>
            </div>
            {alert.reported_at && (
              <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginTop: 1 }}>
                {formatDate(alert.reported_at)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function DashboardPage({ onAlertClick }) {
  return (
    <div>
      <MetricsRow />
      <RecentBatchesTable />
      <AlertsPanel onAlertClick={onAlertClick} />
    </div>
  );
}

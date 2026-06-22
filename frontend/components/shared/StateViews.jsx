// ============================================================
// components/shared/StateViews.jsx
// 3 trạng thái dùng chung: loading / rỗng / lỗi
// + SkeletonCard / SkeletonRow để tránh layout shift
// ============================================================

// ── Spinner (giữ lại để backward-compat, nhưng nên dùng skeleton thay thế) ──
export function LoadingState({ message = 'Đang tải dữ liệu...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: 16, color: '#6b7280' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb',
        borderTopColor: '#15803d', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 14 }}>{message}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Skeleton primitives ──────────────────────────────────────
// Shimmer keyframe được inject một lần từ App.jsx; dùng lại ở đây.
const SHIMMER = {
  background: 'linear-gradient(90deg, #1e293b 25%, #2d3f55 50%, #1e293b 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeletonShimmer 1.4s ease infinite',
  borderRadius: 6,
};

export function SkeletonBlock({ height = 20, width = '100%', radius = 6, style = {} }) {
  return <div style={{ height, width, borderRadius: radius, ...SHIMMER, ...style }} />;
}

/**
 * SkeletonRow — hàng bảng skeleton (icon + 4 cột text)
 * Chiều cao khớp với row thật, tránh layout shift khi data load xong.
 */
export function SkeletonRow({ cols = 4 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `32px repeat(${cols}, 1fr)`,
      gap: 12, padding: '12px 16px', alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <SkeletonBlock height={32} width={32} radius="50%" />
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBlock key={i} height={14} width={`${60 + (i % 3) * 20}%`} />
      ))}
    </div>
  );
}

/**
 * SkeletonTable — bảng skeleton n hàng
 * Dùng thay LoadingState khi container đã có kích thước xác định.
 */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} cols={cols} />)}
    </div>
  );
}

/**
 * SkeletonCard — card metrics (số lớn + label)
 */
export function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 16,
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <SkeletonBlock height={12} width="40%" />
      <SkeletonBlock height={32} width="55%" />
      <SkeletonBlock height={10} width="70%" />
    </div>
  );
}

// ── Empty & Error (không đổi) ────────────────────────────────
export function EmptyState({ icon = 'inbox', title = 'Chưa có dữ liệu',
  subtitle = 'Dữ liệu sẽ hiển thị ở đây khi có.' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: 12, color: '#9ca3af' }}>
      <span className="material-icons-round" style={{ fontSize: 48 }}>{icon}</span>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>{title}</div>
      <div style={{ fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
      <span className="material-icons-round" style={{ fontSize: 40, color: '#ef4444' }}>error_outline</span>
      <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', maxWidth: 300 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: 8, padding: '8px 20px',
          background: '#15803d', color: 'white', border: 'none', borderRadius: 8,
          fontSize: 13, cursor: 'pointer' }}>
          Thử lại
        </button>
      )}
    </div>
  );
}

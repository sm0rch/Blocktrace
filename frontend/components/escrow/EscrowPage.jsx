// ============================================================
// components/escrow/EscrowPage.jsx
// ============================================================

import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { escrowApi } from '../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../shared/StateViews';

function EscrowBalance() {
  const { data, loading, error, refetch } = useFetch(escrowApi.getBalance);

  // FIX: api.js unwrap() đã chuẩn hoá về flat { total, locked, available, currency }
  // cho cả mock lẫn blockchain controller — dùng trực tiếp data?.total
  const cards = [
    { label: 'Tổng ký quỹ', key: 'total',     gradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', shadow: '0 10px 30px -5px rgba(30,41,59,0.3)' },
    { label: 'Đang khóa',   key: 'locked',     gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)', shadow: '0 10px 30px -5px rgba(239,68,68,0.3)' },
    { label: 'Khả dụng',    key: 'available',  gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', shadow: '0 10px 30px -5px rgba(16,185,129,0.3)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
      {cards.map(c => (
        <div key={c.key} style={{ background: c.gradient, borderRadius: 20, padding: '24px 28px', boxShadow: c.shadow, transition: 'all 0.3s', cursor: 'default' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontWeight: 600 }}>{c.label}</div>
          {loading
            ? <div style={{ height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8 }} />
            : error
            ? <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Lỗi tải</span>
            : <div style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
                {data?.[c.key]?.toLocaleString('vi-VN') ?? '—'}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginLeft: 6 }}>
                  {data?.currency}
                </span>
              </div>
          }
        </div>
      ))}
      {error && (
        <div style={{ gridColumn: '1/-1', textAlign: 'center' }}>
          <ErrorState message={error} onRetry={refetch} />
        </div>
      )}
    </div>
  );
}

function TransactionHistory() {
  // FIX: escrowApi.getTransactions() → paymentApi.getTransactions() → /payments/escrow/transactions
  // unwrap() trong api.js handle cả mock (array thẳng) lẫn blockchain ({ success, data: [...] })
  const { data, loading, error, refetch } = useFetch(escrowApi.getTransactions);

  const cols = ['Ngày', 'Mã giao dịch', 'Lô hàng', 'Loại', 'Số tiền', 'Trạng thái'];

  return (
    <div style={{ ...panelStyle, marginBottom: 24 }}>
      <div style={panelTitle}>Lịch sử giao dịch</div>
      {loading && <LoadingState />}
      {error   && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              {cols.map(c => <th key={c} style={thStyle}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {!data?.length
              ? (
                <tr>
                  <td colSpan={cols.length}>
                    <EmptyState icon="receipt_long" title="Chưa có giao dịch"
                      subtitle="Lịch sử từ API sẽ hiện ở đây." />
                  </td>
                </tr>
              )
              : data.map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={tdStyle}>{tx.date}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{tx.txHash}</td>
                  <td style={tdStyle}>{tx.batchCode}</td>
                  <td style={tdStyle}>{tx.type}</td>
                  <td style={{ ...tdStyle, fontWeight: 600,
                    color: tx.amount >= 0 ? '#15803d' : '#ef4444' }}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount?.toLocaleString('vi-VN')} {tx.currency}
                  </td>
                  <td style={tdStyle}><StatusChip status={tx.status} /></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      )}
    </div>
  );
}

function DisputeList() {
  // /escrow/disputes — chỉ có trên mock server.js, chưa có trong blockchain routes
  // Khi blockchain route được thêm vào, chỉ cần update index.js — api.js không cần đổi
  const { data, loading, error, refetch } = useFetch(escrowApi.getDisputes);

  const [opening, setOpening]   = useState(false);
  const [openErr, setOpenErr]   = useState(null);
  const [openOk,  setOpenOk]    = useState(false);

  async function handleOpenDispute() {
    setOpening(true);
    setOpenErr(null);
    setOpenOk(false);
    try {
      await escrowApi.openDispute({});
      setOpenOk(true);
      refetch();
    } catch (err) {
      // Route POST /escrow/disputes chưa có trên backend — báo rõ thay vì im lặng
      setOpenErr(err.message ?? 'Không thể mở khiếu nại. Tính năng chưa được triển khai.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: openErr || openOk ? 8 : 16 }}>
        <div style={panelTitle}>Tranh chấp</div>
        <button
          onClick={handleOpenDispute}
          disabled={opening}
          style={{ padding: '8px 16px', background: opening ? '#6b7280' : '#15803d',
            color: 'white', border: 'none', borderRadius: 8, fontSize: 13,
            fontWeight: 500, cursor: opening ? 'not-allowed' : 'pointer',
            opacity: opening ? 0.7 : 1 }}
        >
          {opening ? 'Đang xử lý...' : '+ Mở khiếu nại mới'}
        </button>
      </div>

      {openErr && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2',
          borderRadius: 8, fontSize: 12, color: '#ef4444', border: '1px solid #fecaca' }}>
          {openErr}
        </div>
      )}
      {openOk && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4',
          borderRadius: 8, fontSize: 12, color: '#15803d', border: '1px solid #bbf7d0' }}>
          Khiếu nại đã được tạo thành công.
        </div>
      )}
      {loading && <LoadingState />}
      {error   && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && !data?.length && (
        <EmptyState icon="gavel" title="Không có tranh chấp"
          subtitle="Các khiếu nại sẽ hiển thị ở đây." />
      )}
      {data?.map(d => (
        <div key={d.id} style={{ padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{d.batchCode}</span>
            <StatusChip status={d.status} />
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{d.description}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontFamily: 'monospace' }}>{d.txHash}</div>
        </div>
      ))}
    </div>
  );
}

function DemoTransaction({ currentAccount, onTransactionSuccess }) {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  async function handleSend(e) {
    e.preventDefault();
    if (!window.ethereum) return setError('Vui lòng cài MetaMask');
    if (!toAddress || !amount) return;
    setSending(true);
    setError(null);
    setTxHash(null);

    try {
      // Convert ETH to Wei (hex string)
      const weiAmount = '0x' + (parseFloat(amount) * 1e18).toString(16);
      
      const hash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: currentAccount,
          to: toAddress,
          value: weiAmount,
        }],
      });
      
      setTxHash(hash);
      setToAddress('');
      setAmount('');
      
      // Wait for 2s then refresh balance
      setTimeout(() => {
        onTransactionSuccess?.();
      }, 2000);
      
    } catch (err) {
      setError(err.message || 'Giao dịch thất bại');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ ...panelStyle, marginTop: 24, border: '2px solid #3b82f6', background: '#eff6ff' }}>
      <div style={{ ...panelTitle, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span className="material-icons-round">swap_horiz</span> Mô phỏng Giao dịch ETH ảo
      </div>
      <p style={{ fontSize: 13, color: '#3b82f6', marginBottom: 20 }}>
        Thực hiện một giao dịch gửi ETH trực tiếp từ ví MetaMask của bạn đến một ví khác trên mạng Hardhat. Bạn sẽ thấy số dư ở góc trên cùng bên phải giảm đi (bao gồm số lượng ETH + Phí Gas).
      </p>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 2 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Ví nhận</label>
          <input className="input-premium" placeholder="0x..." value={toAddress} onChange={e => setToAddress(e.target.value)} style={{ width: '100%', borderColor: '#bfdbfe' }} required />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Số lượng ETH</label>
          <input type="number" step="0.0001" className="input-premium" placeholder="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', borderColor: '#bfdbfe' }} required />
        </div>
        <button type="submit" disabled={sending} style={{ height: 42, padding: '0 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
          {sending ? 'Đang gửi...' : 'Gửi ETH'}
        </button>
      </form>

      {error && <div style={{ marginTop: 12, color: '#ef4444', fontSize: 13, fontWeight: 500 }}>{error}</div>}
      {txHash && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#dbeafe', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
          <strong>Thành công!</strong> TxHash: <span style={{ fontFamily: 'monospace' }}>{txHash}</span>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    completed: { label: 'Hoàn thành',    color: '#15803d', bg: '#f0fdf4' },
    pending:   { label: 'Đang xử lý',    color: '#f59e0b', bg: '#fffbeb' },
    locked:    { label: 'Đang khóa',     color: '#ef4444', bg: '#fef2f2' },
    resolved:  { label: 'Đã giải quyết', color: '#6b7280', bg: '#f3f4f6' },
  };
  const s = map[status] ?? { label: status ?? '—', color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px',
      borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
  );
}

const panelStyle = { background: '#ffffff', borderRadius: 20, padding: 24, border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)' };
const panelTitle = { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 0, fontFamily: 'Outfit, sans-serif' };
const thStyle    = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12 };
const tdStyle    = { padding: '12px', color: '#374151' };

export default function EscrowPage({ currentAccount, onTransactionSuccess }) {
  return (
    <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 20, background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)', padding: '28px 32px', borderRadius: 24, border: '1px solid rgba(59,130,246,0.1)' }}>
        <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', padding: 0, borderRadius: 16, boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-icons-round" style={{ color: 'white', fontSize: 28 }}>account_balance_wallet</span>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>Ký quỹ & Thanh toán</div>
          <div style={{ fontSize: 15, color: '#475569', maxWidth: 600, marginTop: 6, lineHeight: 1.5 }}>
            Quản lý dòng tiền, khóa ETH vào Smart Contract (Escrow) và lịch sử giao dịch.
          </div>
        </div>
      </div>

      <EscrowBalance />
      {currentAccount && (
        <DemoTransaction currentAccount={currentAccount} onTransactionSuccess={onTransactionSuccess} />
      )}
      <TransactionHistory />
      <DisputeList />
    </div>
  );
}

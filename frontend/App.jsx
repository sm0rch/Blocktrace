// ============================================================
// App.jsx — BlockTrace v2 Premium Redesign (patched)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import DashboardPage from './components/dashboard/DashboardPage';
import ScanPage      from './components/scan/ScanPage';
import EscrowPage    from './components/escrow/EscrowPage';
import BatchListPage from './components/batchlist/BatchListPage';
import CertificateManager from './components/certificates/CertificateManager';

const TABS = [
  { id: 'home',         label: 'Trang chủ',  icon: 'dashboard' },
  { id: 'batchlist',    label: 'Lô hàng',    icon: 'inventory_2' },
  { id: 'certificates', label: 'Chứng chỉ',  icon: 'verified' },
  { id: 'scan',         label: 'Cập nhật',   icon: 'sync_alt' },
  { id: 'escrow',       label: 'Ký quỹ',     icon: 'account_balance_wallet' },
];

// ── Toast ──────────────────────────────────────────────────────
// Simple standalone toast — không phụ thuộc thư viện ngoài
function Toast({ toasts, onRemove }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          pointerEvents: 'auto',
          background: t.type === 'error' ? '#1e1b1b' : '#0f2a1e',
          border: `1px solid ${t.type === 'error' ? '#ef4444' : '#10b981'}`,
          color: t.type === 'error' ? '#fca5a5' : '#6ee7b7',
          padding: '12px 18px', borderRadius: 12, fontSize: 14, fontWeight: 500,
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 10, minWidth: 280, maxWidth: 400,
          animation: 'toastIn 0.25s ease',
        }}>
          <span className="material-icons-round" style={{ fontSize: 18 }}>
            {t.type === 'error' ? 'error_outline' : 'check_circle_outline'}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', opacity: 0.6, padding: 0, lineHeight: 1,
          }}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return { toasts, add, remove };
}

// ── Header ────────────────────────────────────────────────────
function Header({ activeTab, onTabChange, isLoggedIn, onLogin, onLogout, account, balance }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Keyframes injected once */}
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to   { transform: rotate(360deg); } }

        /* Reduced-motion: tắt tất cả animation khi user bật setting */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }

        /* Hamburger mobile nav */
        .bt-nav-mobile {
          display: none;
        }
        @media (max-width: 820px) {
          .bt-nav-desktop { display: none !important; }
          .bt-hamburger   { display: flex !important; }
          .bt-balance      { display: none !important; }
          .bt-nav-mobile.open {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 64px; left: 0; right: 0;
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
            padding: 12px 0 16px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            z-index: 99;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          }
          .bt-nav-mobile.open button {
            width: 100%;
            justify-content: flex-start;
            padding: 10px 24px;
            border-radius: 0;
          }
        }
        @media (min-width: 821px) {
          .bt-hamburger { display: none !important; }
        }
      `}</style>

      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: 64,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 clamp(12px, 3vw, 32px)', zIndex: 100,
        boxShadow: '0 4px 30px rgba(0,0,0,0.15)',
        boxSizing: 'border-box',
      }}>
        {/* Logo */}
        <button onClick={() => { onTabChange('home'); setMenuOpen(false); }} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 800, fontSize: 20, color: '#ffffff', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px',
          flexShrink: 0,
        }}>
          <img src="/logo.png" alt="BlockTrace" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 10, background: 'white', padding: 3 }} />
          <span>Block<span style={{ color: '#34d399' }}>Trace</span></span>
        </button>

        {/* Desktop Navigation */}
        {isLoggedIn && (
          <nav className="bt-nav-desktop" style={{ display: 'flex', gap: 4, height: '100%', alignItems: 'center', overflow: 'hidden' }}>
            {TABS.map(t => {
              const isActive = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => onTabChange(t.id)}
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))'
                      : 'transparent',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#34d399' : 'rgba(255,255,255,0.6)',
                    height: 40, display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 14px', borderRadius: 10,
                    transition: 'all 0.25s',
                    fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}}
                >
                  <span className="material-icons-round" style={{ fontSize: 18 }}>{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isLoggedIn && account && (
            <div className="bt-balance" style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(255,255,255,0.08)', padding: '7px 14px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <span style={{ color: '#34d399' }}>{balance} ETH</span>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
          )}

          {/* Hamburger (mobile only) */}
          {isLoggedIn && (
            <button className="bt-hamburger" onClick={() => setMenuOpen(o => !o)} style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'white', borderRadius: 8, padding: '6px 8px',
              cursor: 'pointer', display: 'none', alignItems: 'center',
            }}>
              <span className="material-icons-round">{menuOpen ? 'close' : 'menu'}</span>
            </button>
          )}

          <button onClick={isLoggedIn ? onLogout : onLogin}
            style={{
              background: isLoggedIn
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              color: 'white', padding: '9px 18px', borderRadius: 10,
              fontSize: 13, fontWeight: 700, border: isLoggedIn ? '1px solid rgba(255,255,255,0.15)' : 'none',
              cursor: 'pointer', transition: 'all 0.25s',
              fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap',
              boxShadow: isLoggedIn ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'brightness(1)'; }}
          >
            {isLoggedIn ? 'Đăng xuất' : '🔗 Kết nối ví'}
          </button>
        </div>
      </header>

      {/* Mobile dropdown nav */}
      {isLoggedIn && (
        <nav className={`bt-nav-mobile${menuOpen ? ' open' : ''}`}>
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => { onTabChange(t.id); setMenuOpen(false); }}
                style={{
                  background: isActive ? 'rgba(16,185,129,0.12)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#34d399' : 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontFamily: 'Outfit, sans-serif',
                  transition: 'background 0.2s',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: 20 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
          {account && (
            <div style={{
              margin: '8px 24px 0', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 8,
            }}>
              <span style={{ color: '#34d399' }}>{balance} ETH</span>
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
          )}
        </nav>
      )}
    </>
  );
}

// ── Landing Page ──────────────────────────────────────────────
// FIX #7: giảm animation nặng — blur nhỏ hơn, dùng will-change, animation chỉ chạy
//          khi không có prefers-reduced-motion. Orb thứ ba (overlap center) bị loại bỏ.
function LandingPage({ onLogin }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 35%, #0f766e 70%, #064e3b 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 24px', position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes floatA { 0%,100% { transform: translateY(0);    } 50% { transform: translateY(-18px); } }
        @keyframes floatB { 0%,100% { transform: translateY(0);    } 50% { transform: translateY( 14px); } }
        @keyframes pulseG { 0%,100% { box-shadow: 0 20px 50px rgba(16,185,129,0.25); }
                            50%     { box-shadow: 0 20px 60px rgba(16,185,129,0.45); } }
        @media (prefers-reduced-motion: no-preference) {
          .orb-a  { animation: floatA 7s ease-in-out infinite; will-change: transform; }
          .orb-b  { animation: floatB 9s ease-in-out infinite; will-change: transform; }
          .logo-pulse { animation: pulseG 3s ease-in-out infinite; }
        }
      `}</style>

      {/* Decorative orbs — blur nhỏ hơn, chỉ còn 2 */}
      <div className="orb-a" style={{
        position: 'absolute', top: '12%', left: '8%', width: 240, height: 240,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        filter: 'blur(24px)', pointerEvents: 'none',
      }} />
      <div className="orb-b" style={{
        position: 'absolute', bottom: '16%', right: '8%', width: 300, height: 300,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)',
        filter: 'blur(28px)', pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div className="logo-pulse" style={{
        width: 90, height: 90, borderRadius: 28,
        background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32, padding: 0, overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(16,185,129,0.25)',
      }}>
        <img src="/logo.png" alt="BlockTrace" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <h1 style={{
        fontSize: 'clamp(36px, 8vw, 72px)', fontWeight: 900, color: '#ffffff', lineHeight: 1.1,
        maxWidth: 700, marginBottom: 24, fontFamily: 'Outfit, sans-serif',
        letterSpacing: '-2px', position: 'relative', zIndex: 1,
      }}>
        Smart Tracking for{' '}
        <span style={{
          background: 'linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #818cf8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Agriculture
        </span>
      </h1>

      <p style={{
        fontSize: 'clamp(15px, 2.5vw, 20px)', color: 'rgba(255,255,255,0.6)', maxWidth: 560,
        marginBottom: 48, lineHeight: 1.7, position: 'relative', zIndex: 1,
      }}>
        Hệ thống truy xuất nguồn gốc nông sản trên blockchain — minh bạch, bất biến, tự động.
      </p>

      <button onClick={onLogin} style={{
        background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
        color: 'white', border: 'none', padding: '18px 48px', borderRadius: 16,
        fontSize: 18, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 20px 50px rgba(16, 185, 129, 0.35)',
        transition: 'all 0.3s', fontFamily: 'Outfit, sans-serif',
        position: 'relative', zIndex: 1, letterSpacing: '0.3px',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 25px 60px rgba(16, 185, 129, 0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 20px 50px rgba(16, 185, 129, 0.35)'; }}
      >
        🔗 Kết nối ví để bắt đầu
      </button>

      <div style={{ display: 'flex', gap: 'clamp(24px, 6vw, 48px)', marginTop: 80, position: 'relative', zIndex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { val: '500+',  label: 'Lô hàng', color: '#34d399' },
          { val: '50+',   label: 'Nông hộ', color: '#22d3ee' },
          { val: '99.9%', label: 'Uptime',  color: '#818cf8' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, fontFamily: 'Outfit' }}>{s.val}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton loader — thay thế spinner LoadingState ───────────
// Dùng bên trong từng page nếu cần; export để import ở nơi khác
export function SkeletonBlock({ height = 24, width = '100%', radius = 8, style = {} }) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: 'linear-gradient(90deg, #1e293b 25%, #2d3f55 50%, #1e293b 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.4s ease infinite',
      ...style,
    }} />
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  // FIX #1: khởi tạo từ localStorage, không về landing khi reload
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('bt_loggedIn') === 'true');
  const [activeTab,  setActiveTab]  = useState('home');
  const [accounts,   setAccounts]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('bt_accounts') || '[]'); } catch { return []; }
  });
  const [balance,    setBalance]    = useState('0.00');
  const [scanToken,  setScanToken]  = useState('');

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const fetchBalance = useCallback(async (address) => {
    if (!window.ethereum || !address) return;
    try {
      const balHex = await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] });
      setBalance((parseInt(balHex, 16) / 1e18).toFixed(4));
    } catch (e) {
      console.error('Failed to fetch balance', e);
    }
  }, []);

  // Re-fetch balance on mount nếu đã đăng nhập
  useEffect(() => {
    if (isLoggedIn && accounts[0]) {
      fetchBalance(accounts[0]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lắng nghe khi user đổi account trong MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (newAccounts) => {
      if (newAccounts.length === 0) {
        handleLogout();
      } else {
        setAccounts(newAccounts);
        localStorage.setItem('bt_accounts', JSON.stringify(newAccounts));
        fetchBalance(newAccounts[0]);
      }
    };
    window.ethereum.on('accountsChanged', handler);
    return () => window.ethereum.removeListener('accountsChanged', handler);
  }, [fetchBalance]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX #4: thay alert() bằng toast
  const handleLogin = async () => {
    try {
      if (window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        const result = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (result && result.length > 0) {
          setAccounts(result);
          setIsLoggedIn(true);
          setActiveTab('home');
          fetchBalance(result[0]);
          // FIX #1: lưu phiên đăng nhập
          localStorage.setItem('bt_loggedIn', 'true');
          localStorage.setItem('bt_accounts', JSON.stringify(result));
        }
      } else {
        addToast('Vui lòng cài đặt MetaMask hoặc ví Web3 khác', 'error');
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      addToast('Lỗi kết nối ví: ' + error.message, 'error');
    }
  };

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
    setActiveTab('home');
    setAccounts([]);
    setBalance('0.00');
    localStorage.removeItem('bt_loggedIn');
    localStorage.removeItem('bt_accounts');
  }, []);

  const PAGE_MAP = {
    home:         <DashboardPage onAlertClick={(token) => { setScanToken(token); setActiveTab('scan'); }} />,
    batchlist:    <BatchListPage onScanRequested={(token) => { setScanToken(token); setActiveTab('scan'); }} />,
    certificates: <CertificateManager />,
    scan:         <ScanPage initialToken={scanToken} onClearToken={() => setScanToken('')} />,
    escrow:       <EscrowPage currentAccount={accounts[0]} onTransactionSuccess={() => fetchBalance(accounts[0])} />,
  };

  return (
    <>
      {/* Global skeleton shimmer keyframe */}
      <style>{`@keyframes skeletonShimmer { to { background-position: -200% 0; } }`}</style>

      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isLoggedIn={isLoggedIn}
        onLogin={handleLogin}
        onLogout={handleLogout}
        account={accounts[0]}
        balance={balance}
      />

      <main style={{ paddingTop: isLoggedIn ? 64 : 0, minHeight: '100vh', background: isLoggedIn ? 'var(--page-bg)' : 'transparent' }}>
        {!isLoggedIn
          ? <LandingPage onLogin={handleLogin} />
          : <div style={{ padding: '32px 4%', maxWidth: 1360, margin: '0 auto' }}>
              {PAGE_MAP[activeTab]}
            </div>
        }
      </main>

      {/* FIX #4: Toast container */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  );
}

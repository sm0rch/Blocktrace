// ============================================================
// components/certificates/CertificateManager.jsx
// ============================================================

import { useState, useEffect } from 'react';
import { certificateApi } from '../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../shared/StateViews';

function CertificateForm({ onSubmit, onCancel, initialData = null }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    issuer: initialData?.issuer || '',
    cert_type: initialData?.cert_type || 'General',
    expiry_date: initialData?.expiry_date || '',
    description: initialData?.description || '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card animate-slide-up" style={{ 
      padding: 24, 
      marginBottom: 24,
    }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
          Tên chứng chỉ *
        </label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="VD: VietGAP, GlobalGAP, Organic"
          required
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
          Tổ chức cấp chứng chỉ *
        </label>
        <input
          type="text"
          name="issuer"
          value={form.issuer}
          onChange={handleChange}
          placeholder="VD: Bộ Nông Nghiệp, GlobalGAP Organization"
          required
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
            Loại chứng chỉ
          </label>
          <select
            name="cert_type"
            value={form.cert_type}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          >
            <option value="General">Tổng quát</option>
            <option value="Food Safety">An toàn thực phẩm</option>
            <option value="Environmental">Môi trường</option>
            <option value="Organic">Hữu cơ</option>
            <option value="Fair Trade">Thương mại công bằng</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
            Ngày hết hạn
          </label>
          <input
            type="date"
            name="expiry_date"
            value={form.expiry_date}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
          Mô tả
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Thêm ghi chú về chứng chỉ..."
          rows={3}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: 13,
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={loading}
          className="btn-gradient"
          style={{
            padding: '10px 20px',
            fontSize: 14,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Đang lưu...' : 'Lưu chứng chỉ'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

export default function CertificateManager() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const data = await certificateApi.list({ search });
      setCertificates(data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const handleEditClick = (cert) => {
    setEditingId(cert.cert_id);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingId) {
        await certificateApi.update(editingId, formData);
      } else {
        await certificateApi.create(formData);
      }
      setShowForm(false);
      setEditingId(null);
      await fetchCertificates();
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async (certId) => {
    if (!confirm('Xác nhận xóa chứng chỉ này?')) return;
    try {
      await certificateApi.delete(certId);
      await fetchCertificates();
    } catch (err) {
      setError(err.message);
    }
  };

  const editingCert = editingId ? certificates.find(c => c.cert_id === editingId) : null;

  if (error && !showForm) {
    return <ErrorState title="Lỗi tải chứng chỉ" subtitle={error} />;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Quản lý chứng chỉ/chứng nhận</h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
          Thêm, chỉnh sửa, và quản lý chứng chỉ sản phẩm cho các lô hàng
        </p>

        {showForm && (
          <CertificateForm
            onSubmit={handleFormSubmit}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
            initialData={editingCert}
          />
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Tìm chứng chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyUp={() => fetchCertificates()}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          {!showForm && (
            <button
              onClick={handleAddClick}
              className="btn-gradient"
              style={{ padding: '10px 20px', fontSize: 14 }}
            >
              + Thêm chứng chỉ
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : certificates.length === 0 ? (
        <EmptyState
          icon="verified"
          title="Chưa có chứng chỉ"
          subtitle="Thêm chứng chỉ đầu tiên cho sản phẩm"
        />
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: 12,
        }}>
          {certificates.map(cert => (
            <div
              key={cert.cert_id}
              className="glass-card animate-fade-in"
              style={{
                padding: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {cert.name}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  Cấp bởi: {cert.issuer}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Loại: {cert.cert_type}
                  {cert.expiry_date && ` • Hết hạn: ${cert.expiry_date}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleEditClick(cert)}
                  style={{
                    padding: '6px 12px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Sửa
                </button>
                <button
                  onClick={() => handleDelete(cert.cert_id)}
                  style={{
                    padding: '6px 12px',
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

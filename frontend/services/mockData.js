const mockBatches = [
  {
    id: 'NFT_00001',
    batchCode: 'NFT_00001',
    tokenId: 'NFT_00001',
    productName: 'Gạo ST25',
    farmName: 'HTX Nông Nghiệp Xanh 6',
    exportDate: '2026-03-26',
    status: 'transit',
    hash: '0x5f4d1179a2cf138699c6e49690f1ca413826b7044d134c9c3132420c9de77464',
    quantity: '1.200 kg',
    origin: 'Sơn La',
    destination: 'VinMart Retail',
    type: 'rice',
    facility: 'HTX Nông Nghiệp Xanh 6',
    mfgDate: '2026-03-26',
    expDate: '2026-09-26',
    carrier: 'ColdChain Express',
    trackingCode: 'TX_00001',
    qrUrl: 'https://example.com/qr/NFT_00001',
    producerEmail: 'contact@farm6.vn',
    ipfsCID: 'QmnRwJHBj1Y43UJTLNqq89dmf9j6ddPuL3fSH6A2dmJee5',
  },
  {
    id: 'NFT_00008',
    batchCode: 'NFT_00008',
    tokenId: 'NFT_00008',
    productName: 'Cà phê Robusta',
    farmName: 'HTX Nông Nghiệp Xanh 2',
    exportDate: '2026-04-02',
    status: 'delivered',
    hash: '0x0f8a6df6e0441827d5814368c9a89ab04ce522a1bf1867245f9e2c0176963851',
    quantity: '850 kg',
    origin: 'Lâm Đồng',
    destination: 'Co.op Mart',
    type: 'coffee',
    facility: 'Kho sơ chế Lâm Đồng',
    mfgDate: '2026-03-20',
    expDate: '2027-03-20',
    carrier: 'Vận Tải Thành Công',
    trackingCode: 'TX_00008',
    qrUrl: 'https://example.com/qr/NFT_00008',
    producerEmail: 'contact@farm2.vn',
    ipfsCID: 'QmRc6eg2Wb71ibqu8WMUdB838aWeMaY9UbHyXf9EpZ4Lye',
  },
  {
    id: 'NFT_00011',
    batchCode: 'NFT_00011',
    tokenId: 'NFT_00011',
    productName: 'Sầu riêng Ri6',
    farmName: 'HTX Nông Nghiệp Xanh 10',
    exportDate: '2026-03-22',
    status: 'issue',
    hash: '0xae4aa2b18a52bffe1a804f5c3f24c88b8ae9922b9eb05bf9cc33fce3a97cc862',
    quantity: '430 kg',
    origin: 'Bến Tre',
    destination: 'Bách Hóa Xanh',
    type: 'fruit',
    facility: 'Trạm đóng gói Bến Tre',
    mfgDate: '2026-03-03',
    expDate: '2026-04-03',
    carrier: 'Chuỗi Lạnh Á Châu',
    trackingCode: 'TX_00011',
    qrUrl: 'https://example.com/qr/NFT_00011',
    producerEmail: 'contact@farm10.vn',
    ipfsCID: 'QmncAPtkNXBiXVxUaeneDtTEDRNAqF5kJXE3WLTSNVG2SG',
  },
  {
    id: 'NFT_00006',
    batchCode: 'NFT_00006',
    tokenId: 'NFT_00006',
    productName: 'Thanh long đỏ',
    farmName: 'HTX Nông Nghiệp Xanh 2',
    exportDate: '2026-03-21',
    status: 'pending',
    hash: '0x9aa7ba100f13865fb89bead9f4b3735f5ea04ffd13af05fc3d89d3cc94ff8c1d',
    quantity: '620 kg',
    origin: 'Bình Thuận',
    destination: 'Aeon Việt Nam',
    type: 'fruit',
    facility: 'Nhà đóng gói Bình Thuận',
    mfgDate: '2026-03-08',
    expDate: '2026-04-08',
    carrier: 'Logistics Toàn Cầu',
    trackingCode: 'TX_00006',
    qrUrl: 'https://example.com/qr/NFT_00006',
    producerEmail: 'contact@farm2.vn',
    ipfsCID: 'Qmbk8wrtjGr2ygcgt1RgerKqQ8XVX3i3vXKPLtozEgxvCL',
  },
];

let notifications = [
  {
    id: 'n1',
    type: 'info',
    title: 'Lô hàng mới cập nhật',
    message: 'Một lô hàng đang chờ xác nhận ký quỹ.',
  },
  {
    id: 'n2',
    type: 'warning',
    title: 'Giao hàng chậm',
    message: 'Một lô hàng có nguy cơ trễ do vận chuyển.',
  },
];

let disputes = [
  {
    id: 'DSP_001',
    batchCode: 'NFT_00011',
    status: 'pending',
    description: 'Nghi vấn đứt gãy chuỗi lạnh trong quá trình vận chuyển.',
    txHash: '0x82aa91f3c7b3',
  },
];

const escrowTransactions = [
  {
    id: 'PAY_001',
    date: '2026-04-02',
    txHash: '0xpay1001',
    batchCode: 'NFT_00001',
    type: 'Deposit',
    amount: 12500000,
    currency: 'VND',
    status: 'pending',
  },
  {
    id: 'PAY_002',
    date: '2026-04-05',
    txHash: '0xpay1002',
    batchCode: 'NFT_00008',
    type: 'Release',
    amount: 9800000,
    currency: 'VND',
    status: 'completed',
  },
];

function includes(value, search) {
  return String(value || '').toLowerCase().includes(search.toLowerCase());
}

function listBatches(searchParams) {
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';

  return mockBatches.filter(batch => {
    const matchesSearch = search
      ? [batch.batchCode, batch.productName, batch.farmName, batch.origin, batch.destination]
          .some(field => includes(field, search))
      : true;
    const matchesType = type ? batch.type === type : true;
    const matchesStatus = status ? batch.status === status : true;
    return matchesSearch && matchesType && matchesStatus;
  });
}

function getMetrics() {
  return {
    totalBatches: mockBatches.length,
    inTransit: mockBatches.filter(batch => batch.status === 'transit').length,
    issueCount: mockBatches.filter(batch => batch.status === 'issue').length,
    escrowValue: 22300000,
    currency: 'VND',
  };
}

function getAlerts() {
  return mockBatches
    .filter(batch => batch.status === 'issue')
    .map(batch => ({
      id: `alert-${batch.id}`,
      title: `Sự cố ${batch.productName}`,
      message: `${batch.batchCode} cần kiểm tra trước khi giải ngân.`,
    }));
}

function getEscrowBalance() {
  return {
    total: 22300000,
    locked: 12500000,
    available: 9800000,
    currency: 'VND',
  };
}

function parseBody(options) {
  if (!options?.body || typeof options.body !== 'string') return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

export function getMockResponse(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(path, 'http://blocktrace.local');
  const route = url.pathname;

  if (method === 'GET' && route === '/dashboard/metrics') return getMetrics();
  if (method === 'GET' && route === '/dashboard/recent-batches') return mockBatches.slice(0, 5);
  if (method === 'GET' && route === '/dashboard/alerts') return getAlerts();
  if (method === 'GET' && route === '/batches') return listBatches(url.searchParams);
  if (method === 'GET' && route === '/batches/notifications') return notifications;

  if (method === 'DELETE' && route.startsWith('/batches/notifications/')) {
    const id = route.split('/').pop();
    notifications = notifications.filter(item => item.id !== id);
    return { success: true };
  }

  if (method === 'GET' && route.startsWith('/scan/')) {
    const tokenId = route.split('/').pop();
    const batch = mockBatches.find(item => item.tokenId === tokenId || item.batchCode === tokenId);
    if (!batch) throw new Error(`Mock token ${tokenId} không tồn tại.`);
    return {
      tokenId: batch.tokenId,
      productName: batch.productName,
      batchCode: batch.batchCode,
      quantity: batch.quantity,
      facility: batch.facility,
      origin: batch.origin,
      mfgDate: batch.mfgDate,
      expDate: batch.expDate,
      carrier: batch.carrier,
      trackingCode: batch.trackingCode,
      hash: batch.hash,
      qrUrl: batch.qrUrl,
      producerEmail: batch.producerEmail,
      ipfsCID: batch.ipfsCID,
    };
  }

  if (method === 'POST' && route === '/scan/report-issue') {
    const body = parseBody(options);
    return {
      success: true,
      report: {
        issue_id: `ISSUE_${Date.now()}`,
        tokenId: body.tokenId,
        issue_type: body.issueType || 'other',
        issue_status: 'Open',
        evidence_hash: body.evidenceHash || null,
      },
    };
  }

  if (method === 'GET' && route === '/payments/escrow/balance') return getEscrowBalance();
  if (method === 'GET' && route === '/payments/escrow/transactions') return escrowTransactions;
  if (method === 'GET' && route === '/escrow/disputes') return disputes;

  if (method === 'POST' && route === '/escrow/disputes') {
    const body = parseBody(options);
    const dispute = {
      id: `DSP_${Date.now()}`,
      batchCode: body.batchCode || body.tokenId || mockBatches[0].batchCode,
      status: 'pending',
      description: body.description || 'Khiếu nại được tạo từ mock frontend.',
      txHash: null,
    };
    disputes = [dispute, ...disputes];
    return { success: true, dispute };
  }

  if (method === 'POST' && route === '/payments/lock') {
    return { success: true, txHash: `0xmocklock${Date.now()}` };
  }

  throw new Error(`Không có mock handler cho ${method} ${route}.`);
}


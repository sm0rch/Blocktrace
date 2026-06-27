# Blocktrace

### Blockchain-powered Product Traceability Platform

Blocktrace là nền tảng truy xuất nguồn gốc sản phẩm ứng dụng công nghệ Blockchain, giúp ghi nhận, xác thực và theo dõi toàn bộ vòng đời sản phẩm từ khâu sản xuất đến phân phối. Hệ thống cung cấp khả năng minh bạch hóa chuỗi cung ứng, hỗ trợ xác thực thông tin sản phẩm thông qua QR Code và lưu trữ dữ liệu trên Blockchain Ethereum.

---

## 🚀 Tính năng chính

### 📦 Quản lý sản phẩm
- Tạo và quản lý lô sản phẩm
- Sinh mã định danh duy nhất cho từng lô hàng
- Cập nhật thông tin sản xuất và phân phối
- Theo dõi trạng thái sản phẩm theo thời gian thực

### 🔍 Truy xuất nguồn gốc
- Quét QR Code để tra cứu thông tin
- Hiển thị lịch sử di chuyển của sản phẩm
- Kiểm tra tính xác thực của dữ liệu
- Theo dõi toàn bộ vòng đời sản phẩm

### 💰 Ký quỹ và xác thực giao dịch
- Hỗ trợ cơ chế ký quỹ (Escrow)
- Ghi nhận giao dịch trên Blockchain
- Theo dõi trạng thái thanh toán và xác thực

### ⛓️ Tích hợp Blockchain
- Lưu trữ dữ liệu trên Ethereum
- Tạo Transaction Hash cho từng giao dịch
- Liên kết trực tiếp với Etherscan
- Đảm bảo tính minh bạch và bất biến của dữ liệu

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| **Frontend** | React, Vite, React Router, Ethers.js, jsQR |
| **Backend** | Node.js, Express.js, RESTful API |
| **Blockchain** | Solidity, Hardhat, Ethereum Sepolia, MetaMask |
| **Lưu trữ** | File-based Database, Smart Contract Storage |

---

## 📋 Yêu cầu hệ thống

| Thành phần | Phiên bản khuyến nghị |
|---|---|
| Node.js | 18.x trở lên |
| npm | 9.x trở lên |
| Git | Phiên bản mới nhất |
| MetaMask | Extension trình duyệt |
| Trình duyệt | Chrome / Edge |

Kiểm tra phiên bản hiện tại:

```bash
node -v
npm -v
git --version
```

---

## 📦 Cài đặt và khởi chạy

### Bước 1: Clone mã nguồn

```bash
git clone https://github.com/sm0rch/Blocktrace.git
cd Blocktrace
```

### Bước 2: Xác nhận cấu trúc dự án

Sau khi clone thành công, thư mục dự án cần có cấu trúc:

```
Blocktrace/
├── backend/
├── frontend/
├── hardhat/
└── README.md
```

### Bước 3: Cài đặt Backend

```bash
cd backend
npm install
```

### Bước 4: Cài đặt Frontend

```bash
cd ../frontend
npm install
```

### Bước 5: Cài đặt môi trường Blockchain

```bash
cd ../hardhat
npm install
```

Nếu cần biên dịch lại Smart Contract:

```bash
npx hardhat compile
```

### Bước 6: Build Frontend cho Production

```bash
cd ../frontend
npm run build
```

### Bước 7: Chạy dự án

```bash
cd ../backend
npm start
```

Dự án sẽ chạy tại: `http://localhost:4000`

---

## 📖 Hướng dẫn sử dụng

### 1. Truy cập hệ thống
Mở trình duyệt và truy cập: `http://localhost:4000`

### 2. Kết nối ví MetaMask
- Nhấn **Kết nối ví**
- Chọn tài khoản MetaMask
- Xác nhận kết nối
- Kiểm tra địa chỉ ví hiển thị trên giao diện

### 3. Tạo lô sản phẩm
- Truy cập mục **Lô hàng**
- Nhập thông tin sản phẩm
- Tạo mã định danh
- Xác nhận giao dịch Blockchain

### 4. Quản lý chứng nhận
- Truy cập mục **Chứng chỉ**
- Tải lên hoặc cập nhật chứng nhận
- Liên kết chứng nhận với lô hàng tương ứng

### 5. Cập nhật trạng thái sản phẩm
- Truy cập mục **Cập nhật**
- Quét QR Code hoặc nhập mã lô hàng
- Cập nhật trạng thái mới
- Xác nhận giao dịch Blockchain

### 6. Tra cứu nguồn gốc
- Quét QR Code sản phẩm
- Xem lịch sử di chuyển
- Kiểm tra thông tin sản xuất
- Xác minh dữ liệu trên Blockchain

### 7. Quản lý ký quỹ
- Truy cập mục **Ký quỹ**
- Theo dõi giao dịch ký quỹ
- Kiểm tra trạng thái thanh toán
- Xác thực giao dịch Blockchain

---

## 📁 Cấu trúc dự án

```
Blocktrace/
│
├── 📂 hardhat/                          # Blockchain & Smart Contracts
│   ├── contracts/
│   │   └── Counter.sol                  # Smart contract chính
│   ├── ignition/
│   │   ├── modules/
│   │   │   └── Counter.ts               # Module deploy contract
│   │   └── deployments/                 # Lịch sử deploy
│   ├── hardhat.config.ts                # Cấu hình Hardhat
│   └── .env                             # RPC URL, Private Key, API Keys
│
├── 📂 backend/                          # Backend API (Node.js + Express)
│   ├── services/
│   │   ├── blockchain.js                # Tương tác Ethereum Blockchain
│   │   └── database.js                  # Xử lý dữ liệu hệ thống
│   ├── uploads/                         # Lưu trữ file upload
│   ├── data/                            # Dữ liệu file-based
│   ├── dist/                            # Frontend build output
│   ├── server.js                        # Entry point của backend
│   └── .env                             # Cấu hình môi trường
│
├── 📂 frontend/                         # React + Vite Application
│   ├── components/
│   │   ├── dashboard/                   # Dashboard tổng quan
│   │   ├── batchlist/                   # Quản lý lô hàng
│   │   ├── certificates/                # Quản lý chứng nhận
│   │   ├── scan/                        # Quét QR & cập nhật trạng thái
│   │   └── escrow/                      # Quản lý ký quỹ
│   ├── App.jsx                          # Router & Layout chính
│   └── vite.config.js                   # Cấu hình Vite & API Proxy
│
├── README.md
├── package.json
└── package-lock.json
```

---

## 🏗️ Kiến trúc hệ thống

| Thành phần | Vai trò |
|---|---|
| **Frontend** | Giao diện người dùng, quản lý lô hàng, chứng nhận, QR và ký quỹ |
| **Backend** | Xử lý API, lưu trữ dữ liệu và kết nối Blockchain |
| **Hardhat** | Quản lý Smart Contract, biên dịch và triển khai lên Ethereum |
| **Ethereum Sepolia** | Mạng Blockchain dùng để ghi nhận và xác thực dữ liệu |
| **MetaMask** | Xác thực người dùng và ký giao dịch Blockchain |

### 🔄 Luồng hoạt động

```
Frontend (React)
      │
      ▼
Backend API (Express)
      │
      ▼
Blockchain Service
      │
      ▼
Ethereum Sepolia
      │
      ▼
Smart Contract (Counter.sol)
```

Frontend gửi yêu cầu đến Backend, Backend thực hiện xử lý nghiệp vụ và tương tác với Smart Contract trên Ethereum để lưu trữ hoặc xác thực dữ liệu. Các giao dịch được ghi nhận trên Blockchain và có thể truy xuất công khai thông qua Transaction Hash.

---

## 🔒 Bảo mật

### Smart Contract Security
- Sử dụng cơ chế phân quyền để kiểm soát các thao tác quan trọng trên Blockchain
- Chỉ các tài khoản được cấp quyền mới có thể thực hiện các hành động nhạy cảm như cập nhật trạng thái hoặc xác nhận giao dịch
- Toàn bộ giao dịch được ghi nhận thông qua Transaction Hash và có thể xác minh công khai

### Data Integrity
- Các giao dịch và dữ liệu xác thực được lưu trữ trên Blockchain Ethereum
- Dữ liệu sau khi ghi nhận không thể bị chỉnh sửa hoặc xóa bỏ
- Mọi thay đổi đều được lưu vết và có thể truy xuất lịch sử

### Wallet Authentication
- Người dùng xác thực thông qua MetaMask
- Các giao dịch yêu cầu chữ ký số từ chủ sở hữu ví
- Không lưu trữ Private Key trên hệ thống

### Environment Security
- Thông tin nhạy cảm được quản lý thông qua file `.env`
- Không commit Private Key hoặc API Key lên GitHub
- Khuyến nghị sử dụng ví Sepolia riêng cho môi trường thử nghiệm

---

## 🚀 Deployment

### Development Environment

```
Backend  : http://localhost:4000
Frontend : http://localhost:5173
```

Các thành phần cần hoạt động:
- Backend API Server
- Frontend React Application
- Ethereum Sepolia RPC
- Smart Contract đã được deploy

### Testnet Deployment (Sepolia)

1. Cấu hình RPC URL và Private Key trong file `.env`
2. Compile Smart Contract:

```bash
cd hardhat
npx hardhat compile
```

3. Deploy Smart Contract:

```bash
npx hardhat ignition deploy ./ignition/modules/Counter.ts --network sepolia
```

4. Cập nhật địa chỉ Contract vào Backend
5. Khởi động Backend và Frontend
6. Kiểm tra kết nối MetaMask và thực hiện giao dịch thử nghiệm

### Production Deployment

Trước khi triển khai môi trường thực tế:
- Kiểm tra toàn bộ chức năng nghiệp vụ
- Kiểm tra quyền truy cập Smart Contract
- Xác thực cấu hình Blockchain
- Kiểm tra cơ chế Escrow và Transaction Tracking

Build Frontend Production:

```bash
cd frontend
npm run build
```

Sau khi build thành công, thư mục `dist/` sẽ được sử dụng để phục vụ ứng dụng trong môi trường triển khai.

---

## 🤝 Đóng góp

Đóng góp cho dự án luôn được chào đón.

### Quy trình đóng góp

1. Fork repository
2. Tạo branch mới:

```bash
git checkout -b feature/feature-name
```

3. Thực hiện thay đổi và commit:

```bash
git commit -m "feat: add new feature"
```

4. Push lên repository của bạn:

```bash
git push origin feature/feature-name
```

5. Tạo Pull Request để đề xuất thay đổi

### Quy ước Commit

```
feat:     thêm tính năng mới
fix:      sửa lỗi
docs:     cập nhật tài liệu
style:    chỉnh sửa giao diện
refactor: tái cấu trúc mã nguồn
```

---

## 📄 License

Dự án được phát hành dưới giấy phép [MIT License](LICENSE).

Bạn được phép sử dụng, chỉnh sửa, phân phối và phát triển tiếp dự án theo các điều khoản của giấy phép MIT.

---

## 📬 Liên hệ

Nếu có câu hỏi, góp ý hoặc báo cáo lỗi, vui lòng liên hệ:

- **Email:** daiphk24414h@st.uel.edu.vn
- **Phone:** 0975951837

Hoặc tạo Issue trực tiếp trên repository GitHub của dự án.

---

## 🙏 Lời cảm ơn

Cảm ơn bạn đã quan tâm đến **Blocktrace**. Dự án được xây dựng nhằm hỗ trợ minh bạch hóa chuỗi cung ứng thông qua công nghệ Blockchain, giúp doanh nghiệp và người tiêu dùng dễ dàng xác thực nguồn gốc, theo dõi lịch sử sản phẩm và nâng cao độ tin cậy của dữ liệu trong toàn bộ vòng đời sản phẩm.

Chúng tôi hy vọng Blocktrace sẽ góp phần thúc đẩy việc ứng dụng Blockchain vào các hệ thống truy xuất nguồn gốc và quản lý chuỗi cung ứng trong thực tế.

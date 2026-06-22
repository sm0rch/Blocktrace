HUONG DAN CHAY BLOCKTRACE TREN MAY KHAC
======================================

1. Giai nen folder
------------------
Giai nen folder app, sau do mo dung thu muc goc co 3 folder:

- backend
- frontend
- hardhat

Vi du:
C:\Users\<ten-may>\Blocktrace-app-v3.1\Blocktrace-app-v3.1\Blocktrace-app-v3.1

Luu y: folder co the bi long nhieu cap sau khi giai nen. Hay vao dung cap co backend, frontend, hardhat.


2. Cai dependencies
-------------------
Mo PowerShell tai thu muc goc app, chay:

cd backend
npm install

cd ..\frontend
npm install

Neu can compile lai smart contract:

cd ..\hardhat
npm install
npx hardhat compile

Neu folder hardhat/artifacts da co san file Counter.json thi co the khong can compile lai.


3. Tao file backend\.env
------------------------
Trong folder backend, copy file mau:

copy .env.example .env

Sau do mo backend\.env va dien cac gia tri sau:

DB_TYPE=file
BLOCKCHAIN_PROVIDER_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
BLOCKCHAIN_PRIVATE_KEY=PRIVATE_KEY_CUA_VI_SEPOLIA
SMART_CONTRACT_ADDRESS=0xDIA_CHI_CONTRACT_DA_DEPLOY
SMART_CONTRACT_ABI_PATH=hardhat/artifacts/contracts/Counter.sol/Counter.json

Quan trong:
- Khong de dau ngoac kep quanh PRIVATE_KEY.
- PRIVATE_KEY nen la vi test Sepolia, khong dung vi chinh co tien that.
- Vi nay can co Sepolia ETH de tra gas.
- Neu smart contract co phan quyen role, dia chi vi nay phai duoc cap role phu hop tren contract.
- Khong gui file .env cua minh cho nguoi khac neu trong do co private key.


4. Etherscan co can API key khong?
----------------------------------
De hien link giao dich Etherscan trong app: KHONG can Etherscan API key.
App chi can transaction hash va se mo link dang:
https://sepolia.etherscan.io/tx/<txHash>

De gui giao dich len Sepolia: can RPC URL + private key + contract address + ABI.

De verify source code contract tren Etherscan: moi can ETHERSCAN_API_KEY va chay hardhat verify.
Day la viec rieng, khong bat buoc de app tao giao dich.


5. Chay backend
---------------
Tu folder backend:

node server.js

Neu dung, terminal se hien:

Blockchain enabled: true
Backend running at http://localhost:4000

Neu hien:
Blockchain enabled: false
thi kiem tra lai .env, RPC, private key, contract address, ABI path.


6. Chay frontend
----------------
Mo terminal khac:

cd frontend
npm run dev

Sau do mo link Vite hien ra, thuong la:
http://localhost:5173


7. Loi ABI thuong gap
---------------------
Neu gap loi:
Failed to load ABI
contract ABI not found

Kiem tra file nay co ton tai khong:

hardhat/artifacts/contracts/Counter.sol/Counter.json

Neu khong co, chay:

cd hardhat
npx hardhat compile

Trong backend\.env nen de ABI path nhu sau:

SMART_CONTRACT_ABI_PATH=hardhat/artifacts/contracts/Counter.sol/Counter.json

Khong nen dung duong dan tuyet doi cua may khac, vi khi giai nen tren may moi duong dan se bi sai.


8. Goi y khi nen folder gui di
------------------------------
Nen gui:
- backend
- frontend
- hardhat
- README_CHAY_TREN_MAY_KHAC.txt

Khong nen gui:
- backend\.env neu co private key that
- node_modules neu muon file zip nhe hon

Nguoi nhan se tu tao backend\.env dua tren backend\.env.example.

9. Loi quet QR / camera
-----------------------
Ban QR moi khong con phu thuoc bat buoc vao BarcodeDetector cua trinh duyet.
Frontend da dung them thu vien jsQR de ho tro nhieu trinh duyet hon.

Neu nut QR khong mo camera, hay kiem tra:

- Dang mo web bang http://localhost:5173 hoac https.
- Khong mo bang file://.
- Neu mo bang IP LAN http://192.168.x.x thi nhieu trinh duyet se chan camera.
- Trinh duyet da duoc cap quyen camera.
- May tinh co camera va camera khong bi ung dung khac chiem dung.
- Sau khi nhan code moi, chay lai npm install trong frontend de cai dependency jsQR.

Lenh frontend:

cd frontend
npm install
npm run dev

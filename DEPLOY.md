# 部署指南

本系統是單一 Node.js 服務：Express 提供 API 並直接供應打包後的前端，
資料存在 SQLite（`data/`）與照片目錄（`uploads/`）。只要能跑 Node 18+ 並掛載
持久化磁碟的平台都能部署。

## 重要環境變數

| 變數 | 說明 |
|---|---|
| `PORT` | 服務埠（平台通常自動注入） |
| `SESSION_SECRET` | **必設**。隨機長字串，簽署登入 session 用。未設時每次重啟會產生新值，所有人會被登出 |
| `COOKIE_SECURE` | 有 HTTPS 時設為 `1`，cookie 僅走加密連線 |
| `DATA_DIR` | SQLite 資料庫目錄（預設 `./data`），部署時指向持久化磁碟 |
| `UPLOAD_DIR` | 照片目錄（預設 `./uploads`），部署時指向持久化磁碟 |

產生隨機密鑰：`openssl rand -hex 32`

## 方案一：Zeabur（台灣常用，介面中文）

> 本 repo 的應用程式在根目錄，Zeabur 會自動讀 `package.json` 的 `build`
> 與 `start`，不需手動填建置/啟動指令。

1. 到 [zeabur.com](https://zeabur.com) 用 GitHub 登入建帳號
2. Create Project → Add Service → Deploy from GitHub → 選這個 repo（分支 `main`）
3. 掛載 Volume（讓病患資料與照片在重新部署後保留）：
   - 在該服務 → Volumes → 新增，Mount Path 填 `/data`
5. 環境變數（Variables）：
   ```
   SESSION_SECRET=<用 openssl rand -hex 32 產生的長字串>
   COOKIE_SECURE=1
   DATA_DIR=/data/db
   UPLOAD_DIR=/data/uploads
   ```
   （`PORT` 由 Zeabur 自動注入，不用設）
6. Networking → 綁定網域 / 產生 `.zeabur.app` 網址（Zeabur 自動配 HTTPS）
7. 首次上線後：用 `admin@clinic.tw / admin123` 登入 →「系統設定 → 使用者帳號」立刻改密碼

## 方案二：Railway

與 Zeabur 幾乎相同：New Project → Deploy from GitHub repo →
Settings 加 Volume（mount path `/storage`）→ 環境變數同上
（`DATA_DIR=/storage/data`、`UPLOAD_DIR=/storage/uploads`）。

## 方案三：自有 VPS（Linode / DigitalOcean / 台灣機房）

```bash
git clone <你的 repo> && cd clinic-crm
npm install
npm run build            # 打包前端到 client/dist
SESSION_SECRET=xxx COOKIE_SECURE=1 PORT=3020 npm start
```

建議：
- 用 `pm2 start server/index.js --name clinic-crm` 讓服務常駐、開機自啟
- 前面架 Caddy 或 Nginx 反向代理並簽 Let's Encrypt HTTPS
- 定期備份 `data/` 與 `uploads/` 兩個目錄（SQLite 備份 = 複製檔案）

## 上線前必做

1. **改掉預設密碼**：系統內建三個示範帳號，上線後立刻用 admin 登入
   「系統設定 → 使用者帳號」重設密碼或停用：
   - `admin@clinic.tw / admin123`（管理者）
   - `doctor@clinic.tw / doctor123`（醫師）
   - `staff@clinic.tw / staff123`（櫃檯）
   （登入一律用 Email；忘記密碼由管理員在「系統設定 → 使用者帳號」重設）
2. **設定 `SESSION_SECRET`**，並在 HTTPS 環境開 `COOKIE_SECURE=1`
3. **確認備份**：病歷屬個資，`data/` 與 `uploads/` 要有異地備份計畫

## 個資法規提醒

病患資料受《個人資料保護法》與醫療法規範。使用雲端主機時建議：
選擇有資料中心位於台灣或有 SOC2/ISO27001 認證的供應商、全程 HTTPS、
限制管理帳號數量，並與員工簽署保密協定。

# 診所 CRM

醫美/皮膚科診所管理系統：病患資料、預約行事曆、看診/療程記錄（含術前術後照片）、
療程套組堂數追蹤、收費帳務與日報表。響應式介面，電腦與 iPad 皆可用。

## 技術架構

- **後端**：Node.js + Express + better-sqlite3（SQLite 單檔資料庫）
- **前端**：React 19 + Vite + React Router
- **認證**：Session cookie（存 SQLite）+ bcrypt，三種角色權限
  - `admin` 管理者：全部功能 + 系統設定
  - `doctor` 醫師：看診記錄/照片可編輯，帳務唯讀
  - `staff` 櫃檯：預約/收費/病患資料，看診記錄唯讀

## 開發

```bash
npm install
npm --prefix client install
npm run dev        # API :3020 + Vite :5175（proxy /api）
```

預設帳號：`admin/admin123`、`doctor1/doctor123`、`staff1/staff123`

## 正式執行

```bash
npm run build      # 打包前端
npm start          # Express 供應 API + client/dist
```

部署到雲端請看 [DEPLOY.md](DEPLOY.md)。

## 目錄結構

```
server/            Express API（routes/ 依資源分檔，middleware.js 權限檢查）
client/src/pages/  各頁面（看板/行事曆/病患/收費/設定）
data/              SQLite 資料庫（自動建立，勿入版控）
uploads/           病患照片（勿入版控）
```

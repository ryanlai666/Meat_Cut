# Meat Buyer Guide App - Backend API & Database 設計計劃

## 1. 概述

本文件描述 meat-buyer-guide-app 的後端架構設計，包括：
- SQLite 資料庫架構
- RESTful API 端點設計
- Google Drive 整合
- 前端與後端的資料流

## 2. 資料庫架構 (SQLite)

### 2.1 主要表格

#### `meat_cuts` 表格
儲存所有肉品切割的基本資訊

```sql
CREATE TABLE meat_cuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    chinese_name TEXT NOT NULL,
    part TEXT NOT NULL,
    lean BOOLEAN NOT NULL,
    price_min REAL NOT NULL,
    price_max REAL NOT NULL,
    price_mean REAL NOT NULL,
    price_display TEXT NOT NULL,
    texture_notes TEXT,
    image_reference TEXT NOT NULL,
    google_drive_image_id TEXT,  -- Google Drive 檔案 ID
    google_drive_image_url TEXT, -- Google Drive 公開分享 URL
    slug TEXT UNIQUE NOT NULL,   -- URL-friendly identifier (e.g., "arm-chuck-roast")
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meat_cuts_slug ON meat_cuts(slug);
CREATE INDEX idx_meat_cuts_part ON meat_cuts(part);
CREATE INDEX idx_meat_cuts_name ON meat_cuts(name);
CREATE INDEX idx_meat_cuts_chinese_name ON meat_cuts(chinese_name);
```

#### `cooking_methods` 表格
儲存烹飪方法（多對多關係）

```sql
CREATE TABLE cooking_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cooking_methods_name ON cooking_methods(name);
```

#### `recommended_dishes` 表格
儲存推薦菜餚（多對多關係）

```sql
CREATE TABLE recommended_dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recommended_dishes_name ON recommended_dishes(name);
```

#### `meat_cut_cooking_methods` 關聯表格
```sql
CREATE TABLE meat_cut_cooking_methods (
    meat_cut_id INTEGER NOT NULL,
    cooking_method_id INTEGER NOT NULL,
    PRIMARY KEY (meat_cut_id, cooking_method_id),
    FOREIGN KEY (meat_cut_id) REFERENCES meat_cuts(id) ON DELETE CASCADE,
    FOREIGN KEY (cooking_method_id) REFERENCES cooking_methods(id) ON DELETE CASCADE
);

CREATE INDEX idx_mccm_meat_cut ON meat_cut_cooking_methods(meat_cut_id);
CREATE INDEX idx_mccm_cooking_method ON meat_cut_cooking_methods(cooking_method_id);
```

#### `meat_cut_recommended_dishes` 關聯表格
```sql
CREATE TABLE meat_cut_recommended_dishes (
    meat_cut_id INTEGER NOT NULL,
    recommended_dish_id INTEGER NOT NULL,
    PRIMARY KEY (meat_cut_id, recommended_dish_id),
    FOREIGN KEY (meat_cut_id) REFERENCES meat_cuts(id) ON DELETE CASCADE,
    FOREIGN KEY (recommended_dish_id) REFERENCES recommended_dishes(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcrd_meat_cut ON meat_cut_recommended_dishes(meat_cut_id);
CREATE INDEX idx_mcrd_dish ON meat_cut_recommended_dishes(recommended_dish_id);
```

#### `metadata` 表格
儲存系統元資料，包括最後更新時間

```sql
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化 metadata
INSERT INTO metadata (key, value) VALUES 
    ('last_meat_cuts_update', datetime('now')),
    ('google_drive_folder_id', ''),
    ('app_version', '1.0.0');
```

### 2.2 資料遷移策略

1. 從現有 CSV 檔案 (`beefcut_init_database.csv`) 匯入初始資料
2. 建立 slug 欄位（從 name 生成 URL-friendly 字串）
3. 上傳圖片到 Google Drive 並記錄檔案 ID 和 URL

## 3. API 端點設計

### 3.1 公開 API（前端使用）

#### `GET /api/health`
健康檢查
- **Response**: `{ status: 'ok', timestamp: string }`

#### `GET /api/metadata`
取得系統元資料（用於判斷是否需要重新載入資料）
- **Response**: 
```json
{
  "lastUpdate": "2024-01-01T00:00:00Z",
  "totalMeatCuts": 63,
  "version": "1.0.0"
}
```

#### `GET /api/meat-cuts/search`
搜尋肉品（後端執行搜尋，前端使用 useMemo 快取結果）
- **Query Parameters**:
  - `q` (string, optional): 搜尋關鍵字（名稱、中文名稱、部位、烹飪方法）
  - `priceMin` (number, optional): 最低價格
  - `priceMax` (number, optional): 最高價格
  - `part` (string, optional): 部位篩選
  - `lean` (boolean, optional): 是否為瘦肉
  - `cookingMethod` (string, optional): 烹飪方法篩選
- **Response**:
```json
{
  "results": [
    {
      "id": 1,
      "name": "Arm Chuck Roast",
      "chineseName": "牛臂肉塊 / 前腿心肉",
      "part": "Chuck",
      "lean": false,
      "priceRange": {
        "min": 6,
        "max": 9,
        "mean": 7.5,
        "display": "$6 – $9"
      },
      "cookingMethods": ["Braising", "Stewing", "Slow Cooker"],
      "recommendedDishes": ["Pot roast", "beef stew", "tacos"],
      "textureNotes": "Rich beefy flavor...",
      "imageUrl": "https://drive.google.com/...",
      "slug": "arm-chuck-roast"
    }
  ],
  "total": 10,
  "priceRange": {
    "min": 4,
    "max": 50
  }
}
```

#### `GET /api/meat-cuts/:slug`
取得單一肉品詳細資訊（前端使用 useMemo 快取）
- **URL Parameters**: `slug` (string): 肉品的 slug
- **Response**:
```json
{
  "id": 1,
  "name": "Arm Chuck Roast",
  "chineseName": "牛臂肉塊 / 前腿心肉",
  "part": "Chuck",
  "lean": false,
  "priceRange": {
    "min": 6,
    "max": 9,
    "mean": 7.5,
    "display": "$6 – $9"
  },
  "cookingMethods": ["Braising", "Stewing", "Slow Cooker"],
  "recommendedDishes": ["Pot roast", "beef stew", "tacos"],
  "textureNotes": "Rich beefy flavor...",
  "imageUrl": "https://drive.google.com/...",
  "slug": "arm-chuck-roast",
  "shareUrl": "https://yourdomain.com/meat/arm-chuck-roast"
}
```

#### `GET /api/meat-cuts/:slug/image`
取得肉品圖片（直接重導向到 Google Drive URL 或提供代理）
- **URL Parameters**: `slug` (string): 肉品的 slug
- **Response**: 302 Redirect 或直接提供圖片

#### `GET /api/filters/options`
取得所有可用的篩選選項（部位、烹飪方法等）
- **Response**:
```json
{
  "parts": ["Chuck", "Rib", "Loin", "Sirloin", "Round", "Other", "Shank", "Brisket", "Plate/Flank"],
  "cookingMethods": ["Braising", "Stewing", "Grilling", "Oven Roasting", ...],
  "priceRange": {
    "min": 4,
    "max": 50
  }
}
```

### 3.2 管理 API（需要認證）

#### `GET /api/admin/meat-cuts`
列出所有肉品（管理介面使用）
- **Query Parameters**:
  - `page` (number, optional): 頁碼
  - `limit` (number, optional): 每頁數量
- **Response**:
```json
{
  "meatCuts": [...],
  "total": 63,
  "page": 1,
  "limit": 20
}
```

#### `GET /api/admin/meat-cuts/:id`
取得單一肉品詳細資訊（管理介面使用）
- **Response**: 同 `GET /api/meat-cuts/:slug`，但使用 ID

#### `POST /api/admin/meat-cuts`
新增肉品
- **Request Body**:
```json
{
  "name": "New Cut",
  "chineseName": "新切割",
  "part": "Chuck",
  "lean": false,
  "priceMin": 10,
  "priceMax": 15,
  "priceDisplay": "$10 – $15",
  "textureNotes": "Description...",
  "cookingMethods": ["Grilling", "Braising"],
  "recommendedDishes": ["Steak", "Roast"],
  "imageFile": "<base64 or multipart/form-data>",
  "imageReference": "beef_cut_r11_c1"
}
```
- **Response**: 新增的肉品物件（包含 Google Drive URL 和 slug）
- **流程**:
  1. 上傳圖片到 Google Drive
  2. 取得 Google Drive 檔案 ID 和公開 URL
  3. 插入資料到 SQLite
  4. 更新 `metadata.last_meat_cuts_update`

#### `PUT /api/admin/meat-cuts/:id`
更新肉品
- **Request Body**: 同 POST，所有欄位可選
- **Response**: 更新後的肉品物件
- **流程**:
  1. 如果提供新圖片，更新 Google Drive 檔案
  2. 更新 SQLite 資料
  3. 更新 `metadata.last_meat_cuts_update`

#### `DELETE /api/admin/meat-cuts/:id`
刪除肉品
- **Response**: `{ success: true, message: "Meat cut deleted" }`
- **流程**:
  1. 從 Google Drive 刪除圖片
  2. 從 SQLite 刪除資料（CASCADE 會自動刪除關聯）
  3. 更新 `metadata.last_meat_cuts_update`

#### `GET /api/admin/cooking-methods`
列出所有烹飪方法
- **Response**: `{ cookingMethods: [...] }`

#### `GET /api/admin/recommended-dishes`
列出所有推薦菜餚
- **Response**: `{ recommendedDishes: [...] }`

#### `GET /api/admin/tags`
列出所有標籤（部位 + 烹飪方法）
- **Response**:
```json
{
  "parts": [...],
  "cookingMethods": [...]
}
```

## 4. Google Drive 整合

### 4.1 設定

- 使用 Google Drive API v3
- 需要服務帳號（Service Account）或 OAuth 2.0
- 在 Google Drive 建立專用資料夾存放圖片
- 設定資料夾為公開或使用服務帳號分享

### 4.2 功能

1. **上傳圖片** (`uploadImageToDrive`)
   - 接收圖片檔案（base64 或 multipart）
   - 上傳到指定 Google Drive 資料夾
   - 設定為公開分享
   - 回傳檔案 ID 和公開 URL

2. **更新圖片** (`updateImageInDrive`)
   - 使用檔案 ID 更新現有檔案
   - 回傳新的公開 URL（如果有的話）

3. **刪除圖片** (`deleteImageFromDrive`)
   - 使用檔案 ID 刪除檔案

4. **同步資料夾** (`syncDriveFolder`)
   - 從 Google Drive 資料夾讀取所有圖片
   - 與資料庫比對，找出遺失或新增的檔案

### 4.3 檔案命名規則

- 保持與現有命名一致：`beef_cut_r{row}_c{col}.jpg`
- 或使用 slug：`{slug}.jpg`

## 5. 前端整合策略

### 5.1 使用 axios

```typescript
// api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
});

export default apiClient;
```

### 5.2 使用 useMemo 優化

#### 搜尋結果快取
```typescript
const searchResults = useMemo(() => {
  // 從 API 取得的結果已經在後端過濾
  return apiResults;
}, [apiResults, sortBy]); // 排序在前端執行
```

#### 單一肉品資訊快取
```typescript
const meatCutDetail = useMemo(() => {
  return cachedMeatCut;
}, [meatCutId, lastUpdate]); // 根據 lastUpdate 判斷是否需要重新載入
```

### 5.3 資料同步機制

```typescript
// 檢查是否需要重新載入
useEffect(() => {
  const checkUpdate = async () => {
    const metadata = await apiClient.get('/metadata');
    const localLastUpdate = localStorage.getItem('lastUpdate');
    
    if (metadata.lastUpdate !== localLastUpdate) {
      // 重新載入資料
      await refetchMeatCuts();
      localStorage.setItem('lastUpdate', metadata.lastUpdate);
    }
  };
  
  checkUpdate();
  const interval = setInterval(checkUpdate, 60000); // 每分鐘檢查
  return () => clearInterval(interval);
}, []);
```

## 6. URL 路由設計

### 6.1 前端路由

- `/` - 主頁（顯示所有肉品列表）
- `/meat/:slug` - 單一肉品詳細頁面（可分享的 URL）
- `/admin` - 管理介面（需要認證）

### 6.2 分享 URL 格式

```
https://yourdomain.com/meat/arm-chuck-roast
```

前端會根據 slug 從後端取得肉品資訊。

## 7. 技術堆疊

### 後端
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3 (使用 `better-sqlite3` 或 `sqlite3`)
- **Google Drive API**: `googleapis` npm package
- **File Upload**: `multer` (如果需要 multipart/form-data)
- **Authentication**: JWT 或簡單的 API key（管理介面）

### 前端（現有）
- **HTTP Client**: axios
- **State Management**: React hooks (useState, useMemo, useEffect)
- **Routing**: React Router (需要新增)

## 8. 環境變數

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_PATH=./data/meat_cuts.db

# Google Drive
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-service-account.json
# 或
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token

# Authentication (Admin)
ADMIN_API_KEY=your_secret_api_key
# 或
JWT_SECRET=your_jwt_secret
```

## 9. 專案結構

```
backend/
├── server.js                 # Express 伺服器主檔案
├── config/
│   ├── database.js           # SQLite 連線設定
│   └── googleDrive.js        # Google Drive 設定
├── models/
│   ├── MeatCut.js            # MeatCut 模型
│   ├── CookingMethod.js      # CookingMethod 模型
│   └── RecommendedDish.js   # RecommendedDish 模型
├── services/
│   ├── googleDriveService.js # Google Drive 操作服務
│   └── searchService.js      # 搜尋邏輯服務
├── routes/
│   ├── public.js             # 公開 API 路由
│   └── admin.js              # 管理 API 路由
├── middleware/
│   ├── auth.js               # 認證中間件
│   └── errorHandler.js       # 錯誤處理
├── utils/
│   ├── slugGenerator.js       # 生成 slug
│   ├── csvImporter.js         # CSV 匯入工具
│   └── validators.js          # 資料驗證
├── migrations/
│   └── init.sql              # 資料庫初始化 SQL
├── data/
│   └── meat_cuts.db          # SQLite 資料庫檔案
└── credentials/              # Google 認證檔案（.gitignore）
    └── google-service-account.json
```

## 10. 實作順序

### Phase 1: 基礎架構
1. 設定 Express 伺服器
2. 建立 SQLite 資料庫和表格
3. 建立基本的資料模型
4. 實作 CSV 匯入工具（從現有 CSV 匯入資料）

### Phase 2: Google Drive 整合
1. 設定 Google Drive API
2. 實作圖片上傳功能
3. 實作圖片更新和刪除功能
4. 將現有圖片上傳到 Google Drive

### Phase 3: 公開 API
1. 實作 `/api/metadata`
2. 實作 `/api/meat-cuts/search`
3. 實作 `/api/meat-cuts/:slug`
4. 實作 `/api/filters/options`

### Phase 4: 管理 API
1. 實作認證中間件
2. 實作 `GET /api/admin/meat-cuts`
3. 實作 `POST /api/admin/meat-cuts`
4. 實作 `PUT /api/admin/meat-cuts/:id`
5. 實作 `DELETE /api/admin/meat-cuts/:id`
6. 實作其他管理端點

### Phase 5: 前端整合
1. 設定 axios client
2. 更新前端使用 API 而非直接讀取 CSV
3. 實作 useMemo 優化
4. 實作 React Router 和分享 URL
5. 實作資料同步機制

### Phase 6: 測試與優化
1. 測試所有 API 端點
2. 測試 Google Drive 整合
3. 效能優化
4. 錯誤處理完善

## 11. 注意事項

1. **安全性**:
   - 管理 API 必須有認證機制
   - Google Drive 認證資訊不可提交到版本控制
   - 輸入驗證和 SQL injection 防護

2. **效能**:
   - 使用資料庫索引優化搜尋
   - 考慮快取機制（Redis 或記憶體快取）
   - 圖片使用 CDN 或 Google Drive 直接連結

3. **錯誤處理**:
   - 統一的錯誤回應格式
   - 適當的 HTTP 狀態碼
   - 記錄錯誤日誌

4. **資料一致性**:
   - Google Drive 和 SQLite 必須保持同步
   - 使用交易確保資料完整性
   - 定期同步檢查

5. **向後相容**:
   - 保持現有資料格式
   - 平滑遷移現有資料

## 12. 下一步

確認此計劃後，將開始實作：
1. 建立資料庫架構
2. 實作基礎 API
3. 整合 Google Drive
4. 更新前端以使用新的 API

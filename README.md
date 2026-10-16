# 微信訊息管理系統 📱

智能整理微信客戶訊息與工程師任務，支援 AI 自動解析與全文模糊搜尋。

## 🚀 快速開始

### 方式一：線上直接使用（推薦）

1. 打開應用：https://wechat-manager.vercel.app
2. 第一次使用時，會看到「設定 Cloudflare Worker」的提示
3. 填入你的 Worker 網址（見下方「部署步驟」）
4. 開始使用！

### 方式二：本地執行

1. Clone 這個 repo
   ```bash
   git clone https://github.com/your-username/wechat-message-manager.git
   cd wechat-message-manager
   ```

2. 用瀏覽器直接開啟 `wechat-manager.html`
   ```bash
   # macOS
   open wechat-manager.html
   
   # Windows
   start wechat-manager.html
   ```

---

## ⚙️ 部署步驟（第一次設定時）

### 1️⃣ 部署 Cloudflare Worker

**Step 1：登入 Cloudflare**
- 前往 https://dash.cloudflare.com
- 使用你的 Cloudflare 帳號登入

**Step 2：建立 Worker**
- 左側選「Workers & Pages」
- 點「Create Application」
- 選「Create Worker」

**Step 3：貼入程式碼**
- 點「Start with Hello World!」進入編輯器
- 清空編輯器裡的程式碼（Ctrl+A → Delete）
- 複製 `worker.js` 裡的所有程式碼
- 貼進編輯器（Ctrl+V）
- 點右上角「Deploy」

**Step 4：設定 API Key**
- 部署完成後，進「Settings」→「Variables」
- 新增環境變數：
  - **變數名稱**：`CLAUDE_API_KEY`
  - **值**：你的 Anthropic API Key（從 https://console.anthropic.com/account/keys 複製）
  - 格式像：`sk-ant-abc123...`
- 點「Save」

**Step 5：複製 Worker 網址**
- 回到 Worker 頁面
- 右上角會看到你的 Worker 網址，例如：
  ```
  https://wechat-manager-abc123.your-username.workers.dev
  ```
- 複製這個網址

### 2️⃣ 部署 HTML 到 Vercel（可選，已自動部署）

如果你要自己控制部署，可以：

1. 上傳程式碼到 GitHub
2. 登入 https://vercel.com
3. 選「New Project」→ 選你的 GitHub Repo
4. Vercel 自動部署完成
5. 得到網址，分享給同事

---

## 📖 使用說明

> **2026-10-16 起「名片管理」已從本系統拿掉，名片統一用行動秘書（TL_technology 首頁的「行動秘書」卡片）管理。** 詳見 NOTES.md。
> 另外：本 README 部分內容（Cloudflare Worker 設定等）是早期版本的說明，目前登入與部署方式以 NOTES.md 為準。

### 客戶往來

1. 點「匯入訊息」
2. 選「客戶訊息」分頁
3. **方式一（推薦）**：貼入整段微信聊天記錄 → 點「AI 解析並儲存」
   - AI 會自動識別：公司名、聯絡人、機型、數量、價格、交期
4. **方式二**：手動填表
5. 搜尋框可用任何關鍵字模糊搜尋（公司、人名、機型、價格、任何文字）

### 工程師任務

1. 點「匯入訊息」
2. 選「工程師任務」分頁
3. **方式一（推薦）**：貼入工程師訊息 → 點「AI 解析並儲存」
   - AI 會自動識別：任務主題、工程師名稱、指示內容、進度回報、狀態
4. **方式二**：手動填表
5. 可按「狀態」篩選（待處理 / 進行中 / 完成）

### 搜尋技巧

- 支援全文搜尋，不限特定欄位
- 搜尋框會即時過濾結果
- 關鍵字會黃色高亮顯示

---

## 🔑 環境變數設定

### 對於開發者

如果你要在本地運行後端服務，需要設定：

```bash
# .env.local
CLAUDE_API_KEY=sk-ant-your-key-here
```

### 對於一般用戶

直接在網頁上填入 Worker 網址即可，無需設定其他變數。

---

## 🛠️ 技術棧

- **前端**：HTML5 + Tailwind CSS + FontAwesome
- **AI**：Claude 3.5 Sonnet（自動理解與解析訊息）
- **代理**：Cloudflare Worker（解決 CORS，安全呼叫 Claude API）
- **部署**：Vercel（靜態網站托管）

---

## 📝 常見問題

**Q：為什麼需要 Cloudflare Worker？**  
A：瀏覽器無法直接呼叫 Anthropic API（CORS 限制），Worker 充當代理，幫你轉發請求。

**Q：資料會被保存嗎？**  
A：目前資料只存在你的瀏覽器 LocalStorage，重新整理頁面還會保留。若要持久化存儲，可升級為 Supabase。

**Q：可以修改色系嗎？**  
A：可以，編輯 `wechat-manager.html` 的 `tailwind.config` 部分即可。

**Q：多個人用會互相看到彼此的資料嗎？**  
A：不會，每個人的資料獨立儲存在自己的瀏覽器。

**Q：API 要花錢嗎？**  
A：Claude API 按使用量計費，但價格很便宜。詳見 https://www.anthropic.com/pricing

---

## 🤝 貢獻

歡迎提交 Issues 或 Pull Requests！

---

## 📄 授權

MIT License

---

## 支持與反饋

有問題或建議？歡迎聯絡團隊！


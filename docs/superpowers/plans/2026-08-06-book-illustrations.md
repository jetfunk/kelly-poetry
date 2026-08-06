# 《我．獨一無二》正文插圖 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 `data/book.json` 21 章加入 AI 生成意境圖（正文穿插圖文），`body` 逐字不動，先 3 章範例確認後全量。

**Architecture:** 純靜態資料驅動。`data/book.json` 每章新增 `illustrations` 陣列（`at` 0-based 行號＋`file`＋`alt`），`body` 不改一字；`assets/js/main.js` 的 `openChapter` 渲染正文時依行號插入 `<figure>`；圖檔存 `assets/images/book/<chID>-<n>.jpg`。生圖沿用既有 ComfyUI Z_Image Q8 管道（`tools/` 批次→`assets/images/book/`）。

**Tech Stack:** Python（`tools/temp_*.py` 批次與驗證）、ComfyUI Z_Image Q8（`http://127.0.0.1:8188`，`C:\Users\user\.claude\skills\jet-comfyui\scripts\generate_images.py`）、既有 HTML/CSS/JS、playwright（回歸驗證）、gh CLI（GitHub Pages 部署）。

## Global Constraints

- 所有溝通、註解、文件使用**繁體中文**；暫時/測試檔命名含 `temp`/`test`。
- `data/book.json` 每章 **`body` 逐字不動**（重組==原文的既有承諾，見 `tools/temp_parse_book.py`）。
- 詩詞 495 首 `poems.json`、495 張圖、`assets/js/main.js` 詩詞函式（`loadPoems`/`renderIndex`/`showYear`/`renderDetail`）**零改動**。
- 插圖 **人物不露臉**（背影／側影／遠景，prompt 含 `faces not visible` 類修飾）；內容只取自原文實際出現的事物。
- 圖檔 **1280×848（3:2）**；prompt 統一後綴 `, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, serene, <emotion>`。
- 張數門檻：≤200 字 0 張、201–400 字 1 張、401–1500 字 1–2 張、>1500 字 2–3 張。
- 不配樂、不更動畫視圖與詩詞視圖既有樣式。

---

## 檔案結構

| 檔案 | 動作 | 職責 |
|---|---|---|
| `data/book.json` | 修改 | 每章加 `illustrations`（範例 Task 4、全量 Task 8） |
| `assets/images/book/<chID>-<n>.jpg` | 新建 | 插圖資產（生圖產出） |
| `assets/js/main.js` | 修改 | `renderBook`/`openChapter` 依 `illustrations` 插 `<figure>` |
| `assets/css/style.css` | 修改 | `.book-figure` 樣式 |
| `tools/book_prompts.json` | 新建 | `{"<chID>-<n>": "<prompt>", ...}` 圖 prompt 庫 |
| `tools/temp_book_insert.py` | 新建(temp) | 產出/驗證插入點清單（`temp_output/book_insert_points.md`＋`tools/book_insert_points.json`） |
| `tools/temp_book_prompts.py` | 新建(temp) | 產出/驗證 `tools/book_prompts.json` |
| `tools/temp_run_book_gen.py` | 新建(temp) | 建批次 prompts.json→呼叫 generate_images.py→搬圖至 assets |
| `tools/temp_book_test.py` | 修改 | playwright 驗證書視圖插圖（數目/位置/載入/body 逐字） |
| `tools/temp_validate_book_illust.py` | 新建(temp) | 靜態驗證 `illustrations`（at 範圍/排序/不重複/圖檔存在） |
| `temp_output/book_insert_points.md` | 新建(temp) | 插入點清單（供使用者審核） |
| `temp_output/images_book/` | 新建(temp) | 生圖暫存 |

---

### Task 1: 範例 3 章插入點選定（使用者審核 gate）

**Files:**
- Create: `tools/temp_book_insert.py`
- Create: `temp_output/book_insert_points.md`
- Create: `tools/book_insert_points.json`
- Reference: `temp_output/book_chapters.json`（既有，每章 `lines` 陣列＝`body` 依 `\n` 拆行）

**Interfaces:**
- Produces: `tools/book_insert_points.json` = `{"<chID>": [{"at": int, "alt": str}, ...]}`，`at` 為 0-based 行號（第 `at` 行之後插入）。

- [ ] **Step 1: 讀範例章原文行內容**

Run: `python -c "import json;c=json.load(open('temp_output/book_chapters.json',encoding='utf-8'));[print(x['id'],x['title'],len(x['lines'])) for x in c if x['id'] in ('ch02','ch13','ch16')]"`
Expected: 顯示三章行數（ch02 約 9、ch13 約 80、ch16 約 130）。

- [ ] **Step 2: 依情境選插入點（人工判斷）**

逐章閱讀 `lines`，依書中實際提到的情境選點：窗景、病房、手術、復健、晨曦、相機、聚餐等。張數依門檻：ch02=1、ch13=2、ch16=2–3。`alt` 用繁體中文短句描述情境（不超過 15 字），例：`「拄著助行器練習走路的側影」`。

- [ ] **Step 3: 寫 `tools/temp_book_insert.py`**

寫入腳本：內含 `INSERTS`（ch02/ch13/ch16 的 `{"<chID>": [{"at":…,"alt":…}, …]}`；Task 7 擴充為全部章節）；讀 `temp_output/book_chapters.json` 驗證每筆 `at` 在 `[0, len(lines))`、依序、不重複；輸出 `tools/book_insert_points.json` 與 `temp_output/book_insert_points.md`（表格：章／行號／該行首 20 字／alt）。

- [ ] **Step 4: 執行並驗證**

Run: `python tools/temp_book_insert.py`
Expected: 驗證 PASS；`book_insert_points.md` 顯示三章共 5–6 筆。

- [ ] **Step 5: 呈交使用者審核**

呈現 `book_insert_points.md` 清單，請使用者確認/微調插入點與 alt。確認後繼續 Task 2。

---

### Task 2: 撰寫範例 prompt 並產 `tools/book_prompts.json`

**Files:**
- Create: `tools/temp_book_prompts.py`
- Create: `tools/book_prompts.json`
- Consumes: `tools/book_insert_points.json`（Task 1）

**Interfaces:**
- Produces: `tools/book_prompts.json` = `{"<chID>-<n>": "<full prompt>", ...}`；key 對應 `book_insert_points.json` 第 `n` 筆（1-based），順序與生圖輸出 `001.jpg…` 對齊。

- [ ] **Step 1: 撰寫 5–6 張 prompt**

`tools/book_prompts.json` 內每個 key 的 prompt = `"<英文場景描述, 只取原文事物>, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, serene, <emotion>"`。人物出現處加 `figures seen from behind`／`soft silhouette`／`distant view, faces not visible`。emotion 限：`serene/gentle/hopeful/nostalgic/solemn/tranquil/dreamy`。

- [ ] **Step 2: 寫 `tools/temp_book_prompts.py` 驗證**

驗證：key 集合 == 插入點清單（`chID-n` 對應）；每筆含固定後綴與合法 emotion；emotion 為字串最後一段。輸出 `temp_output/prompt_report_book.txt`。

- [ ] **Step 3: 執行並驗證**

Run: `python tools/temp_book_prompts.py`
Expected: PASS；報告列出每張 prompt。

- [ ] **Step 4: Commit**

```bash
git add tools/book_prompts.json tools/temp_book_insert.py tools/temp_book_prompts.py
git commit -m "feat: 書插圖範例 3 章插入點與 prompt 清單"
```

---

### Task 3: 範例生圖（ComfyUI Z_Image Q8）

**Files:**
- Create: `tools/temp_run_book_gen.py`
- Create: `temp_output/images_book/`
- Consumes: `tools/book_prompts.json`（Task 2）

**Interfaces:**
- Produces: `assets/images/book/<chID>-<n>.jpg`（1280×848）。

- [ ] **Step 1: 檢查 ComfyUI 在線**

Run: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8188`
Expected: `200`（若否，請使用者啟動 ComfyUI 後再繼續）。

- [ ] **Step 2: 寫 `tools/temp_run_book_gen.py`**

腳本：讀 `tools/book_prompts.json`，依 key 排序取 prompt → 寫 `temp_output/images_book/prompts.json`（`{"prompts":[...]}`）；另寫 `temp_output/images_book/plan.json`（`[{"out":"<chID>-<n>.jpg","prompt":"…"},…]`）記錄 001.jpg→目標檔名對應。

- [ ] **Step 3: 批次生圖**

Run:
```bash
PYTHONIOENCODING=utf-8 python "C:\Users\user\.claude\skills\jet-comfyui\scripts\generate_images.py" temp_output/images_book --workflow "C:\Users\user\.claude\skills\jet-comfyui\references\comfyui\Z_Image文生图（gguf-Q8）.json" --width 1280 --height 853
```
Expected: 依序輸出 `001.jpg…`（每張 OK 約 20–90 秒）。已存在檔自動 skip（可續跑）。

- [ ] **Step 4: 檢視品質並重生成**

以 Read 工具檢視 `temp_output/images_book/*.jpg`。**人物露臉、內容不符原文、風格走樣者**：改 prompt 後刪除該檔（讓腳本續跑）或整批重跑。確認品質後，將 `plan.json` 對應的 `00N.jpg` 複製為 `assets/images/book/<chID>-<n>.jpg`。

- [ ] **Step 5: 驗證圖檔**

Run: `python -c "import os,glob; fs=glob.glob('assets/images/book/*.jpg'); print(len(fs), fs)"`
Expected: 與範例插入點數相同（5–6 張）。

---

### Task 4: 更新 `data/book.json` 加範例 `illustrations` ＋資料驗證

**Files:**
- Modify: `data/book.json`
- Create: `tools/temp_validate_book_illust.py`

**Interfaces:**
- Consumes: `assets/images/book/<chID>-<n>.jpg`（Task 3）、`tools/book_insert_points.json`（Task 1）
- Produces: 每範例章含 `illustrations`（`{at, file:"<chID>-<n>.jpg", alt}`）。

- [ ] **Step 1: 寫 `tools/temp_validate_book_illust.py`**

驗證（讀 `data/book.json`）：每章 `illustrations`（若存在）`at` 依序且不重複、`at ∈ [0, len(body.split('\n')))`；`file` 對應 `assets/images/book/` 檔案存在；**body 重組 == 原文**（重跑 `temp_parse_book.py` 的比對邏輯，或對 `我-獨一無二.md` 逐字比對）。任一點失敗即 exit 1。

- [ ] **Step 2: 更新 `data/book.json` 範例 3 章**

於 ch02/ch13/ch16 加入 `illustrations`（`file` 依 Task 3 實際產出檔名；`alt` 沿用插入點清單）。

- [ ] **Step 3: 執行驗證**

Run: `python tools/temp_validate_book_illust.py`
Expected: PASS（含 body 重組==原文）。

- [ ] **Step 4: Commit**

```bash
git add data/book.json assets/images/book tools/temp_validate_book_illust.py
git commit -m "feat: 書插圖範例 3 章資料與圖檔（body 逐字不變）"
```

---

### Task 5: 前端渲染＋CSS

**Files:**
- Modify: `assets/js/main.js`（`renderBook`、`openChapter`）
- Modify: `assets/css/style.css`
- Modify: `tools/temp_book_test.py`

**Interfaces:**
- Consumes: `data/book.json`（含 `illustrations`）、`assets/images/book/*.jpg`

- [ ] **Step 1: `renderBook` 預處理插圖**

在 `renderBook(book)` 內，於建立目錄後對每章 `illustrations` 做：依 `at` 排序、過濾 `at` 越界（`console.warn`）。將 `book` 存入既有 `BOOK` 全域。

- [ ] **Step 2: `openChapter` 渲染正文插入 `<figure>`**

將 `document.getElementById('readerBody').textContent = ch.body;` 改為：以 `ch.body.split('\n')` 逐行建立文字節，於 `at` 行後插入：

```js
const fig = document.createElement('figure');
fig.className = 'book-figure';
const img = document.createElement('img');
img.src = `assets/images/book/${it.file}`;
img.alt = it.alt || '';
img.loading = 'lazy';
img.onerror = () => { img.classList.add('is-missing'); };
fig.appendChild(img);
```

全程 `createElement`/`textContent`，不拼 HTML 字串。

- [ ] **Step 3: 加 `.book-figure` 樣式**

`style.css` 末尾追加：`.book-figure { margin: 1.8rem auto; text-align: center; } .book-figure img { width: min(100%, 42em); border-radius: var(--radius-card); border: 1px solid rgba(74,59,36,.14); box-shadow: var(--shadow-soft); background: var(--paper-deep); } .book-figure img.is-missing { min-height: 160px; }`。

- [ ] **Step 4: 擴充 `tools/temp_book_test.py`**

新增一節（開書視圖後依 `data/book.json` 比對）：每範例章 figure 數 == `illustrations` 數；圖 `naturalWidth > 0`；`readerBody` 去除圖後文字 == `body`（逐字）；行動版式無水平捲動。

- [ ] **Step 5: 本機驗證**

啟動 `python -m http.server 8000` 後 Run: `python tools/temp_book_test.py`（若 ComfyUI 已佔用該埠無關，伺服器另起）。
Expected: 既有書視圖測試 + 新插圖測試全 PASS。

- [ ] **Step 6: Commit**

```bash
git add assets/js/main.js assets/css/style.css tools/temp_book_test.py
git commit -m "feat: 書視圖正文穿插插圖渲染與樣式"
```

---

### Task 6: 使用者檢視 3 章範例（gate）

- [ ] **Step 1: 本機伺服器供使用者檢視**

Run: `python -m http.server 8000`（背景），告知使用者開啟 `http://127.0.0.1:8000/index.html` 書視圖，檢視 ch02/ch13/ch16 三章插圖。
- [ ] **Step 2: 依回饋調整**

若插圖品質、密度、alt、樣式有調整意見：回到 Task 1/2/5 對應步驟微調並重新驗證。確認後進入 Task 7。

---

### Task 7: 全量插入點＋prompt

**Files:**
- Modify: `tools/temp_book_insert.py`、`tools/temp_book_prompts.py`
- Modify: `tools/book_insert_points.json`、`tools/book_prompts.json`

- [ ] **Step 1: 其餘 18 章插入點選定**

依張數門檻（Global Constraints）逐章閱讀 `temp_output/book_chapters.json` 的 `lines` 選點，`at`/`alt` 格式同 Task 1。更新 `tools/temp_book_insert.py` 的 `INSERTS`（全部章節），執行輸出完整 `book_insert_points.md`，**呈交使用者審核微調**。
- [ ] **Step 2: 全量 prompt 撰寫並驗證**

`tools/book_prompts.json` 補齊全量 key（`chXX-N`）；執行 `python tools/temp_book_prompts.py` 驗證 key==插入點、格式合法。
- [ ] **Step 3: Commit**

```bash
git add tools/book_insert_points.json tools/book_prompts.json
git commit -m "feat: 書插圖全量插入點與 prompt 清單"
```

---

### Task 8: 全量生圖＋資料＋圖搬移

**Files:**
- Modify: `tools/temp_run_book_gen.py`
- Modify: `data/book.json`

- [ ] **Step 1: 全量批次生圖**

確認 ComfyUI 在線後，改批次目錄為 `temp_output/images_book_full/`，執行 Task 3 步驟 3 的指令（換目錄）。產出約 17–22 張。
- [ ] **Step 2: 品質檢視並搬圖**

以 Read 檢視，走樣者重生成；依 `plan.json` 複製為 `assets/images/book/<chID>-<n>.jpg`。
- [ ] **Step 3: 更新 `data/book.json` 全量 `illustrations`**

其餘章節補 `illustrations`；執行 `python tools/temp_validate_book_illust.py` 全量驗證（含 body 重組==原文、圖檔存在）。
- [ ] **Step 4: Commit**

```bash
git add data/book.json assets/images/book
git commit -m "feat: 書插圖全量資料與圖檔（21 章）"
```

---

### Task 9: 全站回歸驗證

**Files:**
- Reference: `tools/temp_nav_test.py`、`tools/temp_site_verify4.py`

- [ ] **Step 1: 書視圖插圖測試**

Run: `python tools/temp_book_test.py`
Expected: 全 PASS（21 章 figure 數目/位置/載入、body 逐字）。
- [ ] **Step 2: 詩詞回歸**

Run: `python tools/temp_nav_test.py && python tools/temp_site_verify4.py`
Expected: 全 PASS（495 詩、年份、返回還原、詳情頁、495 圖）。
- [ ] **Step 3: Commit（若有殘留）**

```bash
git status --short && git add -A && git commit -m "chore: 書插圖全量驗證"
```

---

### Task 10: 部署與線上驗證

- [ ] **Step 1: Push**

Run: `git push origin master`
Expected: 推送成功，GitHub Pages 自動部署（輪詢 `https://jetfunk.github.io/kelly-poetry/data/book.json` 至 200 且首頁含 `KELLY 詩詞書畫`）。
- [ ] **Step 2: 線上驗證**

Python 檢查線上：`data/book.json` 200 且各章 `illustrations` 存在；抽樣 3 個 `assets/images/book/*.jpg` 檔 HTTP 200；`data/poems.json` 仍 495。
- [ ] **Step 3: 交付**

向使用者確認：21 章插圖上線、詩詞無回歸、`我-獨一無二.md` 仍不追蹤。

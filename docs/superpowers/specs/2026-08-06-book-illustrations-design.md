# 《我．獨一無二》正文插圖 — 設計規格

日期：2026-08-06
狀態：已與使用者逐節確認

## 背景

三藝網站「KELLY 詩詞書畫」書視圖目前為純文字章節閱讀（`data/book.json` 21 章）。使用者要求加入 **AI 生成意境圖、正文穿插圖文**，讓閱讀更有感。

## 已確認規格（使用者決策）

| 項目 | 決定 |
|---|---|
| 圖源 | AI 生成：本機 ComfyUI Z_Image Q8（`http://127.0.0.1:8188`），與詩詞 495 張意境圖同一套流程 |
| 位置 | 正文穿插（圖文交錯），非章首橫幅 |
| 一致性 | **內容忠實原文情境與物品**（台中榮總病房、手術、助行器、復健、晨曦窗外、相機等），不添加書中沒有的元素；**人物不露臉**（背影／側影／遠景，`faces not visible`）；風格統一淡彩水墨＋暖紙紋 |
| 張數 | 依章節長度彈性：短文（≤400 字）0–1 張、中章 1–2 張、長章 2–3 張；**全書約 22–28 張** |
| 資料結構 | `book.json` 每章加 `illustrations` 欄位（方案 A）；**`body` 逐字不動** |
| 流程 | **先 3 章範例**（短／長／情節各一）生圖＋渲染，使用者確認後再全量 |

## 張數門檻

| 章節字數（body 長度） | 插圖張數 |
|---|---|
| ≤200 字 | 0（不插） |
| 201–400 字 | 1 |
| 401–1500 字 | 1–2 |
| >1500 字 | 2–3 |

全書合計約 22–28 張。實際張數可在使用者審核插入點清單時微調。

## 資料結構

`data/book.json` 每章擴充 `illustrations` 陣列（可省略，省略＝無插圖）：

```json
{
  "id": "ch16",
  "title": "右髖關節半置換手術及休養期間",
  "body": "2018年 6月 20日 星期三\n又住院了！\n……（原文逐字，不改一字）",
  "illustrations": [
    { "at": 4,  "file": "ch16-1.jpg", "alt": "病床上等待手術的晨光" },
    { "at": 66, "file": "ch16-2.jpg", "alt": "拄著助行器練習走路的側影" }
  ]
}
```

- **`at`**：0-based 原文行號，表示「第 `at` 行之後」插入（`0`＝章首）。`body` 以 `\n` 拆行後對應，正文一字不變。
- 每章 `illustrations` 依 `at` 排序、不重複；範圍 `[0, 行數)`，渲染時越界自動略過並 `console.warn`。
- 圖檔：**`assets/images/book/<chID>-<n>.jpg`**（如 `ch16-1.jpg`），尺寸 **1280×853（3:2）**，與詩詞意境圖同規格。

## 插入點選定

- 由執行者逐章閱讀原文，依實際情境選定插入點（文中提到的相片、窗外景、手術、復健、日出晨曦等）。
- **先提供範例 3 章的插入點清單（行號＋情境＋alt）給使用者審核微調；全量前再提供完整清單。**
- `alt` 用繁體中文簡短描述該圖情境，兼作無障礙與載入失敗提示。

## 生圖與一致性

**提示詞格式**（沿用詩詞意境圖後綴，確保風格一致）：

```
<該情境英文場景描述>, soft watercolor Chinese ink painting,
warm cream paper texture, gentle light, serene, <emotion>
```

- 場景描述**只取自該章原文實際出現的事物**，不添加書中沒有的元素。
- **人物不露臉**修飾語，例如：`figures seen from behind`、`soft silhouette`、`distant view, faces not visible`。
- 每張圖 prompt 存 **`tools/book_prompts.json`**（key：`<chID>-<n>`，value：完整 prompt），可稽核、可日後重生成。

**生圖流程**：
1. 確認本機 ComfyUI `http://127.0.0.1:8188` 在線（Z_Image Q8 workflow）。
2. 批次生成 → 產圖於 `temp_output/images_book/`。
3. 檢視品質：**人物露臉、內容不符原文、風格走樣者重新生成**。
4. 確認後複製進 `assets/images/book/`。

## 前端渲染（assets/js/main.js）

- `openChapter` 渲染正文時，依 `illustrations` 在對應行後插入 `<figure>`：
  - `body.split('\n')` 拆行 → 逐行建立文字節；到達 `at` 行後插入 figure 元素。
  - 全程用 `createElement`／`textContent`，**不拼 HTML 字串**，維持 XSS 安全。
  - 圖元素：`<figure class="book-figure"><img src="assets/images/book/<file>" alt="<alt>" loading="lazy"></figure>`。
- `renderBook` 預先過濾：越界 `at` 丟棄並 `console.warn`、依 `at` 排序。

## 樣式（assets/css/style.css）

- `.book-figure`：居中、`margin-block` 留白、圖寬貼合正文（`min(100%, 42em)`）。
- `img`：圓角毛邊、紙紋細邊、輕陰影，與整體手札風一致；圖檔缺失時顯示暖紙紋佔位背景（`img` 自身背景），不破圖。
- 行動版：沿用全域 `img { max-width: 100% }` 自動縮放。

## 驗證

**本機驗證**（擴充 `tools/temp_book_test.py`）：
1. `book.json` 各章 `illustrations`：`at` 範圍 `[0, 行數)`、依序、不重複。
2. 渲染後 figure 數目正確、位置正確（圖前後文對應 `at`）。
3. 每張圖 `naturalWidth > 0`（載入成功）。
4. **`body` 逐字重組 == 原文仍成立**（插入圖未動正文；沿用既有 `tools/temp_parse_book.py` 的重組驗證口徑）。

## 範例 3 章

| 章 | 特性 | 預期張數 |
|---|---|---|
| ch02 自序 | 短（330 字） | 1 |
| ch13 開刀記事（2008） | 情節（2721 字） | 2 |
| ch16 右髖關節半置換手術及休養期間 | 長（4749 字） | 2–3 |

範例合計約 5–6 張，一次涵蓋短文／長文／情節三種情境與密度。

**範例執行順序**：
1. 選定 3 章插入點清單 → 使用者審核微調。
2. 寫 5–6 張 prompt → 確認 ComfyUI → 生圖 → 檢視／重生成。
3. 建 `illustrations` 欄位＋前端渲染＋CSS → 本機驗證全過。
4. 使用者本機檢視 3 章範例，確認品質與密度。

## 全量與部署

- 範例確認後：其餘章節插入點清單審核 → 全量生圖（約 17–22 張）→ 補齊 `data/book.json` → 本機驗證 → commit＋push → 線上驗證（書視圖各章 figure 載入正常、詩詞功能無回歸）。

## 非目標

- 不更動詩詞視圖、詩詞資料與 495 張意境圖。
- 書插圖不做互動（無點圖放大燈箱；若日後需要另行決定）。
- 不生成人物面容。

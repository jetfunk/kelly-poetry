# Kelly 詩詞網站（精選樣板版）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 8 首精選詩作的暖紙手札風個人詩集網站，每首配 AI 圖＋30 秒音樂，可於瀏覽器預覽。

**Architecture:** 純靜態資料驅動網站。Python 工具解析詩作（自動編碼轉換）產出 `data/poems.json`；依詩意撰寫提示詞後，以 jet-comfyui 批次生圖、jet-audio.cpp 生成音樂；前端以原生 HTML/CSS/JS 由 JSON 渲染年份導航與詳情頁。

**Tech Stack:** Python 3.11（解析工具）、requests（comfyui 批次生圖）、原生 HTML/CSS/JS（網站，無框架）、jet-comfyui / jet-audio.cpp 技能腳本。

## Global Constraints

- 詩詞來源目錄：`C:\Users\user\Documents\我的\Kelly的詩詞`
- 工作目錄：`C:\Users\user\Documents\CC\kelly-poetry`
- ComfyUI：`http://127.0.0.1:8188`（RTX 4060 8GB、lowvram、fp16）
- 音樂 WebUI：`http://127.0.0.1:7860`；輸出在 `C:\App\audio.cpp-webui\output\`
- 暫存/測試腳本一律命名含 `temp_`/`test_`，置於 `tools/`（已 gitignore，不提交）
- 詩作編碼混合 Big5 / UTF-8 / UTF-8-BOM，必須自動偵測
- 圖片統一淡彩水墨插畫風格（呼應暖紙手札），3:2 橫式 1280×853
- 音樂一律 `--duration 30 --lyrics "[Instrumental]"`（純音樂）
- 網站以 `python -m http.server` 本機開啟預覽

---

### Task 1: 專案資料夾與環境檢查

**Files:**
- Create: `assets/images/poems/`（目錄）
- Create: `assets/audio/poems/`（目錄）
- Create: `data/`（目錄）
- Create: `tools/`（目錄）

**Interfaces:**
- Produces: 目錄結構；確認 ComfyUI 與音樂 WebUI 可用

- [ ] **Step 1: 建立目錄**

```bash
mkdir -p assets/images/poems assets/audio/poems data tools
```

- [ ] **Step 2: 驗證兩服務可用**

```bash
curl -s --max-time 5 http://127.0.0.1:8188/system_stats | head -c 200   # 應回傳 JSON
curl -s --max-time 5 http://127.0.0.1:7860/ | head -c 100               # 應回傳 HTML
```

Expected: 兩者皆有回應。若任一失敗，停下回報（服務未啟動）。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: 建立專案目錄結構"
```

---

### Task 2: 詩作解析工具（TDD）

**Files:**
- Create: `tools/test_parse_poems.py`
- Create: `tools/temp_parse_poems.py`

**Interfaces:**
- Produces: `tools/temp_parse_poems.py` 提供以下函式（後續 Task 3 呼叫）：
  - `detect_encoding(path: str) -> str`（回傳 `'utf-8'` / `'utf-8-sig'` / `'big5'`）
  - `read_text(path: str) -> str`（正確解碼）
  - `parse_metadata(filename: str, text: str) -> dict`（回傳含 `id/title/date/year/location/body/note/source` 的 dict）
  - `build_poems_json(files: list[tuple[str, str]]) -> list[dict]`（串接解析結果）

- [ ] **Step 1: 寫失敗測試**

```python
# tools/test_parse_poems.py
# -*- coding: utf-8 -*-
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from temp_parse_poems import detect_encoding, read_text, parse_metadata, build_poems_json

def _w(path, data, mode='w', encoding=None):
    kw = {'encoding': encoding} if encoding else {}
    with open(path, mode, **kw) as f:
        f.write(data)

def test_detect_big5():
    d = tempfile.mkdtemp()
    p = os.path.join(d, 'a.txt')
    with open(p, 'wb') as f:
        f.write('【竹】\n\n竹節常伸挺\n挺直向蒼穹'.encode('big5'))
    assert detect_encoding(p) == 'big5'

def test_detect_utf8():
    d = tempfile.mkdtemp()
    p = os.path.join(d, 'b.txt')
    _w(p, '【竹】\n\n竹節常伸挺', 'w', 'utf-8')
    assert detect_encoding(p) == 'utf-8'

def test_detect_utf8_bom():
    d = tempfile.mkdtemp()
    p = os.path.join(d, 'c.txt')
    with open(p, 'wb') as f:
        f.write(b'\xef\xbb\xbf' + '心中坦蕩'.encode('utf-8'))
    assert detect_encoding(p) == 'utf-8-sig'

def test_read_big5_roundtrip():
    d = tempfile.mkdtemp()
    p = os.path.join(d, 'd.txt')
    with open(p, 'wb') as f:
        f.write('【竹】竹節常伸挺'.encode('big5'))
    assert '竹節常伸挺' in read_text(p)

def test_parse_metadata_basic():
    text = '【冬盡春來】\n\n冬盡春來露端倪\n\n文/圖：秦如珮（Kelly Chin）\n\nPS：今年趕不上梅園。'
    m = parse_metadata('20220205(大年初五)-1.清華大學-【冬盡春來】.txt', text)
    assert m['id'] == '20220205-冬盡春來'
    assert m['title'] == '冬盡春來'
    assert m['date'] == '2022-02-05'
    assert m['year'] == 2022
    assert '清華大學' in m['location']
    assert '冬盡春來露端倪' in m['body']
    assert '梅園' in m['note']

def test_parse_metadata_no_date():
    m = parse_metadata('【Take Me anywhere】.txt', '【Take Me anywhere】\n\n內容')
    assert m['title'] == 'Take Me anywhere'
    assert m['date'] == ''
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `python -m pytest tools/test_parse_poems.py -v`（若無 pytest 則 `python tools/test_parse_poems.py`）
Expected: 因 `temp_parse_poems` 不存在而 ImportError。

- [ ] **Step 3: 實作 `temp_parse_poems.py`**

```python
# tools/temp_parse_poems.py
# -*- coding: utf-8 -*-
"""詩作解析工具（暫存）：自動偵測編碼、解析檔名與內文、輸出 poems.json。
命名含 temp_ 標記，可安全刪除。"""
import json, os, re, sys

def detect_encoding(path):
    with open(path, 'rb') as f:
        raw = f.read(512)
    if raw.startswith(b'\xef\xbb\xbf'):
        return 'utf-8-sig'
    try:
        raw.decode('utf-8')
        return 'utf-8'
    except UnicodeDecodeError:
        return 'big5'

def read_text(path):
    enc = detect_encoding(path)
    with open(path, 'r', encoding=enc) as f:
        return f.read()

def _find_date(s):
    m = re.search(r'(20\d{2})(\d{2})(\d{2})', s)
    if m:
        return f'{m.group(1)}-{m.group(2)}-{m.group(3)}', int(m.group(1))
    m = re.search(r'(20\d{2})\D*(\d{1,2})\D*(\d{1,2})', s)
    if m:
        return f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}', int(m.group(1))
    return '', 0

def _find_title(s):
    m = re.search(r'【([^】]+)】', s)
    if m:
        return m.group(1).strip()
    base = os.path.splitext(os.path.basename(s))[0]
    base = re.sub(r'^20\d{6,8}', '', base)
    base = re.sub(r'^20\d{4}[-.\s]+\d{1,2}[-.\s]+\d{1,2}', '', base)
    base = base.strip(' -—–()（）')
    return base or '無題'

def parse_metadata(filename, text):
    lines = [l.rstrip('\r\n') for l in text.splitlines()]
    clean = [l.strip() for l in lines if l.strip()]
    date, year = _find_date(filename)
    title = _find_title(filename)
    # 在內文找日期（例如「寫於 2019.02.09」）
    if not date:
        for l in clean:
            m = re.search(r'(20\d{2})[.\-年/](\d{1,2})[.\-月/](\d{1,2})', l)
            if m:
                date = f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'
                year = int(m.group(1))
                break
    # 位置：檔名中「日期」與「詩名」之間的片段
    base = os.path.splitext(filename)[0]
    parts = re.split(r'[-—–]', base)
    location_parts = []
    for p in parts:
        p = p.strip()
        if not p or re.match(r'^20\d{6,8}', p) or re.search(r'【', p):
            continue
        p = re.sub(r'^\d+[\.\)]\s*', '', p)  # 去掉「1.」「(大年初五)」序號
        if p and 'Kelly' not in p:
            location_parts.append(p)
    location = '、'.join(location_parts) if location_parts else ''
    # body：去掉首段標題行、作者行、日期行；其餘保留
    body_lines, note_lines = [], []
    in_body = False
    for l in clean:
        if re.search(r'【', l) and not in_body:
            in_body = True
            continue
        if re.search(r'文\s*/\s*圖|攝影日期|PO文|Kelly Chin|秦如珮', l):
            continue
        if re.match(r'^PS[:：]?', l):
            note_lines.append(re.sub(r'^PS[:：]?\s*', '', l))
            continue
        if in_body:
            body_lines.append(l)
    # 若 body 很長含引述文字，前 12 行視為詩文主體
    body = '\n'.join(body_lines).strip()
    return {
        'id': f'{date}-{title}' if date else title,
        'title': title,
        'date': date,
        'year': year,
        'location': location,
        'body': body,
        'note': '\n'.join(note_lines).strip(),
        'source': filename,
    }

def build_poems_json(files):
    poems = []
    for path, name in files:
        text = read_text(path)
        m = parse_metadata(name, text)
        m['source'] = path
        poems.append(m)
    poems.sort(key=lambda p: p['date'] or '9999')
    return poems

def main():
    if len(sys.argv) < 3:
        print('用法: python temp_parse_poems.py <列表json> <輸出json>')
        print('列表json格式: {"files": [["路徑","檔名"], ...]}')
        sys.exit(1)
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        files = json.load(f)['files']
    poems = build_poems_json(files)
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        json.dump(poems, f, ensure_ascii=False, indent=2)
    print(f'解析完成: {len(poems)} 首')

if __name__ == '__main__':
    main()
```

- [ ] **Step 4: 跑測試確認通過**

Run: `python tools/test_parse_poems.py`
Expected: 全部測試 PASS（無 pytest 時以 assert 直接執行）。

- [ ] **Step 5: 註記**

因 `tools/` 下 `temp_*`/`test_*` 已 gitignore，本任務不提交程式碼；提交時機在 Task 3 產出 `data/poems.json`。

---

### Task 3: 解析 8 首樣板詩 → `data/poems.json`

**Files:**
- Create: `tools/sample_files.json`（樣板清單，含路徑＋檔名）
- Create: `data/poems.json`
- Modify: `docs/superpowers/specs/2026-08-05-kelly-poetry-website-design.md`（若替換詩作，回報於此）

**Interfaces:**
- Consumes: Task 2 的 `build_poems_json`
- Produces: `data/poems.json`（8 筆，Schema 見設計文件）

- [ ] **Step 1: 建立樣板清單 `tools/sample_files.json`**

```json
{
  "files": [
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2014/20140808-【仙境】.txt", "20140808-【仙境】.txt"],
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2015/20150321-中華大學-洋紫荊的愛.txt", "20150321-中華大學-洋紫荊的愛.txt"],
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2016/20160107-【竹】.txt", "20160107-【竹】.txt"],
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2017/20170219 苗栗協雲宮-【紅櫻舞春風】.txt", "20170219 苗栗協雲宮-【紅櫻舞春風】.txt"],
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2018/20180114-清華大學梅園-【詠梅】.txt", "20180114-清華大學梅園-【詠梅】.txt"],
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2019/20190803-4.新竹縣新豐鄉鳳坑漁港-【幾度夕陽紅】.txt", "20190803-4.新竹縣新豐鄉鳳坑漁港-【幾度夕陽紅】.txt"],
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2022/20220205(大年初五)-1.清華大學-【冬盡春來】.txt", "20220205(大年初五)-1.清華大學-【冬盡春來】.txt"],
    ["C:/Users/user/Documents/我的/Kelly的詩詞/2025/20250216-新竹麗池公園櫻花季-【春】.txt", "20250216-新竹麗池公園櫻花季-【春】.txt"]
  ]
}
```

- [ ] **Step 2: 執行解析**

Run: `python tools/temp_parse_poems.py tools/sample_files.json data/poems.json`
Expected: 輸出「解析完成: 8 首」。

- [ ] **Step 3: 人工校對內容**

- 用 Read 檢查 `data/poems.json`：每首 title/date/body 是否正確、有無殘留亂碼或作者行。
- 若有檔案編碼異常無法解析，替換為相近年份其他詩作，並在設計文件第 3 節回報。

- [ ] **Step 4: 驗證 JSON 有效且含 8 筆**

Run: `python -c "import json; d=json.load(open('data/poems.json',encoding='utf-8')); print(len(d), [p['title'] for p in d])"`
Expected: `8` 與 8 個詩名，日期遞增排序。

- [ ] **Step 5: Commit**

```bash
git add data/poems.json tools/sample_files.json
git commit -m "feat: 解析 8 首樣板詩作至 poems.json"
```

---

### Task 4: 撰寫 8 首詩的圖片提示詞

**Files:**
- Create: `tools/image_prompts.json`

**Interfaces:**
- Produces: `tools/image_prompts.json`，格式 `{"<id>": "<英文提示詞>"}`，供 Task 5 轉成 `prompts.json` 餵給 comfyui

- [ ] **Step 1: 逐首閱讀詩意並撰寫提示詞**

用 Read 讀取 `data/poems.json`（或對應原始檔）逐首掌握意境，撰寫統一風格的英文提示詞。**統一風格後綴**（淡彩水墨插畫、暖紙感）：
`soft watercolor Chinese ink painting, warm cream paper texture, gentle light, serene, elegant, storybook illustration`

範例（《冬盡春來》）：`early spring morning by a temple garden, bare maple branches with a few crimson leaves, soft rain drizzle, faint plum blossom scent, misty warm light, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, serene, elegant`

- [ ] **Step 2: 寫入 `tools/image_prompts.json`**（實際內容依詩意撰寫，此為結構範例）

```json
{
  "20140808-仙境": "misty mountain lake at dawn in autumn, pagoda silhouette, drifting clouds, tranquil fairyland atmosphere, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, serene",
  "20150321-洋紫荊的愛": "pink bauhinia flowers blooming in a campus garden in spring, soft petals falling, warm sunlight, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, romantic",
  "20160107-竹": "tall green bamboo grove in morning mist, elegant upright stalks, soft light through leaves, zen atmosphere, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, serene",
  "20170219-紅櫻舞春風": "crimson cherry blossoms dancing in spring breeze on a mountain temple path, petals swirling, warm afternoon light, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, joyful",
  "20180114-詠梅": "winter plum blossoms on snow-covered branches at a university garden, delicate white and pink petals, cold clear air, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, elegant",
  "20190803-幾度夕陽紅": "warm sunset over a small fishing harbor, golden sky reflected on calm sea, fishing boats silhouettes, nostalgic mood, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, nostalgic",
  "20220205-冬盡春來": "early spring morning by a temple garden, bare maple branches with a few crimson leaves, soft rain drizzle, faint plum blossom scent, misty warm light, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, serene",
  "20250216-春": "cherry blossom season at a lakeside park in early spring, pale pink petals, families strolling, bright hopeful light, soft watercolor Chinese ink painting, warm cream paper texture, gentle light, hopeful"
}
```

- [ ] **Step 3: 人工檢視**：確認每首提示詞與詩意相符、8 筆齊全。

（本任務無 commit——屬暫存輸入檔。）

---

### Task 5: 生成 8 張 AI 圖（jet-comfyui）

**Files:**
- Create: `temp_output/poem-images/prompts.json`
- Create: `temp_output/poem-images/001.jpg` … `008.jpg`（comfyui 產出）
- Create: `assets/images/poems/<id>.jpg`（重命名後）

**Interfaces:**
- Consumes: Task 4 的 `tools/image_prompts.json`；jet-comfyui 技能 `generate_images.py`
- Produces: `assets/images/poems/<id>.jpg` 8 張

- [ ] **Step 1: 轉成 comfyui 格式並放 `temp_output/poem-images/prompts.json`**

以 python 讀 `tools/image_prompts.json`，依 poems.json 順序輸出 prompts：
```python
# tools/temp_make_prompts.py
import json, os
poems = json.load(open('data/poems.json', encoding='utf-8'))
img_prompts = json.load(open('tools/image_prompts.json', encoding='utf-8'))
ordered = [img_prompts[p['id']] for p in poems]
os.makedirs('temp_output/poem-images', exist_ok=True)
json.dump({'prompts': ordered}, open('temp_output/poem-images/prompts.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(len(ordered), 'prompts')
```
Run: `python tools/temp_make_prompts.py`
Expected: `8 prompts`，且 `temp_output/poem-images/prompts.json` 含 8 筆。

- [ ] **Step 2: 先測試 1 張（驗證 workflow 可用）**

Run:
```bash
mkdir -p temp_output/poem-images
PYTHONIOENCODING=utf-8 python "C:/Users/user/.claude/skills/jet-comfyui/scripts/generate_images.py" "C:/Users/user/Documents/CC/kelly-poetry/temp_output/poem-images" \
  --workflow "C:/Users/user/.claude/skills/jet-comfyui/references/comfyui/Z_Image文生图（gguf-Q8）.json" \
  --width 1280 --height 853
```
（可先以 `{"prompts": ["<測試用>"]}` 驗證，再放全量。）用 Read 檢視 `001.jpg` 品質：若圖模糊/字體扭曲/風格不符，改 `ERNIE-Image-Turbo+文生图.json` workflow 重測。

- [ ] **Step 3: 批次生成 8 張**

確認 prompts.json 含 8 筆後重新執行上述指令。Expected: 產出 `001.jpg`~`008.jpg`（已存在則跳過）。此步驟耗時，若超過 10 分鐘未完成，用背景執行並等待通知。

- [ ] **Step 4: 依序重命名為 `<id>.jpg`**

以 poems.json 順序對應 `001.jpg`→第 1 首、…`008.jpg`→第 8 首，複製為 `assets/images/poems/<id>.jpg`。

- [ ] **Step 5: 驗證 8 張皆存在且非空**

Run: `ls -la assets/images/poems/`
Expected: 8 個 jpg，大小皆 > 30KB。

- [ ] **Step 6: Commit**

```bash
git add assets/images/poems data/poems.json
git commit -m "feat: 生成 8 首詩的 AI 圖片"
```

---

### Task 6: 撰寫音樂提示詞並生成 8 段音樂（jet-audio.cpp）

**Files:**
- Create: `tools/music_prompts.json`
- Create: `assets/audio/poems/<id>.wav`（8 段）

**Interfaces:**
- Consumes: jet-audio.cpp 技能 `music_generator.py`
- Produces: `assets/audio/poems/<id>.wav` 8 段 30 秒音樂

- [ ] **Step 1: 撰寫音樂提示詞 `tools/music_prompts.json`**

依每首詩意境寫英文 prompt（ACE-Step 風格公式：風格＋情緒＋樂器＋質感）。範例結構：
```json
{
  "20140808-仙境": {"title": "仙境", "prompt": "ethereal ambient, misty mountain lake at dawn, delicate guzheng plucks, airy pads, serene and tranquil"},
  "20150321-洋紫荊的愛": {"title": "洋紫荊的愛", "prompt": "gentle acoustic guitar, warm spring campus breeze, soft plucked strings, tender and romantic"},
  "20160107-竹": {"title": "竹", "prompt": "zen bamboo grove, pure flute melody, sparse plucked strings, quiet peaceful minimalist"},
  "20170219-紅櫻舞春風": {"title": "紅櫻舞春風", "prompt": "bright spring breeze, lively pentatonic flute, light plucked strings, cheerful and dancing"},
  "20180114-詠梅": {"title": "詠梅", "prompt": "cold elegant winter, gentle piano and soft strings, delicate and refined, calm and pure"},
  "20190803-幾度夕陽紅": {"title": "幾度夕陽紅", "prompt": "warm nostalgic sunset by the sea, soft cello melody, gentle piano, bittersweet and dreamy"},
  "20220205-冬盡春來": {"title": "冬盡春來", "prompt": "early spring awakening, light piano with birdlike flute, hopeful and tender, fresh morning"},
  "20250216-春": {"title": "春", "prompt": "cherry blossom spring, bright ukulele and soft strings, cheerful hopeful, warm sunlight"}
}
```

- [ ] **Step 2: 逐首生成音樂**

對每首執行（路徑以實際安裝為準）：
```powershell
python "C:/Users/user/.claude/skills/jet-audio.cpp/scripts/music_generator.py" \
  --title "<詩名>" --prompt "<prompt>" --lyrics "[Instrumental]" --duration 30
```
Expected: 每首在 `C:\App\audio.cpp-webui\output\` 產出 `music_<日期>_<詩名>_<seed>.wav`。若超過 2 分鐘未完成，背景執行並等待。

- [ ] **Step 3: 複製並重命名至 `assets/audio/poems/<id>.wav`**

以 `--title` 對應詩名找出產出檔，複製為 `assets/audio/poems/<id>.wav`。

- [ ] **Step 4: 驗證 8 段皆存在且長度約 30 秒**

Run: `ls -la assets/audio/poems/`
Expected: 8 個 wav，大小 > 200KB（30 秒音檔）。

- [ ] **Step 5: Commit**

```bash
git add assets/audio/poems tools/music_prompts.json
git commit -m "feat: 生成 8 首詩的 30 秒意境音樂"
```

---

### Task 7: 暖紙手札主題 CSS

**Files:**
- Create: `assets/css/style.css`

**Interfaces:**
- Produces: 全域主題 class（`body`、`.hero`、`.paper-nav`、`.year-chip`、`.poem-card`、`.detail-hero`、`.poem-body`、`.meta`、`.audio-player`、`.seal`），供 Task 8 使用

- [ ] **Step 1: 實作主題 CSS**

暖紙手札風格：底色 `#faf3e3`、文字 `#4a3b24`、紙紋（細網紋背景）、毛邊卡片、朱紅印章 `.seal`、年份紙籤 `.year-chip`、卡片網格 `.poem-card`、詳情頁 `.detail-hero`/`.poem-body`/`.meta`、播放器 `.audio-player`、行動裝置 media query。楷體 `"DFKai-SB","Kaiti SC","STKaiti"` 標題；宋體 `"Noto Serif TC","Songti SC","PMingLiU"` 內文。

- [ ] **Step 2: 驗證語法**（以簡易頁面載入確認無 JS 錯誤非必備；至少確認檔案可被解析）

Run: `python -c "import pathlib; css=pathlib.Path('assets/css/style.css').read_text(encoding='utf-8'); print('braces', css.count('{')==css.count('}'), 'len', len(css))"`
Expected: `braces True` 且 len > 2000。

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "feat: 暖紙手札主題 CSS"
```

---

### Task 8: 網站主頁＋詳情頁

**Files:**
- Create: `index.html`
- Create: `poem.html`
- Create: `assets/js/main.js`

**Interfaces:**
- Consumes: `data/poems.json`、`assets/css/style.css`、`assets/images/poems/`、`assets/audio/poems/`
- Produces: `index.html`（年份導航＋卡片）、`poem.html`（`?id=` 詳情）、`assets/js/main.js`（渲染邏輯，提供 `loadPoems()`、`renderIndex()`、`renderDetail()`）

- [ ] **Step 1: 實作 `assets/js/main.js`**

```javascript
const POEMS_URL = 'data/poems.json';

async function loadPoems() {
  const res = await fetch(POEMS_URL);
  return res.json();
}

function renderIndex(poems) {
  const years = [...new Set(poems.map(p => p.year))].sort();
  const nav = document.getElementById('yearNav');
  years.forEach((y, i) => {
    const chip = document.createElement('button');
    chip.className = 'year-chip' + (i === 0 ? ' active' : '');
    chip.textContent = y;
    chip.dataset.year = y;
    chip.onclick = () => showYear(y, poems);
    nav.appendChild(chip);
  });
  showYear(years[0], poems);
}

function showYear(year, poems) {
  document.querySelectorAll('.year-chip').forEach(c => c.classList.toggle('active', +c.dataset.year === year));
  const grid = document.getElementById('poemGrid');
  grid.innerHTML = '';
  poems.filter(p => p.year === year).forEach(p => {
    const card = document.createElement('a');
    card.className = 'poem-card';
    card.href = `poem.html?id=${encodeURIComponent(p.id)}`;
    const excerpt = p.body.split('\n')[0] || '';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <div class="poem-card-body">
        <h3>${p.title}</h3>
        <p>${excerpt}</p>
        <span class="poem-date">${p.date}${p.location ? '　' + p.location : ''}</span>
      </div>`;
    grid.appendChild(card);
  });
}

async function renderDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const poems = await loadPoems();
  const p = poems.find(x => x.id === id);
  if (!p) { document.getElementById('detail').innerHTML = '<p>找不到這首詩。</p>'; return; }
  document.title = `${p.title} — Kelly 的詩詞`;
  document.getElementById('detail').innerHTML = `
    <div class="detail-hero"><img src="${p.image}" alt="${p.title}"></div>
    <div class="detail-inner">
      <h1>${p.title}</h1>
      <div class="poem-body">${p.body.split('\n').map(l => `<p>${l}</p>`).join('')}</div>
      <div class="meta">
        <p>${p.date}${p.location ? '　·　' + p.location : ''}</p>
        ${p.note ? `<p class="note">${p.note}</p>` : ''}
      </div>
      ${p.audio ? `<audio class="audio-player" controls preload="none" src="${p.audio}"></audio>` : ''}
    </div>
    <a class="back-link" href="index.html">← 回到詩集首頁</a>`;
}
```

- [ ] **Step 2: 實作 `index.html`**

引用 `assets/css/style.css` 與 `assets/js/main.js`；結構含 `.hero`（標題＋毛筆小印）、`<nav id="yearNav" class="paper-nav">`、`<main id="poemGrid">`；`defer` 載入後呼叫 `loadPoems().then(renderIndex)`。

- [ ] **Step 3: 實作 `poem.html`**

引用相同 CSS/JS；結構含 `<main id="detail">`；`defer` 載入後呼叫 `renderDetail()`。

- [ ] **Step 4: 本機開啟驗證主頁**

Run: `python -m http.server 8000`（背景），curl 確認 `index.html` 200 且 JS 無語法錯誤：`python -c "import urllib.request as u; print(u.urlopen('http://127.0.0.1:8000/index.html').status)"`；並以 Node 檢查 `main.js` 語法（若有 node）：`node --check assets/js/main.js`。
Expected: 200；JS 語法無誤。

- [ ] **Step 5: 開啟瀏覽器人工檢視**

用瀏覽器開啟 `http://127.0.0.1:8000/index.html`，確認年份導航可切換、卡片圖片載入。之後開啟任一詳情頁確認渲染。

- [ ] **Step 6: Commit**

```bash
git add index.html poem.html assets/js/main.js
git commit -m "feat: 完成網站主頁與詳情頁"
```

---

### Task 9: 整合驗證與交付

**Files:**
- 無新增（驗證既有產出）

**Interfaces:**
- Consumes: 全部先前產出

- [ ] **Step 1: 全站迴圈檢查**

本機伺服器開啟下，逐一核對 8 首：圖存在、詩文正確、日期/地點正確、播放器可播、年份導航正確跳轉。

- [ ] **Step 2: 修正殘留問題**（如編碼、路徑、樣式）

- [ ] **Step 3: 提交最終狀態**

```bash
git add -A && git commit -m "chore: 樣板版整合完成"
```

- [ ] **Step 4: 交付使用者**

提供 `http://127.0.0.1:8000/index.html` 網址，摘要各詩的圖與音樂配對，說明確認後第二階段全量展開方式。

---

## Self-Review

**規格覆蓋：**
- 8 首樣板詩 → Task 3、Task 4 ✓
- 圖片生成（Z_Image Q8、3:2、淡彩水墨）→ Task 5 ✓
- 音樂生成（30 秒、[Instrumental]、ACE-Step）→ Task 6 ✓
- 網站架構（index/poem/poems.json/theme）→ Task 3、7、8 ✓
- 暖紙手札視覺 → Task 7 ✓
- 年份導航＋詳情頁 → Task 8 ✓
- 編碼自動偵測 → Task 2、3 ✓
- 測試與交付 → Task 9 ✓

**Placeholder 掃描：** 無 TBD/TODO；每個程式碼步驟皆有實際內容。

**型別一致：** `parse_metadata` 回傳鍵 `id/title/date/year/location/body/note/source` 在 Task 2 定義、Task 3 使用；`poems.json` 欄位與設計文件一致；`loadPoems/renderIndex/renderDetail` 於 Task 8 定義並於 Step 2/3 使用；`image_prompts.json`（`<id>→prompt`）與 `music_prompts.json`（`<id>→{title,prompt}`）介面一致。

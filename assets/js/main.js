/* ==========================================================================
   KELLY 詩詞書畫 — 前端渲染邏輯
   --------------------------------------------------------------------------
   負責載入 data/poems.json（詩）、data/book.json（書）、
   data/paintings.json（畫），於主頁以頁籤切換三藝視圖；
   於詳情頁（poem.html）渲染單一詩作（含配圖）。
   詩詞部分（loadPoems / renderIndex / showYear / renderDetail）
   為既有功能，僅調整詳情頁標題字串，其餘原樣保留。
   -------------------------------------------------------------------------- */

// 資料來源（相對根目錄）
const POEMS_URL = 'data/poems.json';
const BOOK_URL = 'data/book.json';
const PAINTINGS_URL = 'data/paintings.json';

// 主頁狀態記憶（從詳情頁返回時，還原離開前的年份與捲動位置）
const STORE_YEAR = 'kellyPoetry.year';
const STORE_SCROLL = 'kellyPoetry.scroll';
// 頁籤狀態記憶（詩詞｜書｜畫）
const STORE_TAB = 'kellyPoetry.tab';
// 畫視圖分類記憶（畫竹｜纏繞畫）
const STORE_ART_CAT = 'kellyPoetry.artCat';

// 章節中文數字編號（《我．獨一無二》共 21 章：一…廿一）
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一'];

// 書視圖目前章節索引（由 renderBook 初始化）
let BOOK = null;
let curChapter = 0;

/* ==========================================================================
   詩詞：載入與渲染（既有功能，原樣保留）
   ========================================================================== */

/**
 * 載入詩作資料。
 * 注意：data/poems.json 每筆不含 image 欄位，這裡依命名規則動態補上
 * （assets/images/poems/<id>.jpg）。
 * 因 id 含中文與日文全形字元，以 encodeURIComponent 確保路徑正確。
 */
async function loadPoems() {
  const res = await fetch(POEMS_URL);
  const poems = await res.json();
  poems.forEach(p => {
    p.image = `assets/images/poems/${encodeURIComponent(p.id)}.jpg`;
  });
  return poems;
}

/**
 * 主頁渲染：依年份建立導航紙籤（含「全部」），
 * 預設顯示記憶中的年份；無記憶則顯示全部詩作。
 */
function renderIndex(poems) {
  // 主頁專屬：關閉瀏覽器自動捲動，統一由 sessionStorage 還原
  // （卡片是動態渲染，自動捲動會與渲染時序產生競態）
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // 捲動位置節流寫入，供返回首頁時還原
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      sessionStorage.setItem(STORE_SCROLL, String(window.scrollY));
      ticking = false;
    });
  }, { passive: true });

  const years = [...new Set(poems.map(p => p.year))].sort();
  const nav = document.getElementById('yearNav');
  // 「全部」紙籤置首
  const allChip = document.createElement('button');
  allChip.className = 'year-chip';
  allChip.textContent = '全部';
  allChip.dataset.year = 'all';
  allChip.onclick = () => showYear('all', poems);
  nav.appendChild(allChip);

  years.forEach((y) => {
    const chip = document.createElement('button');
    chip.className = 'year-chip';
    chip.textContent = y;
    chip.dataset.year = y;
    chip.onclick = () => showYear(y, poems);
    nav.appendChild(chip);
  });

  // 預設顯示：記憶的年份；無記憶則顯示「全部」
  const saved = sessionStorage.getItem(STORE_YEAR);
  const initial = (saved === null || saved === '') ? 'all' : saved;
  showYear(initial, poems, true);
}

/**
 * 依年份過濾並渲染詩作卡片。「all」代表全部詩作。
 * restoreScroll 為真時（自詳情頁返回的首次渲染），還原離開前的捲動位置。
 */
function showYear(year, poems, restoreScroll) {
  sessionStorage.setItem(STORE_YEAR, String(year));
  document.querySelectorAll('.year-chip').forEach(c =>
    c.classList.toggle('is-active', c.dataset.year === String(year)));

  const grid = document.getElementById('poemGrid');
  grid.innerHTML = '';

  const list = (String(year) === 'all')
    ? poems
    : poems.filter(p => String(p.year) === String(year));

  list.forEach(p => {
    const card = document.createElement('a');
    card.className = 'poem-card';
    card.href = `poem.html?id=${encodeURIComponent(p.id)}`;
    const excerpt = p.body.split('\n')[0] || '';
    card.innerHTML = `
      <div class="thumb"><img src="${p.image}" alt="${p.title}" loading="lazy"></div>
      <div class="card-body">
        <h2>${p.title}</h2>
        <p class="excerpt">${excerpt}</p>
        <div class="card-meta">
          <span>${p.date}</span>
          ${p.location ? `<span>${p.location}</span>` : ''}
        </div>
      </div>`;
    grid.appendChild(card);
  });

  // 僅在返回首頁的首次渲染時還原捲動（雙 rAF 等卡片渲染完成）。
  // 以瞬間定位（scroll-behavior: auto）取代 smooth，避免返回時
  // 產生「從頂端向下滑動」的動畫。
  if (restoreScroll) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const y = sessionStorage.getItem(STORE_SCROLL);
      if (y !== null) {
        const html = document.documentElement;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, +y);
        html.style.scrollBehavior = '';
      }
    }));
  }
}

/**
 * 詳情頁渲染：依網址 ?id= 顯示單一詩作（含配圖、詩文與詮釋資料）。
 */
async function renderDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const poems = await loadPoems();
  const p = poems.find(x => x.id === id);
  const detail = document.getElementById('detail');

  if (!p) {
    detail.innerHTML = '<p class="back-link">找不到這首詩。<br>' +
      '<a href="index.html">← 回到詩集首頁</a></p>';
    return;
  }

  document.title = `${p.title} — KELLY 詩詞書畫`;
  detail.innerHTML = `
    <div class="detail-hero">
      <img src="${p.image}" alt="${p.title}">
      <h1 class="title">${p.title}</h1>
    </div>
    <div class="poem-body">
      <p class="poem-text">${p.body}</p>
      ${p.note ? `<p class="note">${p.note}</p>` : ''}
    </div>
    <div class="meta">
      <span class="item"><span class="label">日期</span>${p.date}</span>
      ${p.location ? `<span class="item"><span class="label">地點</span>${p.location}</span>` : ''}
    </div>
    <p class="back-link"><a href="index.html" id="backBtn">← 返回</a></p>`;

  // 「返回」優先回上一頁（保留列表年份與捲動）；直接開啟詳情頁（無來源頁）則回首頁。
  // 以 document.referrer 判斷是否真有上一頁，比 history.length 更可靠（跨瀏覽器一致）。
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      if (document.referrer) {
        e.preventDefault();
        window.history.back();
      }
      // 無 referrer：保留 <a href="index.html"> 默認行為回首頁
    });
  }
}

/* ==========================================================================
   書：《我．獨一無二》章節閱讀（loadBook / renderBook / openChapter）
   ========================================================================== */

/** 載入書籍資料（章節 body 逐字保留原文）。 */
async function loadBook() {
  const res = await fetch(BOOK_URL);
  return res.json();
}

/**
 * 書視圖渲染：書封（書名／作者／tagline）＋ 21 章目錄，
 * 並開啟第一章（含上一章／下一章按鈕與目錄目前章標記）。
 */
function renderBook(book) {
  // 書視圖必然在首頁 DOMContentLoaded 後渲染，於此初始化頁籤
  initTabs();

  BOOK = book;
  document.getElementById('bookTitle').textContent = book.title;
  document.getElementById('bookAuthor').textContent = book.author;

  const tocList = document.getElementById('tocList');
  book.chapters.forEach((ch, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'toc-item';
    el.innerHTML = `<span class="no">${CN[i] || (i + 1)}</span><span>${ch.title}</span>`;
    el.addEventListener('click', () => openChapter(i));
    tocList.appendChild(el);
  });

  // 預處理插圖：依 at 排序、過濾 at 越界（越界丟棄並 console.warn）
  book.chapters.forEach(ch => {
    if (!Array.isArray(ch.illustrations)) return;
    const lineCount = ch.body.split('\n').length;
    ch.illustrations = ch.illustrations
      .filter(it => {
        const ok = Number.isInteger(it.at) && it.at >= 0 && it.at < lineCount;
        if (!ok) {
          console.warn(`[書]「${ch.title}」插圖 at=${it.at} 越界（正文 ${lineCount} 行），已略過`);
        }
        return ok;
      })
      .sort((a, b) => a.at - b.at);
  });

  document.getElementById('prevBtn').addEventListener('click', () => {
    if (curChapter > 0) openChapter(curChapter - 1);
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (curChapter < BOOK.chapters.length - 1) openChapter(curChapter + 1);
  });

  openChapter(0);
}

/**
 * 開啟第 i 章：填入章節編號與標題、正文（逐字保留原文換行）；
 * 有插圖的章節以拆行方式於 at 行後穿插 <figure>，無插圖維持 textContent。
 * 同步目前章標記與上下章按鈕狀態。
 */
function openChapter(i) {
  const ch = BOOK.chapters[i];
  document.getElementById('readerNo').textContent = `第${CN[i] || (i + 1)}章`;
  document.getElementById('readerTitle').textContent = ch.title;
  const readerBody = document.getElementById('readerBody');
  const illus = (Array.isArray(ch.illustrations) ? ch.illustrations : [])
    .filter(it => Number.isInteger(it.at));
  if (!illus.length) {
    // 無插圖章節：維持原本 textContent 行為（.reader-body 靠 pre-line 保留換行）
    readerBody.textContent = ch.body;
  } else {
    // 有插圖：拆行逐一建立文字節（含 \n），並於 at 行後插入 <figure>
    // 文字節串接結果 == ch.body（逐字，含 \n）
    const byAt = new Map(illus.map(it => [it.at, it]));
    const lines = ch.body.split('\n');
    readerBody.textContent = '';
    lines.forEach((line, ln) => {
      readerBody.appendChild(document.createTextNode(line));
      if (ln < lines.length - 1) {
        readerBody.appendChild(document.createTextNode('\n'));
      }
      const it = byAt.get(ln);
      if (it) {
        const fig = document.createElement('figure');
        fig.className = 'book-figure';
        const img = document.createElement('img');
        img.src = `assets/images/book/${it.file}`;
        img.alt = it.alt || '';
        img.loading = 'lazy';
        img.onerror = () => { img.classList.add('is-missing'); };
        fig.appendChild(img);
        readerBody.appendChild(fig);
      }
    });
  }
  curChapter = i;
  document.getElementById('prevBtn').disabled = i === 0;
  document.getElementById('nextBtn').disabled = i === BOOK.chapters.length - 1;
  document.querySelectorAll('.toc-item').forEach((el, j) =>
    el.classList.toggle('is-active', j === i));
}

/* ==========================================================================
   畫：作品網格（loadPaintings / renderPaintings，素材待補，先佔位）
   ========================================================================== */

/** 載入畫作資料。每筆 {id, category, title, image}。 */
async function loadPaintings() {
  const res = await fetch(PAINTINGS_URL);
  return res.json();
}

/**
 * 畫視圖渲染：依 data.categories 建立分類導航（畫竹｜纏繞畫），
 * 並顯示記憶中的分類（無記憶則第一類）。
 */
function renderPaintings(data) {
  const grid = document.getElementById('artGrid');
  const nav = document.getElementById('artNav');
  if (!nav) return;
  const list = (data && data.paintings) || [];
  const cats = (data && data.categories) || [];

  if (!cats.length) {
    nav.innerHTML = '';
    grid.innerHTML = '';
    const el = document.createElement('p');
    el.className = 'art-empty';
    el.textContent = '畫作整理中，敬請期待';
    grid.appendChild(el);
    return;
  }

  // 建立分類 tab（沿用 .tab 視覺，但用獨立 .art-tab class，
  // 避免與主視圖 .tab 的 querySelectorAll('.tab') 綁定衝突）
  nav.innerHTML = '';
  cats.forEach(c => {
    const b = document.createElement('button');
    b.className = 'art-tab';
    b.textContent = c;
    b.dataset.cat = c;
    b.onclick = () => showArtCategory(c, list);
    nav.appendChild(b);
  });

  // 預設顯示：記憶的分類若仍存在則用之；否則第一個分類
  const saved = sessionStorage.getItem(STORE_ART_CAT);
  const initial = (saved && cats.includes(saved)) ? saved : cats[0];
  showArtCategory(initial, list);
}

/**
 * 依分類過濾並渲染畫作卡片（純圖片卡，不顯示標題）。
 * 圖片路徑只對檔名最後一段 encodeURIComponent（詩作先例），
 * 避免把 `/` 也編碼。
 */
function showArtCategory(cat, paintings) {
  sessionStorage.setItem(STORE_ART_CAT, String(cat));
  document.querySelectorAll('.art-tab').forEach(b =>
    b.classList.toggle('is-active', b.dataset.cat === String(cat)));

  const grid = document.getElementById('artGrid');
  grid.innerHTML = '';

  const list = paintings.filter(p => p.category === cat);
  if (!list.length) {
    const el = document.createElement('p');
    el.className = 'art-empty';
    el.textContent = `${cat}整理中，敬請期待`;
    grid.appendChild(el);
    return;
  }

  const dir = 'assets/images/paintings/';
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'art-card';
    const fig = document.createElement('div');
    fig.className = 'thumb';
    const img = document.createElement('img');
    img.src = dir + encodeURIComponent(p.image.split('/').pop());
    img.alt = p.title || p.id;
    img.loading = 'lazy';
    img.onerror = () => fig.classList.add('is-missing');
    fig.appendChild(img);
    card.appendChild(fig);
    grid.appendChild(card);
  });
}

/* ==========================================================================
   頁籤：詩詞｜書｜畫 切換（initTabs）
   ========================================================================== */

/**
 * 綁定首頁三個頁籤的點擊切換，並把目前頁籤存入 sessionStorage，
 * 供重新載入／返回首頁時還原上次所在視圖（無記憶則維持預設詩詞）。
 */
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  if (!tabs.length) return;

  const setTab = (view) => {
    tabs.forEach(t => t.classList.toggle('is-active', t.dataset.view === view));
    document.querySelectorAll('.view').forEach(v =>
      v.classList.toggle('is-active', v.id === `view-${view}`));
    sessionStorage.setItem(STORE_TAB, view);
  };

  tabs.forEach(t => t.addEventListener('click', () => setTab(t.dataset.view)));

  const saved = sessionStorage.getItem(STORE_TAB);
  if (saved && document.getElementById(`view-${saved}`)) {
    setTab(saved);
  }
}

/* ==========================================================================
   Kelly 的詩詞 — 前端渲染邏輯
   --------------------------------------------------------------------------
   負責載入 data/poems.json，並於主頁渲染年份導航與詩作卡片、
   於詳情頁渲染單一詩作（含配圖）。
   -------------------------------------------------------------------------- */

// 詩作資料來源（相對根目錄）
const POEMS_URL = 'data/poems.json';

// 主頁狀態記憶（從詳情頁返回時，還原離開前的年份與捲動位置）
const STORE_YEAR = 'kellyPoetry.year';
const STORE_SCROLL = 'kellyPoetry.scroll';

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

  // 僅在返回首頁的首次渲染時還原捲動（雙 rAF 等卡片渲染完成）
  if (restoreScroll) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const y = sessionStorage.getItem(STORE_SCROLL);
      if (y !== null) window.scrollTo(0, +y);
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

  document.title = `${p.title} — Kelly 的詩詞`;
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

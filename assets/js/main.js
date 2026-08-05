/* ==========================================================================
   Kelly 的詩詞 — 前端渲染邏輯
   --------------------------------------------------------------------------
   負責載入 data/poems.json，並於主頁渲染年份導航與詩作卡片、
   於詳情頁渲染單一詩作（含配圖與音樂）。
   -------------------------------------------------------------------------- */

// 詩作資料來源（相對根目錄）
const POEMS_URL = 'data/poems.json';

/**
 * 載入詩作資料。
 * 注意：data/poems.json 每筆不含 image/audio 欄位，這裡依命名規則動態補上
 * （assets/images/poems/<id>.jpg 與 assets/audio/poems/<id>.wav）。
 * 因 id 含中文與日文全形字元，以 encodeURIComponent 確保路徑正確。
 */
async function loadPoems() {
  const res = await fetch(POEMS_URL);
  const poems = await res.json();
  poems.forEach(p => {
    p.image = `assets/images/poems/${encodeURIComponent(p.id)}.jpg`;
    p.audio = `assets/audio/poems/${encodeURIComponent(p.id)}.wav`;
  });
  return poems;
}

/**
 * 主頁渲染：依年份建立導航紙籤，並顯示第一個（最新）年份的詩作。
 */
function renderIndex(poems) {
  const years = [...new Set(poems.map(p => p.year))].sort();
  const nav = document.getElementById('yearNav');
  years.forEach((y, i) => {
    const chip = document.createElement('button');
    chip.className = 'year-chip' + (i === 0 ? ' is-active' : '');
    chip.textContent = y;
    chip.dataset.year = y;
    chip.onclick = () => showYear(y, poems);
    nav.appendChild(chip);
  });
  showYear(years[0], poems);
}

/**
 * 依年份過濾並渲染詩作卡片。
 */
function showYear(year, poems) {
  document.querySelectorAll('.year-chip').forEach(c =>
    c.classList.toggle('is-active', +c.dataset.year === year));

  const grid = document.getElementById('poemGrid');
  grid.innerHTML = '';

  poems.filter(p => p.year === year).forEach(p => {
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
}

/**
 * 詳情頁渲染：依網址 ?id= 顯示單一詩作（含配圖、詩文、詮釋資料與音樂）。
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
    <div class="audio-player">
      <audio controls preload="none" src="${p.audio}"></audio>
    </div>
    <p class="back-link"><a href="index.html">← 回到詩集首頁</a></p>`;
}

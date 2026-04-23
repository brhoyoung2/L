/* Book cover CSS renderer */

const GRADE_LABEL = { elementary: '초등', middle: '중등', high: '고등' };

function renderDeco(deco, coverColor) {
  const isDark = isColorDark(coverColor);
  switch (deco) {
    case 'circle':
      return `<div class="book-card__deco book-card__deco--circle"></div>`;
    case 'quote':
      return `<div class="book-card__deco book-card__deco--quote"></div>`;
    case 'lines':
      return `<div class="book-card__deco book-card__deco--lines">
        <span></span><span></span><span></span>
      </div>`;
    case 'square':
      return `<div class="book-card__deco book-card__deco--square"></div>`;
    default:
      return '';
  }
}

function isColorDark(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0,2),16);
  const g = parseInt(c.slice(2,4),16);
  const b = parseInt(c.slice(4,6),16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function renderBookCard(book) {
  const isDark = isColorDark(book.cover_color);
  const textColor = isDark ? '#fff' : '#2A1F5C';

  const coverImg = book.cover_data_url || book.image_url || null;
  const coverStyle = coverImg
    ? `background-color:${book.cover_color||'#3D3080'};background-image:url('${coverImg}');background-size:cover;background-position:center`
    : `background-color:${book.cover_color||'#3D3080'}`;

  const isLocal = String(book.book_id).startsWith('local_');

  return `
    <div class="book-card" data-action="open-book" data-book-id="${book.book_id}">
      <div class="book-card__cover" style="${coverStyle}">
        ${!coverImg ? renderDeco(book.cover_deco, book.cover_color) : ''}
        ${!coverImg ? `<div class="book-card__cover-author" style="color:${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(42,31,92,0.6)'}">${book.author}</div>` : ''}
        ${!coverImg ? `<div class="book-card__cover-title" style="color:${textColor}">${book.title}</div>` : ''}
        <div class="book-edit-overlay">
          <button class="book-edit-btn" data-edit-action="edit">✏️ 내용 편집</button>
          ${isLocal
            ? `<button class="book-edit-btn book-edit-btn--ghost" data-edit-action="cover">🖼 표지 변경</button>`
            : `<button class="book-edit-btn book-edit-btn--ghost" data-edit-action="sheets">☁️ Sheets 편집</button>`}
        </div>
      </div>
      <div class="book-card__info">
        <div class="book-card__title">${book.title}</div>
        <div class="book-card__author">${book.author} · ${book.year}</div>
        <div class="book-card__metrics">
          <span>👁 ${(book.view_count||0).toLocaleString()}</span>
          <span>❤️ ${(book.like_count||0).toLocaleString()}</span>
          <span>💬 ${book.comment_count||0}</span>
        </div>
      </div>
    </div>`;
}

function renderBookSection(category, books) {
  if (!books.length) return '';
  const hasGradeTabs = category.category_id === 'cat_grade_best';
  return `
    <section class="book-section" id="section-${category.category_id}">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-header__title">${category.name}</h2>
          </div>
          <a class="section-header__more" href="category.html?id=${category.category_id}">전체보기 →</a>
        </div>
        ${hasGradeTabs ? renderGradeTabs() : ''}
        <div class="book-scroll" id="scroll-${category.category_id}">
          ${books.map(renderBookCard).join('')}
        </div>
      </div>
    </section>`;
}

function renderGradeTabs() {
  return `
    <div class="grade-tabs">
      <button class="grade-tab grade-tab--active" data-grade="all">전체</button>
      <button class="grade-tab" data-grade="elementary">초등</button>
      <button class="grade-tab" data-grade="middle">중등</button>
      <button class="grade-tab" data-grade="high">고등</button>
    </div>`;
}

function renderWebtoonCard(wt) {
  let grad = { from: '#3D3080', to: '#6B5CB5' };
  try { grad = JSON.parse(wt.thumbnail_gradient); } catch(e) {}
  return `
    <div class="book-card" style="width:160px">
      <div class="book-card__cover" style="background:linear-gradient(135deg,${grad.from},${grad.to});height:210px;border-radius:var(--radius-lg)">
        <div style="position:absolute;bottom:12px;left:10px;right:10px;font-size:11px;font-weight:700;color:#fff;line-height:1.3">${wt.title}</div>
        <div style="position:absolute;top:10px;right:8px;background:rgba(0,0,0,0.25);color:#fff;font-size:9px;padding:2px 6px;border-radius:var(--radius-pill)">${wt.panel_count}컷</div>
      </div>
      <div class="book-card__info">
        <div class="book-card__title" style="font-size:12px">${wt.title}</div>
        <div class="book-card__author">${wt.creator_name} · ${GRADE_LABEL[wt.creator_grade] || wt.creator_grade}</div>
        <div class="book-card__metrics">
          <span>👁 ${parseNum(wt.view_count).toLocaleString()}</span>
          <span>❤️ ${parseNum(wt.like_count)}</span>
        </div>
      </div>
    </div>`;
}

function parseNum(v) { return Number(v) || 0; }

/* 그리드 카드 (카테고리/검색 페이지용 — 유연한 너비) */
function renderGridCard(book, highlight) {
  const isDark = isColorDark(book.cover_color);
  const textColor = isDark ? '#fff' : '#2A1F5C';
  const hl = (text) => {
    if (!highlight) return text;
    const re = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return text.replace(re, '<mark style="background:#fff0a0;border-radius:2px">$1</mark>');
  };

  const gridCoverImg = book.cover_data_url || book.image_url || null;
  const coverBg = gridCoverImg
    ? `background-color:${book.cover_color||'#3D3080'};background-image:url('${gridCoverImg}');background-size:cover;background-position:center`
    : `background-color:${book.cover_color||'#3D3080'}`;

  return `
    <div class="book-card book-card--grid" data-action="open-book" data-book-id="${book.book_id}">
      <div class="book-card__cover" style="${coverBg};width:100%;height:0;padding-bottom:133%;position:relative;border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-card)">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
          ${!gridCoverImg ? renderDeco(book.cover_deco, book.cover_color) : ''}
          ${!gridCoverImg ? `<div style="position:absolute;bottom:10px;left:8px;right:8px;font-size:12px;font-weight:700;color:${textColor};line-height:1.3;text-shadow:0 1px 3px rgba(0,0,0,0.2)">${book.title}</div>` : ''}
          ${!gridCoverImg ? `<div style="position:absolute;top:8px;right:8px;font-size:10px;color:${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(42,31,92,0.6)'}">${book.author}</div>` : ''}
        </div>
      </div>
      <div class="book-card__info" style="padding:0;margin-top:10px">
        <div class="book-card__title" style="font-size:13px">${hl(book.title)}</div>
        <div class="book-card__author">${hl(book.author)} · ${book.year}</div>
        <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
          ${book.genre_tags.slice(0,2).map(t => `<span class="chip" style="padding:2px 8px;font-size:10px">#${t}</span>`).join('')}
        </div>
        <div class="book-card__metrics" style="margin-top:6px">
          <span>👁 ${parseNum(book.view_count).toLocaleString()}</span>
          <span>❤️ ${parseNum(book.like_count).toLocaleString()}</span>
          <span>🎨 ${parseNum(book.webtoon_count)}</span>
        </div>
      </div>
    </div>`;
}

window.TB = window.TB || {};
Object.assign(window.TB, { renderBookCard, renderBookSection, renderWebtoonCard, renderGridCard });

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
  const badges = [];
  if (book.is_featured) badges.push('<span class="badge badge--featured">★ 추천</span>');
  if (book.categories.includes('cat_new')) badges.push('<span class="badge badge--new">NEW</span>');
  if (book.categories.includes('cat_webtoon')) badges.push('<span class="badge badge--webtoon">웹툰</span>');

  return `
    <div class="book-card" data-action="open-book" data-book-id="${book.book_id}">
      <div class="book-card__cover" style="background:${book.cover_color}">
        ${renderDeco(book.cover_deco, book.cover_color)}
        ${badges.length ? `<div style="position:absolute;top:10px;left:10px;display:flex;gap:4px;flex-wrap:wrap">${badges.join('')}</div>` : ''}
        <div class="book-card__cover-author" style="color:${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(42,31,92,0.6)'}">${book.author}</div>
        <div class="book-card__cover-title" style="color:${textColor}">${book.title}</div>
      </div>
      <div class="book-card__info">
        <div class="book-card__title">${book.title}</div>
        <div class="book-card__author">${book.author} · ${book.year}</div>
        <div class="book-card__metrics">
          <span>👁 ${book.view_count.toLocaleString()}</span>
          <span>❤️ ${book.like_count.toLocaleString()}</span>
          <span>💬 ${book.comment_count}</span>
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
            <div class="section-header__label">${category.label || category.name}</div>
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

window.TB = window.TB || {};
Object.assign(window.TB, { renderBookCard, renderBookSection, renderWebtoonCard });

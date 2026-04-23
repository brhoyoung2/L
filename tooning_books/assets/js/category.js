(async function initCategory() {

  const params   = new URLSearchParams(location.search);
  const catId    = params.get('id');
  let   grade    = params.get('grade') || 'all';
  let   sort     = params.get('sort')  || 'popular';
  let   page     = Number(params.get('p')) || 1;
  const PER_PAGE = 20;

  /* ── 관리자 모드 ── */
  if (params.get('admin') === 'true') localStorage.setItem('tb_admin_mode', 'true');
  if (localStorage.getItem('tb_admin_mode') === 'true') {
    document.getElementById('admin-badge').style.display = 'inline-flex';
  }

  /* ── 데이터 로드 ── */
  let allBooks = [], categories = [];
  try {
    [allBooks, categories] = await Promise.all([TB.getBooks(), TB.getCategories()]);
  } catch (err) {
    console.error('데이터 로드 실패', err);
    return;
  }

  /* ── 검색 연결 ── */
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) location.href = `search.html?q=${encodeURIComponent(q)}`;
      }
    });
  }

  /* ── 분기: 전체 카테고리 목록 vs 특정 카테고리 ── */
  if (!catId) {
    renderAllCategories(categories, allBooks);
    return;
  }

  const category = categories.find(c => c.category_id === catId);
  if (!category) {
    renderAllCategories(categories, allBooks);
    return;
  }

  document.title = `${category.name} — TOONING BOOKS`;

  /* ── 단일 카테고리 뷰 ── */
  document.getElementById('all-cats-view').style.display   = 'none';
  document.getElementById('single-cat-view').style.display = 'block';
  document.getElementById('filter-bar').style.display      = 'block';
  document.getElementById('bc-sep2').style.display         = '';
  document.getElementById('bc-catname').textContent        = category.name;

  /* 히어로 */
  const catEl = document.getElementById('cat-hero');
  catEl.style.borderBottom = `4px solid ${category.color}`;

  document.getElementById('hero-label').textContent = 'CATEGORY';
  document.getElementById('hero-title').textContent = category.name;

  const catBooks = TB.getBooksInCategory(allBooks, catId);

  /* 학년 탭 (히어로용) */
  const grades = [
    { key: 'all',         label: `전체 ${catBooks.length}` },
    { key: 'elementary',  label: `초등 ${catBooks.filter(b => b.grade === 'elementary').length}` },
    { key: 'middle',      label: `중등 ${catBooks.filter(b => b.grade === 'middle').length}` },
    { key: 'high',        label: `고등 ${catBooks.filter(b => b.grade === 'high').length}` },
  ];
  document.getElementById('hero-grade-tabs').innerHTML = grades.map(g => `
    <button class="chip${g.key === grade ? ' chip--active' : ''}" data-hero-grade="${g.key}">${g.label}</button>
  `).join('');

  /* 정렬 셀렉트 초기값 */
  document.getElementById('sort-select').value = sort;

  /* 초기 렌더 */
  renderGrid();

  /* ── 이벤트 ── */
  document.addEventListener('click', e => {
    /* 히어로 학년 탭 */
    const heroTab = e.target.closest('[data-hero-grade]');
    if (heroTab) {
      grade = heroTab.dataset.heroGrade;
      page  = 1;
      document.querySelectorAll('[data-hero-grade]').forEach(b =>
        b.classList.toggle('chip--active', b.dataset.heroGrade === grade));
      syncGradeTab();
      renderGrid();
    }

    /* 도서 카드 클릭 */
    const card = e.target.closest('[data-action="open-book"]');
    if (card) location.href = `detail.html?book_id=${card.dataset.bookId}`;

    /* 보기 방식 */
    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('view-btn--active'));
      viewBtn.classList.add('view-btn--active');
      const grid = document.getElementById('book-grid');
      if (viewBtn.dataset.view === 'list') {
        grid.classList.add('book-grid--list');
      } else {
        grid.classList.remove('book-grid--list');
      }
    }

    /* 페이지네이션 */
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
      page = Number(pageBtn.dataset.page);
      renderGrid();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* 필터 초기화 */
    if (e.target.closest('#clear-filters')) {
      grade = 'all';
      sort  = 'popular';
      document.getElementById('sort-select').value = 'popular';
      document.querySelectorAll('[data-hero-grade]').forEach(b =>
        b.classList.toggle('chip--active', b.dataset.heroGrade === 'all'));
      renderGrid();
    }
  });

  document.getElementById('sort-select').addEventListener('change', e => {
    sort = e.target.value;
    page = 1;
    renderGrid();
  });

  /* ─── 렌더 함수 ─── */

  function syncGradeTab() {
    document.querySelectorAll('[data-hero-grade]').forEach(b =>
      b.classList.toggle('chip--active', b.dataset.heroGrade === grade));
  }

  function renderGrid() {
    let filtered = catBooks;

    /* 학년 필터 */
    if (grade !== 'all') filtered = filtered.filter(b => b.grade === grade);

    /* 정렬 */
    filtered = [...filtered].sort((a, b) => {
      if (sort === 'popular') return b.view_count - a.view_count;
      if (sort === 'latest')  return b.year - a.year;
      if (sort === 'likes')   return b.like_count - a.like_count;
      if (sort === 'title')   return a.title.localeCompare(b.title, 'ko');
      return 0;
    });

    /* 필터 바 업데이트 */
    renderFilterBar(filtered.length);

    /* 빈 결과 */
    const grid    = document.getElementById('book-grid');
    const empty   = document.getElementById('empty-state');
    const pagNav  = document.getElementById('pagination');

    if (!filtered.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      pagNav.style.display = 'none';
      return;
    }
    empty.style.display = 'none';

    /* 페이지네이션 */
    const total  = filtered.length;
    const pages  = Math.ceil(total / PER_PAGE);
    page         = Math.min(page, pages);
    const sliced = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    /* 결과 메타 */
    document.getElementById('result-meta').style.display = '';
    document.getElementById('result-meta').textContent =
      `${total}권 중 ${(page-1)*PER_PAGE + 1}–${Math.min(page*PER_PAGE, total)}권 표시`;

    /* 그리드 */
    grid.innerHTML = sliced.map(b => TB.renderGridCard(b)).join('');

    /* 페이지네이션 */
    if (pages > 1) {
      pagNav.style.display = 'flex';
      pagNav.innerHTML     = buildPagination(page, pages);
    } else {
      pagNav.style.display = 'none';
    }
  }

  function renderFilterBar(count) {
    const activeFilters = document.getElementById('active-filters');
    const chips = [];
    if (grade !== 'all') chips.push(`<span class="chip chip--active" style="font-size:12px">${GRADE_LABEL[grade]} <button data-hero-grade="all" style="border:none;background:none;cursor:pointer;margin-left:4px;color:inherit">✕</button></span>`);
    if (sort !== 'popular') chips.push(`<span class="chip chip--active" style="font-size:12px">${SORT_LABEL[sort]}</span>`);
    if (chips.length) chips.push(`<button id="clear-filters" style="font-size:12px;color:var(--color-danger);background:none;border:none;cursor:pointer;font-family:var(--font-family)">전체 초기화</button>`);
    activeFilters.innerHTML = chips.join('');
  }

  /* ─── 전체 카테고리 목록 ─── */

  function renderAllCategories(cats, books) {
    document.title = '카테고리 — TOONING BOOKS';
    const chipsEl = document.getElementById('cat-list-chips');
    chipsEl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;width:100%';
    chipsEl.innerHTML = cats.map(c => {
      const cnt = TB.getBooksInCategory(books, c.category_id).length;
      return `<a href="category.html?id=${c.category_id}"
        style="display:flex;flex-direction:column;gap:6px;padding:20px 16px 18px;
               background:#fff;
               border:1.5px solid rgba(0,0,0,0.08);
               border-top:4px solid ${c.color};
               border-radius:var(--radius-lg);text-decoration:none;
               text-align:center;
               box-shadow:0 2px 10px rgba(0,0,0,0.07);
               transition:transform 0.15s,box-shadow 0.15s"
        onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.13)'"
        onmouseout="this.style.transform='';this.style.boxShadow='0 2px 10px rgba(0,0,0,0.07)'">
        <span style="font-size:26px;font-weight:800;color:${c.color};line-height:1">${cnt}</span>
        <span style="font-size:14px;font-weight:700;color:var(--color-text);margin-top:2px">${c.name}</span>
        <span style="font-size:10px;color:var(--color-text-3);letter-spacing:1.5px;text-transform:uppercase">${c.label || ''}</span>
      </a>`;
    }).join('');
  }

})();

const SORT_LABEL  = { popular: '인기순', latest: '최신순', likes: '좋아요순', title: '제목순' };

function buildPagination(current, total) {
  const delta = 2;
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      pages.push(i);
    }
  }

  let html = `<button class="page-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>‹</button>`;
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) html += `<span class="page-ellipsis">…</span>`;
    html += `<button class="page-btn ${p === current ? 'page-btn--active' : ''}" data-page="${p}">${p}</button>`;
    prev = p;
  }
  html += `<button class="page-btn" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>›</button>`;
  return html;
}

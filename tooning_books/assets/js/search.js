(async function initSearch() {

  const params = new URLSearchParams(location.search);
  let query    = params.get('q') || '';
  let grade    = params.get('grade') || 'all';
  let page     = Number(params.get('p')) || 1;
  const PER_PAGE = 20;

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = query;

  /* ── 데이터 로드 ── */
  let allBooks = [], categories = [];
  try {
    [allBooks, categories] = await Promise.all([TB.getBooks(), TB.getCategories()]);
  } catch (err) {
    document.getElementById('loading-state').innerHTML =
      '<p style="color:var(--color-text-3)">데이터를 불러올 수 없습니다.</p>';
    return;
  }

  /* ── 검색 실행 ── */
  if (query) {
    runSearch(query, grade, page);
  } else {
    showEmpty('검색어를 입력하세요', '제목, 작가, 장르 태그로 검색할 수 있어요.');
  }

  /* ── 이벤트 ── */
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) {
          query = q;
          page  = 1;
          history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
          runSearch(q, grade, page);
        }
      }
    });
  }

  document.addEventListener('click', e => {
    const card = e.target.closest('[data-action="open-book"]');
    if (card) location.href = `detail.html?book_id=${card.dataset.bookId}`;

    /* 학년 필터 */
    const gradeBtn = e.target.closest('[data-filter-grade]');
    if (gradeBtn) {
      grade = gradeBtn.dataset.filterGrade;
      page  = 1;
      document.querySelectorAll('[data-filter-grade]').forEach(b =>
        b.classList.toggle('chip--active', b.dataset.filterGrade === grade));
      runSearch(query, grade, page);
    }

    /* 태그 클릭 */
    const tagBtn = e.target.closest('[data-tag-search]');
    if (tagBtn) {
      query = tagBtn.dataset.tagSearch;
      if (searchInput) searchInput.value = query;
      runSearch(query, grade, 1);
    }

    /* 페이지 이동 */
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
      page = Number(pageBtn.dataset.page);
      runSearch(query, grade, page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  /* ─── 검색 함수 ─── */

  function runSearch(q, gradeFilter, currentPage) {
    document.title = `"${q}" 검색 — TOONING BOOKS`;
    document.getElementById('loading-state').style.display = 'none';

    const keywords = q.toLowerCase().trim().split(/\s+/);
    let results = allBooks.filter(b => {
      const haystack = [b.title, b.author, b.subtitle, ...b.genre_tags]
        .join(' ').toLowerCase();
      return keywords.every(kw => haystack.includes(kw));
    });

    /* 학년 필터 */
    if (gradeFilter !== 'all') results = results.filter(b => b.grade === gradeFilter);

    /* 필터 칩 */
    const filterEl = document.getElementById('filter-chips');
    filterEl.style.display = 'flex';
    filterEl.innerHTML = [
      { key: 'all', label: `전체 ${allBooks.filter(b => matchesQuery(b, q)).length}` },
      { key: 'elementary', label: `초등 ${allBooks.filter(b => matchesQuery(b, q) && b.grade === 'elementary').length}` },
      { key: 'middle', label: `중등 ${allBooks.filter(b => matchesQuery(b, q) && b.grade === 'middle').length}` },
      { key: 'high', label: `고등 ${allBooks.filter(b => matchesQuery(b, q) && b.grade === 'high').length}` },
    ].map(g =>
      `<button class="chip${g.key === gradeFilter ? ' chip--active' : ''}" data-filter-grade="${g.key}">${g.label}</button>`
    ).join('');

    /* 결과 없음 */
    if (!results.length) {
      showEmpty(
        `"${q}"에 대한 결과가 없어요`,
        '다른 검색어를 시도하거나 카테고리를 탐색해보세요.',
        getRelatedTags(allBooks, q)
      );
      return;
    }

    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('search-meta').innerHTML = renderMeta(q, results.length);

    /* 페이지네이션 */
    const pages  = Math.ceil(results.length / PER_PAGE);
    currentPage  = Math.min(currentPage, pages);
    const sliced = results.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    /* 그리드 렌더 — 키워드 하이라이트 */
    document.getElementById('search-grid').innerHTML =
      sliced.map(b => TB.renderGridCard(b, q)).join('');

    /* 페이지네이션 */
    const pagNav = document.getElementById('pagination');
    if (pages > 1) {
      pagNav.style.display = 'flex';
      pagNav.innerHTML     = buildPagination(currentPage, pages);
    } else {
      pagNav.style.display = 'none';
    }
  }

  function matchesQuery(b, q) {
    const kws = q.toLowerCase().split(/\s+/);
    const hay = [b.title, b.author, b.subtitle, ...b.genre_tags].join(' ').toLowerCase();
    return kws.every(k => hay.includes(k));
  }

  function renderMeta(q, count) {
    return `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
      <h2 style="font-size:22px;font-weight:800;margin:0">"<span style="color:var(--color-primary)">${q}</span>"</h2>
      <span style="font-size:15px;color:var(--color-text-2)">검색 결과 <strong>${count}건</strong></span>
    </div>`;
  }

  function showEmpty(title, desc, tags = []) {
    document.getElementById('search-grid').innerHTML = '';
    document.getElementById('pagination').style.display = 'none';
    document.getElementById('search-meta').innerHTML = '';
    const empty = document.getElementById('empty-state');
    empty.style.display = 'block';
    document.getElementById('empty-title').textContent = title;
    document.getElementById('empty-desc').textContent  = desc;
    document.getElementById('related-tags').innerHTML  = tags.map(t =>
      `<button class="chip" data-tag-search="${t}"># ${t}</button>`
    ).join('');
  }

  function getRelatedTags(books, q) {
    const allTags = books.flatMap(b => b.genre_tags);
    const freq = {};
    allTags.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);
  }

})();

function buildPagination(current, total) {
  const delta = 2;
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) pages.push(i);
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

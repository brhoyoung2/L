(async function init() {

  /* ── 관리자 모드 ── */
  const params = new URLSearchParams(location.search);
  if (params.get('admin') === 'true')  localStorage.setItem('tb_admin_mode', 'true');
  if (params.get('admin') === 'false') localStorage.removeItem('tb_admin_mode');
  const isAdmin = localStorage.getItem('tb_admin_mode') === 'true';

  const adminBadge = document.getElementById('admin-badge');
  if (isAdmin && adminBadge) {
    adminBadge.style.display = 'inline-flex';
  }

  /* ── 데이터 로드 ── */
  let books = [], categories = [], webtoons = [];
  try {
    [books, categories, webtoons] = await Promise.all([
      TB.getBooks(),
      TB.getCategories(),
      TB.getWebtoons()
    ]);
  } catch (err) {
    console.error('데이터 로드 실패', err);
    document.getElementById('main-content').innerHTML =
      '<div style="padding:60px;text-align:center;color:var(--color-text-3)">데이터를 불러올 수 없습니다.</div>';
    return;
  }

  /* ── 히어로 배너 ── */
  const heroBook = books.find(b => b.is_featured) || books[0];
  if (heroBook) {
    document.getElementById('hero-title').textContent = heroBook.title;
    document.getElementById('hero-sub').textContent = heroBook.subtitle;
    document.getElementById('hero-cta').dataset.bookId = heroBook.book_id;
    document.getElementById('hero-illust').style.background =
      `linear-gradient(135deg,${heroBook.cover_color},${heroBook.cover_color}88)`;
    document.getElementById('hero-illust').textContent = '📚';
  }

  /* ── 섹션별 도서 렌더링 ── */
  const mainContent = document.getElementById('main-content');
  const sectionsHtml = categories.map(cat => {
    const catBooks = TB.getBooksInCategory(books, cat.category_id);
    return TB.renderBookSection(cat, catBooks);
  }).join('');
  mainContent.innerHTML = sectionsHtml;

  /* ── 웹툰 섹션 ── */
  if (webtoons.length) {
    const wtSection = document.getElementById('webtoon-section');
    if (wtSection) {
      wtSection.querySelector('.book-scroll').innerHTML = webtoons.map(TB.renderWebtoonCard).join('');
    }
  }

  /* ── 학년 탭 이벤트 (grade_best 섹션) ── */
  document.addEventListener('click', e => {
    const tab = e.target.closest('.grade-tab');
    if (tab) {
      const grade = tab.dataset.grade;
      const section = tab.closest('.book-section');
      section.querySelectorAll('.grade-tab').forEach(t => t.classList.remove('grade-tab--active'));
      tab.classList.add('grade-tab--active');

      const scroll = section.querySelector('.book-scroll');
      const catId = section.id.replace('section-', '');
      const catBooks = TB.getBooksInCategory(books, catId);
      const filtered = grade === 'all' ? catBooks : catBooks.filter(b => b.grade === grade);
      scroll.innerHTML = filtered.length
        ? filtered.map(TB.renderBookCard).join('')
        : '<p style="color:var(--color-text-3);padding:20px">해당 학년 도서가 없습니다.</p>';
    }

    /* ── 도서 카드 클릭 → 상세 페이지 ── */
    const card = e.target.closest('[data-action="open-book"]');
    if (card) {
      const id = card.dataset.bookId;
      location.href = `detail.html?book_id=${id}`;
    }

    /* ── 히어로 CTA ── */
    const cta = e.target.closest('#hero-cta');
    if (cta) {
      const id = cta.dataset.bookId;
      if (id) location.href = `detail.html?book_id=${id}`;
    }

    /* ── 관리자 패널 열기/닫기 ── */
    if (e.target.closest('#admin-toggle-btn')) openAdminPanel();
    if (e.target.closest('#admin-close-btn'))  closeAdminPanel();
    if (e.target.closest('#admin-overlay') && !e.target.closest('#admin-panel')) closeAdminPanel();
  });

  /* ── 관리자 패널 ── */
  function openAdminPanel() {
    document.getElementById('admin-panel')?.classList.add('admin-panel--open');
    document.getElementById('admin-overlay')?.classList.add('admin-overlay--open');
  }
  function closeAdminPanel() {
    document.getElementById('admin-panel')?.classList.remove('admin-panel--open');
    document.getElementById('admin-overlay')?.classList.remove('admin-overlay--open');
  }

  if (isAdmin) openAdminPanel();

})();

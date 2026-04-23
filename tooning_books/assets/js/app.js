(async function init() {

  /* ── 관리자 모드 ── */
  const params = new URLSearchParams(location.search);
  if (params.get('admin') === 'true')  localStorage.setItem('tb_admin_mode', 'true');
  if (params.get('admin') === 'false') localStorage.removeItem('tb_admin_mode');
  let isAdmin = localStorage.getItem('tb_admin_mode') === 'true';

  function syncAdminUI() {
    const toggle = document.getElementById('admin-toggle-btn');
    if (toggle) toggle.classList.toggle('admin-mode-toggle--active', isAdmin);
    document.body.classList.toggle('edit-mode', isAdmin);
  }
  syncAdminUI();

  /* ── 데이터 로드 ── */
  let books = [], categories = [], webtoons = [];
  try {
    [books, categories, webtoons] = await Promise.all([
      TB.getBooks(), TB.getCategories(), TB.getWebtoons()
    ]);
  } catch (err) {
    console.error('데이터 로드 실패', err);
    document.getElementById('main-content').innerHTML =
      '<div class="loading-state"><div style="font-size:40px">😕</div><p>데이터를 불러올 수 없습니다.</p></div>';
    return;
  }

  /* ── 데이터 소스 배지 ── */
  const st = TB.getDataStatus();
  const badge = document.getElementById('data-source-badge');
  if (badge) {
    badge.textContent = st.source === 'sheets' ? '🟢 Google Sheets 연결됨' : '🟡 오프라인 (mock 데이터)';
    badge.className = 'data-source-badge' + (st.source === 'sheets' ? ' data-source-badge--live' : '');
  }

  /* ── 히어로 슬라이더 ── */
  const HERO_TITLE_ORDER = ['왕자와 거지', '홍길동전', '전우치전', '박씨전', '로빈슨 크루소', '크리스마스 선물'];
  const localBanners = JSON.parse(localStorage.getItem('tb_local_banners') || '[]').filter(b => b.is_active);
  /* 제목 순서로 6권 추출 (시트 book_id 형식과 무관하게 동작) */
  const heroByTitle = HERO_TITLE_ORDER.map(t => books.find(b => b.title === t)).filter(Boolean);
  const featured    = books.filter(b => b.is_featured);
  const heroBooks = localBanners.length
    ? localBanners.map(b => {
        const linked = b.book_id ? books.find(bk => bk.book_id === b.book_id) : null;
        return {
          book_id:         b.book_id || '',
          title:           b.title,
          subtitle:        b.subtitle || '',
          author:          linked?.author || '',
          year:            linked?.year || 0,
          cover_color:     b.cover_color || '#3D3080',
          cover_data_url:  b.cover_data_url || null,
          categories:      linked?.categories || [],
          like_count:      linked?.like_count || 0,
          reading_minutes: 0,
          grade:           linked?.grade || '',
          is_featured:     false,
        };
      })
    : (heroByTitle.length ? heroByTitle : (featured.length ? featured : books.slice(0, 6)));
  try { buildHero(heroBooks); } catch(e) { console.error('buildHero 오류:', e); }

  /* ── 섹션별 도서 렌더링 ── */
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = buildSectionsHtml(books, categories);

  /* ── 웹툰 섹션 ── */
  const wtScroll = document.getElementById('webtoon-scroll');
  if (wtScroll && webtoons.length) {
    wtScroll.innerHTML = webtoons.map(TB.renderWebtoonCard).join('');
  }

  /* 통계·편집용 데이터 노출 */
  window._tb_appData = { books, categories, webtoons };

  /* ── 섹션 새로고침 (관리자 저장/삭제 후 호출) ── */
  window._tb_reloadSections = async function() {
    Object.keys(sessionStorage).filter(k => k.startsWith('tb_cache_')).forEach(k => sessionStorage.removeItem(k));
    try {
      const [newBooks, newCats] = await Promise.all([TB.getBooks(), TB.getCategories()]);
      books = newBooks;
      categories = newCats;
      mainContent.innerHTML = buildSectionsHtml(newBooks, newCats);
    } catch(e) { console.error('섹션 새로고침 실패', e); }
  };

  /* ── 글로벌 이벤트 위임 ── */
  document.addEventListener('click', e => {

    /* 편집 모드 액션 버튼 — 카드 내비게이션보다 먼저 처리 */
    const editActionBtn = e.target.closest('[data-edit-action]');
    if (editActionBtn && isAdmin) {
      const card = editActionBtn.closest('[data-book-id]');
      if (card) {
        const bookId = card.dataset.bookId;
        const action = editActionBtn.dataset.editAction;
        if (action === 'edit' || action === 'sheets') {
          if (typeof window._tb_openEdit === 'function') window._tb_openEdit(bookId);
        } else if (action === 'cover') {
          if (typeof window._tb_changeCover === 'function') window._tb_changeCover(bookId);
        }
      }
      return;
    }

    /* 상단 네비 활성 탭 */
    const navItem = e.target.closest('.site-nav__item');
    if (navItem) {
      document.querySelectorAll('.site-nav__item').forEach(n => n.classList.remove('site-nav__item--active'));
      navItem.classList.add('site-nav__item--active');
    }

    /* 학년 탭 */
    const tab = e.target.closest('.grade-tab');
    if (tab) {
      const grade   = tab.dataset.grade;
      const section = tab.closest('.book-section');
      section.querySelectorAll('.grade-tab').forEach(t => t.classList.remove('grade-tab--active'));
      tab.classList.add('grade-tab--active');
      const catId  = section.id.replace('section-', '');
      const base   = TB.getBooksInCategory(books, catId);
      const filtered = grade === 'all' ? base : base.filter(b => b.grade === grade);
      const scroll = section.querySelector('.book-scroll');
      scroll.innerHTML = filtered.length
        ? filtered.map(TB.renderBookCard).join('')
        : '<p style="color:var(--color-text-3);padding:20px">해당 학년 도서가 없습니다.</p>';
    }

    /* 도서 카드 클릭 */
    const card = e.target.closest('[data-action="open-book"]');
    if (card) {
      location.href = `detail.html?book_id=${card.dataset.bookId}`;
    }

    /* 히어로 CTA */
    const cta = e.target.closest('[id^="hero-cta-"]');
    if (cta && cta.dataset.bookId) {
      location.href = `detail.html?book_id=${cta.dataset.bookId}`;
    }

    /* 관리자 모드 토글 */
    if (e.target.closest('#admin-toggle-btn')) {
      isAdmin = !isAdmin;
      if (isAdmin) localStorage.setItem('tb_admin_mode', 'true');
      else         localStorage.removeItem('tb_admin_mode');
      syncAdminUI();
      if (isAdmin) openAdminPanel();
      else         closeAdminPanel();
    }

    /* 관리자 패널 닫기 */
    if (e.target.closest('#admin-close-btn'))  closeAdminPanel();
    if (e.target.closest('#admin-overlay') && !e.target.closest('#admin-panel')) closeAdminPanel();

    /* 히어로 도트 */
    const dot = e.target.closest('.hero__dot');
    if (dot) {
      const idx = Number(dot.dataset.idx);
      goToSlide(idx, heroBooks);
    }

    /* 히어로 화살표 */
    if (e.target.closest('#hero-prev')) goToSlide(currentSlide - 1, heroBooks);
    if (e.target.closest('#hero-next')) goToSlide(currentSlide + 1, heroBooks);
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

  if (params.get('admin') === 'true') openAdminPanel();


  /* ── 검색 (데스크톱 + 모바일) ── */
  function bindSearch(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = el.value.trim();
        if (q) location.href = `search.html?q=${encodeURIComponent(q)}`;
      }
    });
  }
  bindSearch('search-input');
  bindSearch('mobile-search-input');

  /* 모바일 검색바 표시 */
  const mobileBar = document.querySelector('.mobile-searchbar');
  if (mobileBar && window.innerWidth <= 767) mobileBar.style.display = 'block';
  window.addEventListener('resize', () => {
    if (mobileBar) mobileBar.style.display = window.innerWidth <= 767 ? 'block' : 'none';
  });

  /* ── 섹션 HTML 빌더 (카테고리 + 미분류 로컬 도서 포함) ── */
  function buildSectionsHtml(allBooks, allCats) {
    const coveredIds = new Set();
    const catHtml = allCats.map(cat => {
      const catBooks = TB.getBooksInCategory(allBooks, cat.category_id);
      catBooks.forEach(b => coveredIds.add(b.book_id));
      return TB.renderBookSection(cat, catBooks);
    }).join('');

    const uncategorized = allBooks.filter(b =>
      String(b.book_id).startsWith('local_') && !coveredIds.has(b.book_id)
    );

    const fallbackHtml = uncategorized.length
      ? `<section class="book-section" id="section-local-new">
          <div class="container">
            <div class="section-header">
              <div><h2 class="section-header__title">새로 추가된 도서</h2></div>
            </div>
            <div class="book-scroll">${uncategorized.map(renderBookCard).join('')}</div>
          </div>
        </section>`
      : '';

    return (fallbackHtml + catHtml) || '<div class="loading-state"><p>표시할 도서가 없습니다.</p></div>';
  }

  /* ── 히어로 슬라이더 ── */
  let currentSlide = 0;
  let autoTimer;

  function buildHero(heroBooks) {
    const banner = document.getElementById('hero-banner');
    const dotsEl = document.getElementById('hero-dots');
    if (!banner || !heroBooks.length) return;

    /* 슬라이드 HTML 생성 */
    banner.innerHTML = heroBooks.map((b, i) => {
      const bgColor = b.cover_color || '#EDD9C4';
      const dark    = isColorDark(bgColor);
      const metaParts = [
        b.author ? `<span>✍️ ${b.author}</span>` : '',
        b.year   ? `<span>📅 ${b.year}년</span>` : '',
        b.grade  ? `<span>${GRADE_LABEL[b.grade] || b.grade}</span>` : '',
      ].filter(Boolean).join('');

      /* 배너 이미지 우선순위: cover_data_url → book_NN id → 제목 매핑 → image_url → 기본 */
      const TITLE_BANNER_MAP = {
        '왕자와 거지':    './images/banner/book_01.png',
        '홍길동전':      './images/banner/book_02.png',
        '전우치전':      './images/banner/book_03.png',
        '박씨전':        './images/banner/book_04.png',
        '로빈슨 크루소':  './images/banner/book_05.png',
        '크리스마스 선물': './images/banner/book_06.png',
      };
      let bannerSrc = b.cover_data_url || '';
      if (!bannerSrc) {
        const m = String(b.book_id || '').match(/^book_(\d+)$/);
        if (m) bannerSrc = `./images/banner/book_${String(Number(m[1])).padStart(2,'0')}.png`;
      }
      if (!bannerSrc) bannerSrc = TITLE_BANNER_MAP[b.title] || '';
      if (!bannerSrc) bannerSrc = b.image_url || './images/main_banner_image_01.png';

      const heroImg = `<img src="${bannerSrc}" alt="${b.title}" class="hero__banner-img">`;

      return `
        <div class="hero__slide${i === 0 ? ' hero__slide--active' : ''} hero__slide--${dark ? 'dark' : 'light'}" id="hero-slide-${i}" style="background:${bgColor}">
          <div class="hero__text">
            <h1 class="hero__title">${b.title}</h1>
            <p class="hero__sub">${b.subtitle}</p>
            ${metaParts ? `<div class="hero__meta">${metaParts}</div>` : ''}
          </div>
          <div class="hero__cover">
            ${heroImg}
          </div>
        </div>`;
    }).join('');

    /* 도트 */
    dotsEl.innerHTML = heroBooks.map((_, i) =>
      `<button class="hero__dot${i === 0 ? ' hero__dot--active' : ''}" data-idx="${i}"></button>`
    ).join('');

    startAuto(heroBooks);
    addHeroSwipe(heroBooks);
  }

  function goToSlide(idx, heroBooks) {
    const len = heroBooks.length;
    currentSlide = ((idx % len) + len) % len;

    document.querySelectorAll('.hero__slide').forEach((s, i) =>
      s.classList.toggle('hero__slide--active', i === currentSlide));
    document.querySelectorAll('.hero__dot').forEach((d, i) =>
      d.classList.toggle('hero__dot--active', i === currentSlide));

    clearInterval(autoTimer);
    startAuto(heroBooks);
  }

  function startAuto(heroBooks) {
    autoTimer = setInterval(() => goToSlide(currentSlide + 1, heroBooks), 5000);
  }

  /* ── 히어로 터치 스와이프 ── */
  function addHeroSwipe(heroBooks) {
    const banner = document.getElementById('hero-banner');
    if (!banner) return;
    let startX = 0;
    banner.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    banner.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 40) return;
      goToSlide(currentSlide + (dx < 0 ? 1 : -1), heroBooks);
    }, { passive: true });
  }

  function getCategoryLabel(cats, allCats) {
    const cat = allCats.find(c => cats.includes(c.category_id));
    return cat ? `📖 ${cat.name}` : '📖 추천 도서';
  }

  function renderHeroDeco(book) {
    switch(book.cover_deco) {
      case 'circle': return `<div style="position:absolute;width:80px;height:80px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);top:20px;left:50%;transform:translateX(-50%)"></div>`;
      case 'quote':  return `<div style="position:absolute;font-size:80px;color:rgba(255,255,255,0.15);top:0;left:6px;font-family:Georgia,serif;line-height:1">"</div>`;
      case 'lines':  return `<div style="position:absolute;top:20px;left:20%;width:60%;display:flex;flex-direction:column;gap:6px"><span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block"></span><span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block"></span></div>`;
      default: return '';
    }
  }

  function isColorDark(hex) {
    const c = hex.replace('#','');
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    return (r*299 + g*587 + b*114) / 1000 < 128;
  }

})();


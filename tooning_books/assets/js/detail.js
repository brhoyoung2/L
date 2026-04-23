(async function initDetail() {

  const params   = new URLSearchParams(location.search);
  const bookId   = params.get('book_id');
  const isEdit   = params.get('mode') === 'edit';

  /* ── 관리자 모드 ── */
  if (params.get('admin') === 'true')  localStorage.setItem('tb_admin_mode', 'true');
  if (params.get('admin') === 'false') localStorage.removeItem('tb_admin_mode');
  const isAdmin = localStorage.getItem('tb_admin_mode') === 'true';

  if (isAdmin) document.getElementById('admin-badge').style.display = 'inline-flex';

  /* ── 데이터 로드 ── */
  if (!bookId) { showError(); return; }

  let book, allBooks, webtoons;
  try {
    [allBooks, webtoons] = await Promise.all([TB.getBooks(), TB.getWebtoons()]);
    book = allBooks.find(b => b.book_id === bookId);
  } catch (err) {
    console.error('데이터 로드 실패', err);
    showError();
    return;
  }

  if (!book) { showError(); return; }

  /* ── 페이지 타이틀 ── */
  document.title = `${book.title} — TOONING BOOKS`;

  /* ── 히어로 영역 채우기 ── */
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('detail-hero').style.display = 'block';

  // 브레드크럼
  document.getElementById('breadcrumb-title').textContent = book.title;
  if (book.categories.length) {
    document.getElementById('breadcrumb-cat').href = `category.html?id=${book.categories[0]}`;
  }

  // 표지
  const cover = document.getElementById('detail-cover');
  cover.style.background = book.cover_color;
  cover.style.color = isColorDark(book.cover_color) ? '#fff' : '#2A1F5C';
  document.getElementById('detail-read-time').textContent = `⏱ 약 ${book.reading_minutes}분 독서`;

  // 표지 데코
  const coverInner = document.getElementById('detail-cover-inner');
  coverInner.innerHTML = renderCoverDeco(book) + '<span style="font-size:80px;z-index:1;position:relative">📚</span>';

  // 태그
  document.getElementById('detail-tags').innerHTML =
    book.genre_tags.map(t => `<span class="detail-tag">${t}</span>`).join('') +
    (book.is_featured ? ' <span class="badge badge--featured">★ 추천</span>' : '') +
    (book.categories.includes('cat_webtoon') ? ' <span class="badge badge--webtoon">웹툰</span>' : '') +
    (book.categories.includes('cat_new') ? ' <span class="badge badge--new">NEW</span>' : '');

  // 제목·작가
  document.getElementById('detail-title').textContent = book.title;
  document.getElementById('detail-author').textContent = `${book.author} · ${book.year}년 출간 · ${GRADE_LABEL[book.grade]}`;
  document.getElementById('detail-subtitle').textContent = book.subtitle;

  // 통계
  document.getElementById('stat-views').textContent    = book.view_count.toLocaleString();
  document.getElementById('stat-likes').textContent    = book.like_count.toLocaleString();
  document.getElementById('stat-comments').textContent = book.comment_count.toLocaleString();
  document.getElementById('stat-webtoons').textContent = book.webtoon_count.toLocaleString();
  document.getElementById('like-count').textContent    = book.like_count.toLocaleString();

  /* ── 본문 블록 렌더 ── */
  document.getElementById('detail-body').innerHTML = renderBlocks(book.detail_blocks, isEdit);

  /* ── EDIT / READ 모드 전환 ── */
  applyMode(isEdit && isAdmin, isAdmin);

  /* ── 웹툰 섹션 ── */
  const bookWebtoons = webtoons.filter(w => w.book_id === bookId);
  if (bookWebtoons.length) {
    document.getElementById('webtoon-section').style.display = 'block';
    document.getElementById('webtoon-total').textContent = book.webtoon_count;
    document.getElementById('webtoon-scroll').innerHTML = bookWebtoons.map(TB.renderWebtoonCard).join('');
  }

  /* ── 관련 도서 (같은 카테고리) ── */
  const related = allBooks
    .filter(b => b.book_id !== bookId && b.categories.some(c => book.categories.includes(c)))
    .slice(0, 6);
  if (related.length) {
    document.getElementById('related-section').style.display = 'block';
    document.getElementById('related-scroll').innerHTML = related.map(TB.renderBookCard).join('');
  }

  /* ── 댓글 섹션 ── */
  document.getElementById('comment-section').style.display = 'block';
  renderComments(bookId);

  /* ── 이벤트 ── */
  setupEvents(book, isAdmin);

  /* ─────────────────────────── helpers ─────────────────────────── */

  function applyMode(editMode, adminMode) {
    const editBanner  = document.getElementById('edit-banner');
    const toolbar     = document.getElementById('editor-toolbar');
    const coverChange = document.getElementById('cover-change-btn');
    const titleEdit   = document.getElementById('title-edit-btn');

    // READ 버튼들
    const readBtns  = ['make-webtoon-btn','like-btn','save-btn','share-btn'];
    const editBtns  = ['edit-make-btn','edit-like-btn','edit-delete-btn'];

    if (editMode) {
      editBanner.style.display = 'block';
      toolbar.style.display = 'block';
      coverChange.style.display = 'block';
      titleEdit.style.display = 'flex';
      readBtns.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
      editBtns.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'inline-flex'; });
    } else {
      editBanner.style.display = 'none';
      toolbar.style.display = 'none';
      coverChange.style.display = 'none';
      titleEdit.style.display = 'none';
      readBtns.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'inline-flex'; });
      editBtns.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    }

    // 관리자 패널 모드 전환 버튼 상태
    if (adminMode) {
      document.getElementById('admin-edit-mode-btn').textContent =
        editMode ? '✅ EDIT 모드 활성 중' : '✏️ EDIT 모드로 전환';
    }
  }

  function setupEvents(b, adminMode) {
    /* 도서 카드 클릭 → 상세 */
    document.addEventListener('click', e => {
      const card = e.target.closest('[data-action="open-book"]');
      if (card) location.href = `detail.html?book_id=${card.dataset.bookId}`;

      /* 관리자 패널 */
      if (e.target.closest('#admin-toggle-btn')) openAdminPanel();
      if (e.target.closest('#admin-close-btn'))  closeAdminPanel();
      if (e.target.closest('#admin-overlay') && !e.target.closest('#admin-panel')) closeAdminPanel();

      /* EDIT ↔ READ 전환 */
      if (e.target.closest('#admin-edit-mode-btn')) {
        const url = new URL(location.href);
        url.searchParams.set('mode', 'edit');
        url.searchParams.set('admin', 'true');
        location.href = url.toString();
      }
      if (e.target.closest('#admin-read-mode-btn')) {
        const url = new URL(location.href);
        url.searchParams.delete('mode');
        location.href = url.toString();
      }

      /* 미리보기 (EDIT → READ) */
      if (e.target.closest('#preview-btn')) {
        const url = new URL(location.href);
        url.searchParams.delete('mode');
        window.open(url.toString(), '_blank');
      }

      /* 저장 (v0.3: UI만) */
      if (e.target.closest('#publish-btn')) {
        const status = document.getElementById('edit-status');
        status.textContent = '⊙ 저장됨 · 방금 전';
        status.style.background = 'var(--color-saved-bg)';
        setTimeout(() => { status.textContent = '⊙ 자동 저장됨 · 방금 전'; }, 2000);
      }

      /* 좋아요 */
      if (e.target.closest('#like-btn')) {
        const btn = document.getElementById('like-btn');
        const liked = btn.classList.toggle('btn-action--liked');
        const key = `tb_like_${b.book_id}`;
        if (liked) {
          localStorage.setItem(key, 'true');
          document.getElementById('like-count').textContent = (b.like_count + 1).toLocaleString();
        } else {
          localStorage.removeItem(key);
          document.getElementById('like-count').textContent = b.like_count.toLocaleString();
        }
      }

      /* 저장 버튼 */
      if (e.target.closest('#save-btn')) {
        const saved = JSON.parse(localStorage.getItem('tb_bookmarks') || '[]');
        if (!saved.includes(b.book_id)) {
          saved.push(b.book_id);
          localStorage.setItem('tb_bookmarks', JSON.stringify(saved));
          document.getElementById('save-btn').textContent = '✅ 저장됨';
        }
      }

      /* 공유 */
      if (e.target.closest('#share-btn')) {
        if (navigator.share) {
          navigator.share({ title: b.title, url: location.href });
        } else {
          navigator.clipboard?.writeText(location.href);
          document.getElementById('share-btn').textContent = '✅ 링크 복사됨';
          setTimeout(() => { document.getElementById('share-btn').textContent = '📤 공유'; }, 2000);
        }
      }

      /* 웹툰 만들기 CTA */
      if (e.target.closest('#make-webtoon-btn')) {
        const tooningUrl = `https://tooning.io/character-casting?source=tooning_books&book_id=${b.book_id}&book_title=${encodeURIComponent(b.title)}`;
        window.open(tooningUrl, '_blank');
      }

      /* 댓글 취소 */
      if (e.target.closest('#comment-cancel')) {
        document.getElementById('comment-input').value = '';
      }

      /* 댓글 작성 */
      if (e.target.closest('#comment-submit')) {
        const text = document.getElementById('comment-input').value.trim();
        if (!text) return;
        const key = `tb_comments_${bookId}`;
        const comments = JSON.parse(localStorage.getItem(key) || '[]');
        comments.unshift({
          id: Date.now(),
          name: '나',
          school: '우리학교 · 중2',
          text,
          likes: 0,
          mine: true,
          at: new Date().toLocaleDateString('ko-KR')
        });
        localStorage.setItem(key, JSON.stringify(comments));
        document.getElementById('comment-input').value = '';
        renderComments(bookId);
      }

      /* 내 댓글 삭제 */
      const delBtn = e.target.closest('[data-del-comment]');
      if (delBtn) {
        const id = Number(delBtn.dataset.delComment);
        const key = `tb_comments_${bookId}`;
        const comments = JSON.parse(localStorage.getItem(key) || '[]').filter(c => c.id !== id);
        localStorage.setItem(key, JSON.stringify(comments));
        renderComments(bookId);
      }
    });

    /* 이미 좋아요 누른 경우 상태 복원 */
    if (localStorage.getItem(`tb_like_${b.book_id}`)) {
      document.getElementById('like-btn')?.classList.add('btn-action--liked');
      document.getElementById('like-count').textContent = (b.like_count + 1).toLocaleString();
    }
    if (localStorage.getItem('tb_bookmarks')?.includes(b.book_id)) {
      document.getElementById('save-btn').textContent = '✅ 저장됨';
    }

    if (adminMode) openAdminPanel();
  }

  function renderComments(bookId) {
    const key = `tb_comments_${bookId}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');

    /* mock 댓글 */
    const mockComments = [
      { id: -1, name: '이준혁', school: '서울중학교 · 중2', text: '어린 왕자는 읽을 때마다 새로운 의미가 느껴져요. 특히 여우와의 대화가 너무 좋았어요 🦊', likes: 12, mine: false, at: '2026.04.20' },
      { id: -2, name: '박서연', school: '강남중학교 · 중1', text: '"가장 중요한 것은 눈에 보이지 않아" 이 문장이 계속 생각나요. 웹툰으로도 만들어봤는데 정말 재미있었어요!', likes: 8, mine: false, at: '2026.04.19' },
      { id: -3, name: '김도현', school: '한양중학교 · 중3', text: '고전이라서 어려울 줄 알았는데 생각보다 읽기 쉽고 감동적이었어요. 추천합니다!', likes: 5, mine: false, at: '2026.04.18' },
    ];

    const all = [...stored, ...mockComments];
    document.getElementById('comment-count-label').textContent = all.length;

    document.getElementById('comment-list').innerHTML = all.map(c => {
      const colors = ['#3D3080','#FF6B35','#B8DFD5','#F5D5E5','#DEC8F0'];
      const avatarColor = colors[Math.abs(c.name.charCodeAt(0)) % colors.length];
      const isDark = isColorDark(avatarColor);
      return `
        <div class="comment-item ${c.mine ? 'comment-mine' : ''}">
          <div class="comment-avatar" style="background:${avatarColor};color:${isDark?'#fff':'#2A1F5C'}">${c.name[0]}</div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-name">${c.name}</span>
              <span class="comment-school">${c.school}</span>
              ${c.mine ? '<span class="badge badge--webtoon" style="font-size:9px">내 댓글</span>' : ''}
            </div>
            <p class="comment-text">${c.text}</p>
            <div class="comment-actions">
              <button class="comment-action">❤️ ${c.likes}</button>
              <button class="comment-action">답글</button>
              ${c.mine ? `<button class="comment-action" data-del-comment="${c.id}" style="color:var(--color-danger)">🗑 삭제</button>` : '<button class="comment-action">⋯ 더보기</button>'}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function openAdminPanel() {
    document.getElementById('admin-panel')?.classList.add('admin-panel--open');
    document.getElementById('admin-overlay')?.classList.add('admin-overlay--open');
  }
  function closeAdminPanel() {
    document.getElementById('admin-panel')?.classList.remove('admin-panel--open');
    document.getElementById('admin-overlay')?.classList.remove('admin-overlay--open');
  }
  function showError() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
  }

})();

/* ─── 공용 상수는 renderer.js에 선언됨 ─── */

function isColorDark(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return (r*299 + g*587 + b*114) / 1000 < 128;
}

function renderCoverDeco(book) {
  switch(book.cover_deco) {
    case 'circle':
      return `<div style="position:absolute;width:120px;height:120px;border-radius:50%;border:3px solid rgba(255,255,255,0.25);top:30px;left:50%;transform:translateX(-50%)"></div>`;
    case 'quote':
      return `<div style="position:absolute;font-size:120px;color:rgba(255,255,255,0.15);top:0;left:10px;font-family:Georgia,serif;line-height:1">"</div>`;
    case 'lines':
      return `<div style="position:absolute;top:30px;left:20%;width:60%;display:flex;flex-direction:column;gap:8px">
        <span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block"></span>
        <span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block"></span>
        <span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block;width:70%"></span>
      </div>`;
    case 'square':
      return `<div style="position:absolute;width:100px;height:100px;border:3px solid rgba(255,255,255,0.2);top:25px;left:50%;transform:translateX(-50%)"></div>`;
    default: return '';
  }
}

function renderBlocks(blocks, editMode) {
  if (!blocks || !blocks.length) {
    return '<p style="color:var(--color-text-3);padding:20px 0">본문 내용이 없습니다.</p>';
  }
  return blocks.map((b, i) => {
    let html = '';
    switch (b.type) {
      case 'h1':
        html = `<h1>${b.text}</h1>`;
        break;
      case 'h2':
        html = `<h2>${b.text}</h2>`;
        break;
      case 'paragraph':
        html = `<p>${b.text}</p>`;
        break;
      case 'quote':
        html = `<div class="block-quote">
          <p class="block-quote__text">"${b.text}"</p>
          ${b.source ? `<p class="block-quote__source">— ${b.source}</p>` : ''}
        </div>`;
        break;
      case 'image':
        html = `<div class="block-image">
          <div class="block-image__placeholder" style="background:${b.mock_color || '#F0DDCB'}">📷</div>
          ${b.caption ? `<p class="block-image__caption">${b.caption}</p>` : ''}
        </div>`;
        break;
      case 'list':
        const tag = b.style === 'ordered' ? 'ol' : 'ul';
        html = `<${tag} class="block-list">${(b.items||[]).map(it => `<li>${it}</li>`).join('')}</${tag}>`;
        break;
      default:
        html = `<p>${b.text || ''}</p>`;
    }

    if (!editMode) return html;

    return `<div class="edit-block" style="padding:8px 12px;margin:0 -12px;position:relative">
      ${html}
      <div class="edit-block__controls">
        <button class="edit-block-btn" title="편집">✎</button>
        <button class="edit-block-btn" title="더보기">⋯</button>
      </div>
      <div style="position:absolute;left:-32px;top:50%;transform:translateY(-50%);display:none;flex-direction:column;gap:2px" class="block-drag-handle">
        <span style="font-size:14px;color:var(--color-text-3);cursor:grab">⠿</span>
      </div>
    </div>`;
  }).join('');
}

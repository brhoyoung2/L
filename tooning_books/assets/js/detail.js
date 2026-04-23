(async function initDetail() {

  const params  = new URLSearchParams(location.search);
  const bookId  = params.get('book_id');
  const isEdit  = params.get('mode') === 'edit';

  /* ── 관리자 모드 ── */
  if (params.get('admin') === 'true')  localStorage.setItem('tb_admin_mode', 'true');
  if (params.get('admin') === 'false') localStorage.removeItem('tb_admin_mode');
  const isAdmin  = localStorage.getItem('tb_admin_mode') === 'true';
  const editMode = isAdmin; /* 관리자 모드 = 항상 편집 모드 */

  if (isAdmin) document.getElementById('admin-badge').style.display = 'inline-flex';
  if (!bookId) { showError(); return; }

  /* ── 데이터 로드 ── */
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

  const isLocal = String(book.book_id).startsWith('local_');

  /* ── editState: 편집 중인 모든 데이터 ── */
  const defaultRelated = allBooks
    .filter(b => b.book_id !== bookId && b.categories.some(c => book.categories.includes(c)))
    .slice(0, 6)
    .map(b => b.book_id);

  const editState = {
    title:            book.title,
    author:           book.author,
    subtitle:         book.subtitle,
    genre_tags:       [...(book.genre_tags || [])],
    cover_data_url:   book.cover_data_url || null,
    cover_color:      book.cover_color || '#3D3080',
    detail_blocks:    JSON.parse(JSON.stringify(book.detail_blocks || [])),
    related_book_ids: defaultRelated.slice(),
  };

  /* 편집 모드에서 삭제된 목 댓글 ID 추적 */
  const deletedMockIds = new Set();

  /* ── 페이지 초기화 ── */
  document.title = `${book.title} — TOONING BOOKS`;
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('detail-hero').style.display   = 'block';

  /* 브레드크럼 */
  document.getElementById('breadcrumb-title').textContent = book.title;
  if (book.categories.length)
    document.getElementById('breadcrumb-cat').href = `category.html?id=${book.categories[0]}`;

  /* 읽기 시간 — 표시 안 함 */
  const readTimeEl = document.getElementById('detail-read-time');
  if (readTimeEl) readTimeEl.style.display = 'none';

  /* 통계 숫자 */
  document.getElementById('stat-views').textContent    = book.view_count.toLocaleString();
  document.getElementById('stat-likes').textContent    = book.like_count.toLocaleString();
  document.getElementById('stat-comments').textContent = book.comment_count.toLocaleString();
  document.getElementById('stat-webtoons').textContent = book.webtoon_count.toLocaleString();
  document.getElementById('like-count').textContent    = book.like_count.toLocaleString();

  /* ── 전체 렌더 ── */
  renderPage(editMode);

  /* ── 웹툰 섹션 ── */
  const bookWebtoons = webtoons.filter(w => w.book_id === bookId);
  if (bookWebtoons.length) {
    document.getElementById('webtoon-section').style.display = 'block';
    document.getElementById('webtoon-total').textContent     = book.webtoon_count;
    document.getElementById('webtoon-scroll').innerHTML      = bookWebtoons.map(TB.renderWebtoonCard).join('');
  }

  /* ── 댓글 ── */
  document.getElementById('comment-section').style.display = 'block';
  renderComments();

  /* ── 이벤트 ── */
  setupEvents();


  /* ═══════════════════════════════════
       RENDER FUNCTIONS
  ═══════════════════════════════════ */

  function renderPage(em) {
    renderCover(em);
    renderTags(em);
    renderTitleSection(em);
    renderBody(em);
    renderRelatedSection(em);
    applyMode(em);
  }

  /* ── 표지 ── */
  function renderCover(em) {
    const cover = document.getElementById('detail-cover');
    cover.style.background = editState.cover_color;
    cover.style.color = isColorDark(editState.cover_color) ? '#fff' : '#2A1F5C';

    const inner = document.getElementById('detail-cover-inner');
    if (editState.cover_data_url) {
      inner.innerHTML = `<img src="${editState.cover_data_url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1">`;
    } else {
      inner.innerHTML = renderCoverDeco(book) + '<span style="font-size:80px;z-index:1;position:relative">📚</span>';
    }

    /* 편집 모드: 호버 오버레이 삽입 */
    let overlay = document.getElementById('cover-change-overlay');
    if (em) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id        = 'cover-change-overlay';
        overlay.className = 'cover-change-overlay';
        overlay.innerHTML = `<span style="font-size:26px">📷</span><span>표지 변경</span>`;
        cover.appendChild(overlay);
      }
      cover.classList.add('detail-cover--editable');
    } else {
      overlay?.remove();
      cover.classList.remove('detail-cover--editable');
    }
  }

  /* ── 태그 ── */
  function renderTags(em) {
    const el = document.getElementById('detail-tags');
    if (em) {
      el.innerHTML =
        editState.genre_tags.map((t, i) =>
          `<span class="detail-tag detail-tag--editable">${t}<button class="tag-del-btn" data-tag-idx="${i}" title="삭제">×</button></span>`
        ).join('') +
        `<button class="tag-add-btn" id="tag-add-btn">+ 태그 추가</button>`;
    } else {
      el.innerHTML =
        editState.genre_tags.map(t => `<span class="detail-tag">${t}</span>`).join('') +
        (book.is_featured ? ' <span class="badge badge--featured">★ 추천</span>' : '') +
        (book.categories.includes('cat_webtoon') ? ' <span class="badge badge--webtoon">웹툰</span>' : '') +
        (book.categories.includes('cat_new') ? ' <span class="badge badge--new">NEW</span>' : '');
    }
  }

  /* ── 제목 / 작가 / 부제 ── */
  function renderTitleSection(em) {
    const titleEl    = document.getElementById('detail-title');
    const authorEl   = document.getElementById('detail-author');
    const subtitleEl = document.getElementById('detail-subtitle');

    /* title-edit-btn은 contenteditable로 대체하므로 항상 숨김 */
    const editBtn = document.getElementById('title-edit-btn');
    if (editBtn) editBtn.style.display = 'none';

    if (em) {
      titleEl.contentEditable    = 'true';
      authorEl.contentEditable   = 'true';
      subtitleEl.contentEditable = 'true';
      titleEl.classList.add('detail-field--editable');
      authorEl.classList.add('detail-field--editable');
      subtitleEl.classList.add('detail-field--editable');
      titleEl.textContent    = editState.title;
      authorEl.textContent   = editState.author;
      subtitleEl.textContent = editState.subtitle;

      titleEl.addEventListener('input',    () => { editState.title    = titleEl.textContent.trim(); });
      authorEl.addEventListener('input',   () => { editState.author   = authorEl.textContent.trim(); });
      subtitleEl.addEventListener('input', () => { editState.subtitle = subtitleEl.textContent.trim(); });
    } else {
      titleEl.contentEditable    = 'false';
      authorEl.contentEditable   = 'false';
      subtitleEl.contentEditable = 'false';
      titleEl.classList.remove('detail-field--editable');
      authorEl.classList.remove('detail-field--editable');
      subtitleEl.classList.remove('detail-field--editable');
      titleEl.textContent    = book.title;
      authorEl.textContent   = `${book.author} · ${book.year}년 출간 · ${GRADE_LABEL[book.grade]}`;
      subtitleEl.textContent = book.subtitle;
    }
  }

  /* ── 본문 블록 ── */
  function renderBody(em) {
    const bodyEl = document.getElementById('detail-body');
    if (em) {
      bodyEl.innerHTML = buildBlocksEditor();
      /* textarea 실시간 동기화 */
      bodyEl.querySelectorAll('.block-text-input').forEach(ta => {
        ta.addEventListener('input', () => {
          const idx = Number(ta.dataset.blockIdx);
          if (editState.detail_blocks[idx]) editState.detail_blocks[idx].text = ta.value;
        });
      });
      bodyEl.querySelectorAll('.block-source-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = Number(inp.dataset.blockIdx);
          if (editState.detail_blocks[idx]) editState.detail_blocks[idx].source = inp.value;
        });
      });
    } else {
      bodyEl.innerHTML = buildBlocksRead(editState.detail_blocks);
    }
  }

  function buildBlocksRead(blocks) {
    if (!blocks || !blocks.length)
      return '<p style="color:var(--color-text-3);padding:20px 0">본문 내용이 없습니다.</p>';
    return blocks.map(b => {
      switch (b.type) {
        case 'h1':        return `<h1>${b.text}</h1>`;
        case 'h2':        return `<h2>${b.text}</h2>`;
        case 'paragraph': return `<p>${b.text}</p>`;
        case 'quote':     return `<div class="block-quote"><p class="block-quote__text">"${b.text}"</p>${b.source ? `<p class="block-quote__source">— ${b.source}</p>` : ''}</div>`;
        case 'image':     return `<div class="block-image"><div class="block-image__placeholder" style="background:${b.mock_color || '#F0DDCB'}">📷</div>${b.caption ? `<p class="block-image__caption">${b.caption}</p>` : ''}</div>`;
        case 'list': {
          const tag = b.style === 'ordered' ? 'ol' : 'ul';
          return `<${tag} class="block-list">${(b.items || []).map(it => `<li>${it}</li>`).join('')}</${tag}>`;
        }
        default: return `<p>${b.text || ''}</p>`;
      }
    }).join('');
  }

  function buildBlocksEditor() {
    const cards = editState.detail_blocks.map(buildBlockCard).join('');
    return `
      <div id="block-list-edit">${cards}</div>
      <div class="edit-add-block-bar">
        <span style="font-size:12px;color:var(--color-text-3);flex-shrink:0;align-self:center">+ 블록 추가:</span>
        <button class="btn-outline add-block-btn" data-block-type="paragraph" style="padding:5px 12px;font-size:12px">¶ 단락</button>
        <button class="btn-outline add-block-btn" data-block-type="h1"        style="padding:5px 12px;font-size:12px">H1 제목1</button>
        <button class="btn-outline add-block-btn" data-block-type="h2"        style="padding:5px 12px;font-size:12px">H2 제목2</button>
        <button class="btn-outline add-block-btn" data-block-type="quote"     style="padding:5px 12px;font-size:12px">" 인용구</button>
      </div>`;
  }

  function buildBlockCard(b, i) {
    const isQuote = b.type === 'quote';
    const ph = isQuote ? '인용구 내용을 입력하세요...' : '내용을 입력하세요...';
    return `
      <div class="edit-block-card" data-block-idx="${i}">
        <div class="edit-block-card__header">
          <select class="edit-block-type-sel" data-block-idx="${i}">
            <option value="paragraph"${b.type === 'paragraph' ? ' selected' : ''}>¶ 단락</option>
            <option value="h1"${b.type === 'h1' ? ' selected' : ''}>H1 제목1</option>
            <option value="h2"${b.type === 'h2' ? ' selected' : ''}>H2 제목2</option>
            <option value="quote"${b.type === 'quote' ? ' selected' : ''}>" 인용구</option>
          </select>
          <div style="flex:1"></div>
          <button class="edit-block-ctrl block-move-up"   data-block-idx="${i}" title="위로">↑</button>
          <button class="edit-block-ctrl block-move-down" data-block-idx="${i}" title="아래로">↓</button>
          <button class="edit-block-ctrl block-del"       data-block-idx="${i}" title="블록 삭제" style="color:var(--color-danger);border-color:var(--color-danger)">🗑</button>
        </div>
        <textarea class="form-textarea block-text-input" data-block-idx="${i}" rows="3" placeholder="${ph}">${b.text || ''}</textarea>
        ${isQuote ? `<input class="form-input block-source-input" data-block-idx="${i}" placeholder="출처 (선택 사항)" value="${b.source || ''}" style="margin-top:6px;font-size:13px">` : ''}
      </div>`;
  }

  /* ── 관련 도서 ── */
  function renderRelatedSection(em) {
    const section = document.getElementById('related-section');
    const scroll  = document.getElementById('related-scroll');

    if (em) {
      section.style.display = 'block';

      /* 추가 영역 — 최초 1회만 삽입 */
      if (!document.getElementById('related-add-area')) {
        const addArea = document.createElement('div');
        addArea.id = 'related-add-area';
        addArea.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap';
        addArea.innerHTML = `
          <select id="related-book-sel" class="form-input" style="flex:1;min-width:160px;max-width:300px;font-size:13px">
            <option value="">— 추가할 관련 도서 선택 —</option>
            ${allBooks.filter(b => b.book_id !== bookId).map(b => `<option value="${b.book_id}">${b.title}</option>`).join('')}
          </select>
          <button class="btn-primary" id="related-add-btn" style="padding:8px 14px;font-size:13px;white-space:nowrap">+ 추가</button>`;
        const container = section.querySelector('.container');
        container.insertBefore(addArea, scroll);
      }

      renderRelatedCards(true);
    } else {
      document.getElementById('related-add-area')?.remove();
      const related = allBooks
        .filter(b => b.book_id !== bookId && b.categories.some(c => book.categories.includes(c)))
        .slice(0, 6);
      if (related.length) {
        section.style.display = 'block';
        scroll.innerHTML = related.map(TB.renderBookCard).join('');
      }
    }
  }

  function renderRelatedCards(em) {
    const scroll = document.getElementById('related-scroll');
    const relBooks = allBooks.filter(b => editState.related_book_ids.includes(b.book_id));
    if (em) {
      scroll.innerHTML = relBooks.length
        ? relBooks.map(b =>
            `<div style="position:relative;display:inline-block;flex-shrink:0">
              ${TB.renderBookCard(b)}
              <button class="related-del-btn" data-related-id="${b.book_id}" title="관련 도서에서 제거">×</button>
            </div>`).join('')
        : '<p style="color:var(--color-text-3);padding:16px 0;font-size:13px">위에서 관련 도서를 추가하세요.</p>';
    } else {
      scroll.innerHTML = relBooks.map(TB.renderBookCard).join('');
    }
  }

  /* ── 모드 적용 ── */
  function applyMode(em) {
    const editBanner = document.getElementById('edit-banner');
    const statsBox   = document.getElementById('detail-stats');
    const toolbar    = document.getElementById('editor-toolbar');
    const coverBtn   = document.getElementById('cover-change-btn');

    const readBtns = ['make-webtoon-btn', 'like-btn', 'share-btn'];
    const editBtns = ['edit-make-btn', 'edit-like-btn', 'edit-delete-btn'];
    /* save-btn은 표시 안 함 (삭제) */
    const saveBtnEl = document.getElementById('save-btn');
    if (saveBtnEl) saveBtnEl.style.display = 'none';

    if (em) {
      if (editBanner) editBanner.style.display = 'block';
      if (toolbar)    toolbar.style.display    = 'none';
      if (coverBtn)   coverBtn.style.display   = 'none';
      if (statsBox)   statsBox.style.display   = 'none'; /* 편집 모드: 미니 배지로 대체 */
      readBtns.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      editBtns.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'inline-flex'; });

      /* 통계 미니 배지 */
      if (!document.getElementById('stats-mini')) {
        const mini = document.createElement('div');
        mini.id = 'stats-mini';
        mini.style.cssText = 'display:flex;justify-content:flex-end;width:100%;margin-bottom:10px';
        mini.innerHTML = `<span class="detail-stats-mini">👁 ${book.view_count.toLocaleString()} · ❤️ ${book.like_count.toLocaleString()} · 💬 ${book.comment_count.toLocaleString()} · 🎨 ${book.webtoon_count.toLocaleString()}</span>`;
        const detailInfo = document.querySelector('.detail-info');
        if (detailInfo) detailInfo.insertBefore(mini, detailInfo.firstChild);
      }
    } else {
      if (editBanner) editBanner.style.display = 'none';
      if (toolbar)    toolbar.style.display    = 'none';
      if (coverBtn)   coverBtn.style.display   = 'none';
      if (statsBox)   statsBox.style.display   = '';
      readBtns.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'inline-flex'; });
      editBtns.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.getElementById('stats-mini')?.remove();
    }

    if (isAdmin) {
      const editModeBtn = document.getElementById('admin-edit-mode-btn');
      if (editModeBtn) {
        editModeBtn.textContent = '✅ 편집 모드 활성 중';
        editModeBtn.disabled    = true;
        editModeBtn.style.opacity = '0.7';
      }
    }
  }

  /* ── 댓글 ── */
  function renderComments() {
    const key    = `tb_comments_${bookId}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const mockComments = [
      { id: -1, name: '이준혁', school: '서울중학교 · 중2',  text: '어린 왕자는 읽을 때마다 새로운 의미가 느껴져요. 특히 여우와의 대화가 너무 좋았어요 🦊', likes: 12, mine: false, at: '2026.04.20' },
      { id: -2, name: '박서연', school: '강남중학교 · 중1',  text: '"가장 중요한 것은 눈에 보이지 않아" 이 문장이 계속 생각나요. 웹툰으로도 만들어봤는데 정말 재미있었어요!', likes: 8,  mine: false, at: '2026.04.19' },
      { id: -3, name: '김도현', school: '한양중학교 · 중3',  text: '고전이라서 어려울 줄 알았는데 생각보다 읽기 쉽고 감동적이었어요. 추천합니다!', likes: 5,  mine: false, at: '2026.04.18' },
    ].filter(c => !deletedMockIds.has(c.id));

    const all = [...stored, ...mockComments];
    document.getElementById('comment-count-label').textContent = all.length;

    document.getElementById('comment-list').innerHTML = all.map(c => {
      const colors = ['#3D3080', '#FF6B35', '#B8DFD5', '#F5D5E5', '#DEC8F0'];
      const avatarColor = colors[Math.abs(c.name.charCodeAt(0)) % colors.length];
      const dark = isColorDark(avatarColor);
      const canDelete = c.mine || (isAdmin && editMode);
      return `
        <div class="comment-item ${c.mine ? 'comment-mine' : ''}">
          <div class="comment-avatar" style="background:${avatarColor};color:${dark ? '#fff' : '#2A1F5C'}">${c.name[0]}</div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-name">${c.name}</span>
              <span class="comment-school">${c.school}</span>
              ${c.mine ? '<span class="badge badge--webtoon" style="font-size:9px">내 댓글</span>' : ''}
              ${isAdmin && editMode && !c.mine ? '<span class="badge" style="font-size:9px;background:var(--color-danger-bg);color:var(--color-danger)">admin</span>' : ''}
            </div>
            <p class="comment-text">${c.text}</p>
            <div class="comment-actions">
              <button class="comment-action">❤️ ${c.likes}</button>
              <button class="comment-action">답글</button>
              ${canDelete
                ? `<button class="comment-action" data-del-comment="${c.id}" style="color:var(--color-danger)">🗑 삭제</button>`
                : '<button class="comment-action">⋯ 더보기</button>'}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── 저장 ── */
  function saveBook() {
    /* contenteditable 최종 동기화 */
    const titleEl    = document.getElementById('detail-title');
    const authorEl   = document.getElementById('detail-author');
    const subtitleEl = document.getElementById('detail-subtitle');
    if (titleEl)    editState.title    = titleEl.textContent.trim();
    if (authorEl)   editState.author   = authorEl.textContent.trim();
    if (subtitleEl) editState.subtitle = subtitleEl.textContent.trim();

    if (!isLocal) {
      alert('Google Sheets 기반 도서는 직접 저장할 수 없습니다.\nSheets에서 수정해주세요.');
      return;
    }

    const raw = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    const idx = raw.findIndex(b => b.book_id === bookId);
    if (idx === -1) { alert('도서를 찾을 수 없습니다.'); return; }

    raw[idx] = { ...raw[idx], ...editState };
    localStorage.setItem('tb_local_books', JSON.stringify(raw));

    const status = document.getElementById('edit-status');
    if (status) {
      status.textContent = '✅ 저장됨 · 방금 전';
      setTimeout(() => { status.textContent = '⊙ 자동 저장됨 · 방금 전'; }, 2500);
    }
    document.title = `${editState.title} — TOONING BOOKS`;
    document.getElementById('breadcrumb-title').textContent = editState.title;
  }

  /* ── 도서 삭제 ── */
  function deleteBook() {
    if (!confirm(`"${editState.title}" 도서를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    if (!isLocal) { alert('Google Sheets 기반 도서는 여기서 삭제할 수 없습니다.'); return; }
    const raw     = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    const updated = raw.filter(b => b.book_id !== bookId);
    localStorage.setItem('tb_local_books', JSON.stringify(updated));
    location.href = './index.html';
  }

  /* ── textarea 동기화 (구조 변경 전 호출) ── */
  function syncBlockInputs() {
    document.querySelectorAll('.block-text-input').forEach(ta => {
      const idx = Number(ta.dataset.blockIdx);
      if (editState.detail_blocks[idx]) editState.detail_blocks[idx].text = ta.value;
    });
    document.querySelectorAll('.block-source-input').forEach(inp => {
      const idx = Number(inp.dataset.blockIdx);
      if (editState.detail_blocks[idx]) editState.detail_blocks[idx].source = inp.value;
    });
  }


  /* ═══════════════════════════════════
       EVENTS
  ═══════════════════════════════════ */

  function setupEvents() {

    document.addEventListener('click', e => {

      /* ── 도서 카드 클릭 → 상세 ── */
      const card = e.target.closest('[data-action="open-book"]');
      if (card) { location.href = `detail.html?book_id=${card.dataset.bookId}`; return; }

      /* ── 관리자 패널 ── */
      if (e.target.closest('#admin-toggle-btn')) { openAdminPanel(); return; }
      if (e.target.closest('#admin-close-btn'))  { closeAdminPanel(); return; }
      if (e.target.closest('#admin-overlay') && !e.target.closest('#admin-panel')) { closeAdminPanel(); return; }

      /* ── EDIT ↔ READ 모드 전환 ── */
      if (e.target.closest('#admin-edit-mode-btn')) {
        /* 이미 편집 모드 — 아무 동작 없음 */
        return;
      }
      if (e.target.closest('#admin-read-mode-btn')) {
        /* 관리자 없이 새 탭에서 독자 뷰 미리보기 */
        const url = new URL(location.href);
        url.searchParams.delete('admin');
        url.searchParams.delete('mode');
        window.open(url.toString(), '_blank');
        return;
      }

      /* ── 미리보기 ── */
      if (e.target.closest('#preview-btn')) {
        const url = new URL(location.href);
        url.searchParams.delete('mode');
        window.open(url.toString(), '_blank');
        return;
      }

      /* ── 저장 후 공개 ── */
      if (e.target.closest('#publish-btn')) { saveBook(); return; }

      /* ── 도서 삭제 ── */
      if (e.target.closest('#edit-delete-btn')) { deleteBook(); return; }

      /* ── 표지 변경 (커버 클릭) ── */
      if (editMode && e.target.closest('#detail-cover')) {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            editState.cover_data_url = ev.target.result;
            renderCover(true);
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }

      /* ── 태그 삭제 ── */
      const tagDel = e.target.closest('.tag-del-btn');
      if (tagDel && editMode) {
        editState.genre_tags.splice(Number(tagDel.dataset.tagIdx), 1);
        renderTags(true);
        return;
      }

      /* ── 태그 추가 ── */
      if (e.target.closest('#tag-add-btn')) {
        const name = prompt('추가할 태그 이름을 입력하세요:');
        if (name && name.trim()) {
          editState.genre_tags.push(name.trim());
          renderTags(true);
        }
        return;
      }

      /* ── 블록 위로 ── */
      const moveUp = e.target.closest('.block-move-up');
      if (moveUp && editMode) {
        const idx = Number(moveUp.dataset.blockIdx);
        if (idx > 0) {
          syncBlockInputs();
          [editState.detail_blocks[idx - 1], editState.detail_blocks[idx]] =
            [editState.detail_blocks[idx], editState.detail_blocks[idx - 1]];
          renderBody(true);
        }
        return;
      }

      /* ── 블록 아래로 ── */
      const moveDown = e.target.closest('.block-move-down');
      if (moveDown && editMode) {
        const idx = Number(moveDown.dataset.blockIdx);
        if (idx < editState.detail_blocks.length - 1) {
          syncBlockInputs();
          [editState.detail_blocks[idx], editState.detail_blocks[idx + 1]] =
            [editState.detail_blocks[idx + 1], editState.detail_blocks[idx]];
          renderBody(true);
        }
        return;
      }

      /* ── 블록 삭제 ── */
      const blockDel = e.target.closest('.block-del');
      if (blockDel && editMode) {
        if (confirm('이 블록을 삭제하시겠습니까?')) {
          syncBlockInputs();
          editState.detail_blocks.splice(Number(blockDel.dataset.blockIdx), 1);
          renderBody(true);
        }
        return;
      }

      /* ── 블록 추가 ── */
      const addBlock = e.target.closest('.add-block-btn');
      if (addBlock && editMode) {
        syncBlockInputs();
        editState.detail_blocks.push({ type: addBlock.dataset.blockType, text: '', source: '' });
        renderBody(true);
        document.querySelector('#block-list-edit .edit-block-card:last-child')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      /* ── 관련 도서 제거 ── */
      const relDel = e.target.closest('.related-del-btn');
      if (relDel && editMode) {
        editState.related_book_ids = editState.related_book_ids.filter(id => id !== relDel.dataset.relatedId);
        renderRelatedCards(true);
        return;
      }

      /* ── 관련 도서 추가 ── */
      if (e.target.closest('#related-add-btn')) {
        const sel = document.getElementById('related-book-sel');
        const rid = sel?.value;
        if (rid && !editState.related_book_ids.includes(rid)) {
          editState.related_book_ids.push(rid);
          renderRelatedCards(true);
          if (sel) sel.value = '';
        }
        return;
      }

      /* ── 좋아요 ── */
      if (e.target.closest('#like-btn')) {
        const btn   = document.getElementById('like-btn');
        const liked = btn.classList.toggle('btn-action--liked');
        const key   = `tb_like_${book.book_id}`;
        if (liked) {
          localStorage.setItem(key, 'true');
          document.getElementById('like-count').textContent = (book.like_count + 1).toLocaleString();
        } else {
          localStorage.removeItem(key);
          document.getElementById('like-count').textContent = book.like_count.toLocaleString();
        }
        return;
      }

      /* ── 저장(북마크) ── */
      if (e.target.closest('#save-btn')) {
        const saved = JSON.parse(localStorage.getItem('tb_bookmarks') || '[]');
        if (!saved.includes(book.book_id)) {
          saved.push(book.book_id);
          localStorage.setItem('tb_bookmarks', JSON.stringify(saved));
          document.getElementById('save-btn').textContent = '✅ 저장됨';
        }
        return;
      }

      /* ── 공유 ── */
      if (e.target.closest('#share-btn')) {
        if (navigator.share) {
          navigator.share({ title: book.title, url: location.href });
        } else {
          navigator.clipboard?.writeText(location.href);
          document.getElementById('share-btn').textContent = '✅ 링크 복사됨';
          setTimeout(() => { document.getElementById('share-btn').textContent = '📤 공유'; }, 2000);
        }
        return;
      }

      /* ── 웹툰 만들기 ── */
      if (e.target.closest('#make-webtoon-btn')) {
        window.open(`https://tooning.io/character-casting?source=tooning_books&book_id=${book.book_id}&book_title=${encodeURIComponent(book.title)}`, '_blank');
        return;
      }

      /* ── 댓글 취소 ── */
      if (e.target.closest('#comment-cancel')) {
        document.getElementById('comment-input').value = '';
        return;
      }

      /* ── 댓글 작성 ── */
      if (e.target.closest('#comment-submit')) {
        const text = document.getElementById('comment-input').value.trim();
        if (!text) return;
        const key      = `tb_comments_${bookId}`;
        const comments = JSON.parse(localStorage.getItem(key) || '[]');
        comments.unshift({
          id: Date.now(), name: '나', school: '우리학교 · 중2',
          text, likes: 0, mine: true,
          at: new Date().toLocaleDateString('ko-KR')
        });
        localStorage.setItem(key, JSON.stringify(comments));
        document.getElementById('comment-input').value = '';
        renderComments();
        return;
      }

      /* ── 댓글 삭제 ── */
      const delBtn = e.target.closest('[data-del-comment]');
      if (delBtn) {
        const id  = Number(delBtn.dataset.delComment);
        const key = `tb_comments_${bookId}`;
        if (id > 0) {
          /* 본인 댓글 (localStorage) */
          const comments = JSON.parse(localStorage.getItem(key) || '[]').filter(c => c.id !== id);
          localStorage.setItem(key, JSON.stringify(comments));
        } else if (id < 0 && isAdmin && editMode) {
          /* 관리자: 목 댓글 숨기기 (세션 내) */
          deletedMockIds.add(id);
        }
        renderComments();
        return;
      }
    });

    /* ── 블록 타입 변경 ── */
    document.addEventListener('change', e => {
      const sel = e.target.closest('.edit-block-type-sel');
      if (sel && editMode) {
        const idx = Number(sel.dataset.blockIdx);
        syncBlockInputs();
        editState.detail_blocks[idx].type = sel.value;
        renderBody(true);
      }
    });

    /* ── 이미 좋아요 / 저장 상태 복원 ── */
    if (localStorage.getItem(`tb_like_${book.book_id}`)) {
      document.getElementById('like-btn')?.classList.add('btn-action--liked');
      document.getElementById('like-count').textContent = (book.like_count + 1).toLocaleString();
    }
    if (localStorage.getItem('tb_bookmarks')?.includes(book.book_id)) {
      const saveEl = document.getElementById('save-btn');
      if (saveEl) saveEl.textContent = '✅ 저장됨';
    }

    if (isAdmin) openAdminPanel();
  }

  /* ── 패널 ── */
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
    document.getElementById('error-state').style.display  = 'block';
  }

})();


/* ─── 공용 헬퍼 (IIFE 외부) ─── */

function isColorDark(hex) {
  const c = (hex || '#000').replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) || 0;
  const g = parseInt(c.slice(2, 4), 16) || 0;
  const b = parseInt(c.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function renderCoverDeco(book) {
  switch (book.cover_deco) {
    case 'circle': return `<div style="position:absolute;width:120px;height:120px;border-radius:50%;border:3px solid rgba(255,255,255,0.25);top:30px;left:50%;transform:translateX(-50%)"></div>`;
    case 'quote':  return `<div style="position:absolute;font-size:120px;color:rgba(255,255,255,0.15);top:0;left:10px;font-family:Georgia,serif;line-height:1">"</div>`;
    case 'lines':  return `<div style="position:absolute;top:30px;left:20%;width:60%;display:flex;flex-direction:column;gap:8px"><span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block"></span><span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block"></span><span style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;display:block;width:70%"></span></div>`;
    case 'square': return `<div style="position:absolute;width:100px;height:100px;border:3px solid rgba(255,255,255,0.2);top:25px;left:50%;transform:translateX(-50%)"></div>`;
    default: return '';
  }
}

function renderBlocks(blocks) {
  if (!blocks || !blocks.length) return '<p style="color:var(--color-text-3);padding:20px 0">본문 내용이 없습니다.</p>';
  return blocks.map(b => {
    switch (b.type) {
      case 'h1':        return `<h1>${b.text}</h1>`;
      case 'h2':        return `<h2>${b.text}</h2>`;
      case 'paragraph': return `<p>${b.text}</p>`;
      case 'quote':     return `<div class="block-quote"><p class="block-quote__text">"${b.text}"</p>${b.source ? `<p class="block-quote__source">— ${b.source}</p>` : ''}</div>`;
      default:          return `<p>${b.text || ''}</p>`;
    }
  }).join('');
}

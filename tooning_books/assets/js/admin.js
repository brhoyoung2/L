/* 관리자 패널 v0.5 — 도서/배너/공지/통계 + 편집 모드 */
(function initAdmin() {

  /* ── 상태 ── */
  let selectedColor  = '#3D3080';
  let selectedGrade  = 'elementary';
  let catModalColor  = '#3D3080';
  let bannerColor    = '#3D3080';
  let bannerDataUrl  = null;
  let coverDataUrl   = null;
  let editIdx        = -1;

  /* ── 로고 5회 클릭으로 관리자 활성화 ── */
  let logoClickCount = 0;
  const logo = document.querySelector('.tooning-logo');
  if (logo) {
    logo.addEventListener('click', e => {
      e.preventDefault();
      logoClickCount++;
      if (logoClickCount >= 5) { logoClickCount = 0; localStorage.setItem('tb_admin_mode','true'); openAdminPanel(); }
    });
  }

  /* ── 탭 전환 ── */
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-admin-tab]');
    if (!tab) return;
    const name = tab.dataset.adminTab;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
    document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('admin-tab-pane--active'));
    tab.classList.add('admin-tab--active');
    document.getElementById(`admin-pane-${name}`)?.classList.add('admin-tab-pane--active');
    if (name === 'stats')   renderStats();
    if (name === 'banners') renderBannersTab();
    if (name === 'notices') renderNoticesTab();
  });

  /* ── 색상 선택 (도서 폼) ── */
  document.addEventListener('click', e => {
    const colorBtn = e.target.closest('.color-pick:not([data-cat-color]):not([data-banner-color])');
    if (!colorBtn) return;
    document.querySelectorAll('.color-pick:not([data-cat-color]):not([data-banner-color])').forEach(b => b.classList.remove('color-pick--active'));
    colorBtn.classList.add('color-pick--active');
    selectedColor = colorBtn.dataset.color;
  });

  /* ── 학년 선택 ── */
  document.addEventListener('click', e => {
    const gradeBtn = e.target.closest('[data-grade-select]');
    if (!gradeBtn) return;
    document.querySelectorAll('[data-grade-select]').forEach(b => b.classList.remove('chip--active'));
    gradeBtn.classList.add('chip--active');
    selectedGrade = gradeBtn.dataset.gradeSelect;
  });

  /* ── 카테고리 칩 토글 ── */
  document.addEventListener('click', e => {
    const catBtn = e.target.closest('[data-cat-select]');
    if (!catBtn) return;
    if (catBtn.dataset.catSelect === '__new__') openCatModal();
    else catBtn.classList.toggle('chip--active');
  });

  /* ── 도서 저장 / 수정 ── */
  document.addEventListener('click', e => {
    if (!e.target.closest('#admin-save')) return;

    const title    = document.getElementById('admin-title')?.value.trim();
    const author   = document.getElementById('admin-author')?.value.trim();
    const subtitle = document.getElementById('admin-subtitle')?.value.trim();
    const tags     = document.getElementById('admin-tags')?.value.trim();
    const order    = Number(document.getElementById('admin-order')?.value) || 0;
    const featured = document.getElementById('admin-featured')?.checked || false;

    if (!title) { alert('도서 제목을 입력하세요.'); return; }

    const cats = Array.from(document.querySelectorAll('[data-cat-select].chip--active'))
      .map(c => c.dataset.catSelect).join(',');

    const saved  = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    const isEdit = editIdx >= 0;
    const prev   = isEdit ? saved[editIdx] : null;

    const bookData = {
      book_id:         isEdit ? prev.book_id : `local_${Date.now()}`,
      title,
      author:          author || '',
      subtitle:        subtitle || '',
      grade:           selectedGrade,
      cover_color:     selectedColor,
      cover_deco:      'circle',
      cover_data_url:  coverDataUrl || (prev?.cover_data_url || null),
      categories:      cats,
      genre_tags:      tags,
      display_order:   order,
      is_featured:     featured,
      is_published:    true,
      is_deleted:      false,
      view_count:      Number(document.getElementById('admin-view-count')?.value)    || (isEdit ? (prev.view_count    || 0) : Math.floor(Math.random() * 900 + 100)),
      like_count:      Number(document.getElementById('admin-like-count')?.value)    || (isEdit ? (prev.like_count    || 0) : Math.floor(Math.random() * 490 + 10)),
      comment_count:   Number(document.getElementById('admin-comment-count')?.value) || (isEdit ? (prev.comment_count || 0) : Math.floor(Math.random() * 40 + 5)),
      webtoon_count:   prev?.webtoon_count  || 0,
      reading_minutes: prev?.reading_minutes || 0,
      year:            prev?.year || new Date().getFullYear(),
      created:         prev?.created || new Date().toISOString(),
      updated:         new Date().toISOString(),
    };

    if (isEdit) saved[editIdx] = bookData;
    else        saved.push(bookData);

    localStorage.setItem('tb_local_books', JSON.stringify(saved));
    resetForm();
    renderAdminList();
    showToast(isEdit ? `"${title}" 수정 완료!` : `"${title}" 등록 완료!`);
    _reloadSections();
  });

  /* ── 취소 ── */
  document.addEventListener('click', e => {
    if (e.target.closest('#admin-cancel')) resetForm();
  });

  /* ── 도서 목록 수정/삭제 ── */
  document.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-idx]');
    if (editBtn) {
      const idx   = Number(editBtn.dataset.editIdx);
      const items = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
      if (items[idx]) {
        editIdx = idx;
        loadBookIntoForm(items[idx]);
        /* 도서 탭으로 이동 */
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
        document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('admin-tab-pane--active'));
        document.querySelector('[data-admin-tab="books"]')?.classList.add('admin-tab--active');
        document.getElementById('admin-pane-books')?.classList.add('admin-tab-pane--active');
        document.getElementById('admin-title')?.focus();
        document.getElementById('admin-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const delBtn = e.target.closest('[data-del-idx]');
    if (!delBtn) return;
    const idx   = Number(delBtn.dataset.delIdx);
    if (!confirm('이 도서를 삭제하시겠습니까?')) return;
    const items = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    items.splice(idx, 1);
    localStorage.setItem('tb_local_books', JSON.stringify(items));
    if (editIdx === idx) resetForm();
    else if (editIdx > idx) editIdx--;
    renderAdminList();
    _reloadSections();
  });

  /* ── 폼 채우기 (수정 모드) ── */
  function loadBookIntoForm(book) {
    document.getElementById('admin-title').value    = book.title    || '';
    document.getElementById('admin-author').value   = book.author   || '';
    document.getElementById('admin-subtitle').value = book.subtitle || '';
    document.getElementById('admin-tags').value     = book.genre_tags || '';
    document.getElementById('admin-order').value    = book.display_order || 0;
    const vcEl = document.getElementById('admin-view-count');
    const lcEl = document.getElementById('admin-like-count');
    const ccEl = document.getElementById('admin-comment-count');
    if (vcEl) vcEl.value = book.view_count    || 0;
    if (lcEl) lcEl.value = book.like_count    || 0;
    if (ccEl) ccEl.value = book.comment_count || 0;
    const featuredEl = document.getElementById('admin-featured');
    if (featuredEl) featuredEl.checked = !!book.is_featured;

    selectedGrade = book.grade || 'elementary';
    document.querySelectorAll('[data-grade-select]').forEach(b =>
      b.classList.toggle('chip--active', b.dataset.gradeSelect === selectedGrade));

    selectedColor = book.cover_color || '#3D3080';
    document.querySelectorAll('.color-pick:not([data-cat-color]):not([data-banner-color])').forEach(b =>
      b.classList.toggle('color-pick--active', b.dataset.color === selectedColor));

    const catIds = (book.categories || '').split(',').map(s => s.trim());
    document.querySelectorAll('[data-cat-select]').forEach(b => {
      if (b.dataset.catSelect !== '__new__')
        b.classList.toggle('chip--active', catIds.includes(b.dataset.catSelect));
    });

    coverDataUrl = book.cover_data_url || null;
    const preview     = document.getElementById('admin-dropzone-preview');
    const placeholder = document.getElementById('admin-dropzone-placeholder');
    if (preview && placeholder) {
      if (coverDataUrl) {
        preview.style.backgroundImage = `url(${coverDataUrl})`;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
      } else {
        preview.style.backgroundImage = '';
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
      }
    }

    const saveBtn   = document.getElementById('admin-save');
    const cancelBtn = document.getElementById('admin-cancel');
    if (saveBtn)   saveBtn.textContent   = '✏️ 수정 완료';
    if (cancelBtn) cancelBtn.textContent = '← 취소';

    let banner = document.getElementById('admin-edit-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'admin-edit-banner';
      banner.style.cssText = 'background:var(--color-edit-bg);border:1.5px solid var(--color-edit-border);border-radius:var(--radius-md);padding:8px 14px;font-size:12px;font-weight:600;color:var(--color-edit-text);margin-bottom:12px;display:flex;align-items:center;gap:6px';
      const formArea = document.querySelector('.admin-panel__body');
      if (formArea) formArea.insertBefore(banner, formArea.firstChild);
    }
    banner.innerHTML = `✏️ <b>${book.title}</b> 수정 중`;
    banner.style.display = 'flex';
  }

  /* ── 표지 드롭존 ── */
  const dropzone  = document.getElementById('admin-dropzone');
  const fileInput = document.getElementById('admin-cover-file');
  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput?.click());
    dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('admin-dropzone--over'); });
    dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('admin-dropzone--over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('admin-dropzone--over');
      const file = e.dataTransfer?.files?.[0];
      if (file) loadCoverFile(file);
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.[0]) loadCoverFile(fileInput.files[0]);
    });
  }

  function loadCoverFile(file) {
    if (file.size > 5 * 1024 * 1024) { alert('파일 크기 5MB 초과'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      coverDataUrl = ev.target.result;
      const preview     = document.getElementById('admin-dropzone-preview');
      const placeholder = document.getElementById('admin-dropzone-placeholder');
      if (preview)     { preview.style.backgroundImage = `url(${coverDataUrl})`; preview.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  /* ═══════════════════════════════════════════════════
     배너 탭
  ═══════════════════════════════════════════════════ */
  const BANNER_COLORS = ['#3D3080','#F5D5E5','#FFD8B0','#B8DFD5','#DEC8F0','#F8B6A0','#FF6B35'];

  function renderBannersTab() {
    const el = document.getElementById('admin-pane-banners');
    if (!el) return;
    const banners = JSON.parse(localStorage.getItem('tb_local_banners') || '[]');

    bannerDataUrl = null;
    el.innerHTML = `
      <div style="background:var(--color-chip);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--color-text)">새 배너 추가</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <input id="banner-title" type="text" placeholder="배너 제목 *" class="form-input">
          <input id="banner-subtitle" type="text" placeholder="배너 부제목 (선택)" class="form-input">
          <input id="banner-book-id" type="text" placeholder="연결 도서 ID (선택)" class="form-input">
          <div>
            <label class="form-label">배너 이미지 (선택)</label>
            <div style="display:flex;gap:8px;align-items:center">
              <div id="banner-img-preview" style="width:60px;height:40px;border-radius:6px;background:var(--color-border);display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden;flex-shrink:0">🖼</div>
              <button id="banner-img-btn" class="btn-outline" style="flex:1;padding:7px;font-size:12px">📷 이미지 업로드</button>
              <button id="banner-img-del" class="btn-outline" style="padding:7px 10px;font-size:12px;color:var(--color-danger);border-color:var(--color-danger)">✕</button>
            </div>
            <input type="file" id="banner-img-file" accept="image/*" style="display:none">
          </div>
          <div>
            <label class="form-label">배경색</label>
            <div style="display:flex;gap:7px;flex-wrap:wrap">
              ${BANNER_COLORS.map((c,i) => `
                <button class="color-pick${i===0?' color-pick--active':''}" data-banner-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
            </div>
          </div>
          <button id="banner-add-btn" class="btn-primary">+ 배너 추가</button>
        </div>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--color-text-2);margin-bottom:8px">등록된 배너 <span style="color:var(--color-primary)">(${banners.length})</span></div>
      <div id="banner-list" style="display:flex;flex-direction:column;gap:8px">
        ${banners.length
          ? banners.map((b,i) => renderBannerItem(b,i)).join('')
          : '<p style="font-size:13px;color:var(--color-text-3)">등록된 배너가 없습니다.</p>'}
      </div>`;

    /* 배너 색상 선택 */
    el.querySelectorAll('[data-banner-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('[data-banner-color]').forEach(b => b.classList.remove('color-pick--active'));
        btn.classList.add('color-pick--active');
        bannerColor = btn.dataset.bannerColor;
      });
    });

    /* 배너 이미지 업로드 */
    el.querySelector('#banner-img-btn')?.addEventListener('click', () => {
      el.querySelector('#banner-img-file')?.click();
    });
    el.querySelector('#banner-img-file')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert('파일 크기 5MB 초과'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        bannerDataUrl = ev.target.result;
        const preview = el.querySelector('#banner-img-preview');
        if (preview) { preview.innerHTML = `<img src="${bannerDataUrl}" style="width:100%;height:100%;object-fit:cover">`; }
      };
      reader.readAsDataURL(file);
    });
    el.querySelector('#banner-img-del')?.addEventListener('click', () => {
      bannerDataUrl = null;
      const preview = el.querySelector('#banner-img-preview');
      if (preview) preview.innerHTML = '🖼';
      const fileInput = el.querySelector('#banner-img-file');
      if (fileInput) fileInput.value = '';
    });
  }

  function renderBannerItem(b, i) {
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--color-chip);border-radius:var(--radius-md);opacity:${b.is_active?1:0.5}">
        <div style="width:36px;height:24px;border-radius:4px;background:${b.cover_color||'#3D3080'};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title}</div>
          ${b.subtitle ? `<div style="font-size:11px;color:var(--color-text-3)">${b.subtitle}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button data-banner-toggle="${i}" style="border:none;background:none;font-size:14px;cursor:pointer" title="${b.is_active?'비활성화':'활성화'}">${b.is_active?'✅':'⬜'}</button>
          <button data-banner-del="${i}" style="border:none;background:none;font-size:14px;cursor:pointer;color:var(--color-text-3)" title="삭제">🗑</button>
        </div>
      </div>`;
  }

  document.addEventListener('click', e => {
    /* 배너 추가 */
    if (e.target.closest('#banner-add-btn')) {
      const title    = document.getElementById('banner-title')?.value.trim();
      const subtitle = document.getElementById('banner-subtitle')?.value.trim();
      const bookId   = document.getElementById('banner-book-id')?.value.trim();
      if (!title) { alert('배너 제목을 입력하세요.'); return; }
      const banners = JSON.parse(localStorage.getItem('tb_local_banners') || '[]');
      banners.push({
        banner_id:      `banner_${Date.now()}`,
        title, subtitle, book_id: bookId,
        cover_color:    bannerColor,
        cover_data_url: bannerDataUrl || null,
        is_active:      true,
        created:        new Date().toISOString(),
      });
      localStorage.setItem('tb_local_banners', JSON.stringify(banners));
      showToast(`"${title}" 배너 추가됨`);
      renderBannersTab();
      return;
    }

    /* 배너 토글 */
    const bannerToggle = e.target.closest('[data-banner-toggle]');
    if (bannerToggle) {
      const banners = JSON.parse(localStorage.getItem('tb_local_banners') || '[]');
      const idx = Number(bannerToggle.dataset.bannerToggle);
      if (banners[idx]) {
        banners[idx].is_active = !banners[idx].is_active;
        localStorage.setItem('tb_local_banners', JSON.stringify(banners));
        renderBannersTab();
      }
      return;
    }

    /* 배너 삭제 */
    const bannerDel = e.target.closest('[data-banner-del]');
    if (bannerDel) {
      if (!confirm('배너를 삭제하시겠습니까?')) return;
      const banners = JSON.parse(localStorage.getItem('tb_local_banners') || '[]');
      banners.splice(Number(bannerDel.dataset.bannerDel), 1);
      localStorage.setItem('tb_local_banners', JSON.stringify(banners));
      showToast('배너가 삭제됐습니다');
      renderBannersTab();
      return;
    }
  });

  /* ═══════════════════════════════════════════════════
     공지 탭
  ═══════════════════════════════════════════════════ */
  function renderNoticesTab() {
    const el = document.getElementById('admin-pane-notices');
    if (!el) return;
    const notices = JSON.parse(localStorage.getItem('tb_local_notices') || '[]');

    el.innerHTML = `
      <div style="background:var(--color-chip);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--color-text)">새 공지 등록</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <input id="notice-title" type="text" placeholder="공지 제목 *" class="form-input">
          <textarea id="notice-content" placeholder="공지 내용" class="form-textarea" rows="3"></textarea>
          <div style="display:flex;gap:6px">
            <button class="chip chip--active" data-notice-type="normal" id="notice-type-normal">📢 일반</button>
            <button class="chip" data-notice-type="important" id="notice-type-important">🔴 중요</button>
          </div>
          <button id="notice-add-btn" class="btn-primary">+ 공지 등록</button>
        </div>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--color-text-2);margin-bottom:8px">등록된 공지 <span style="color:var(--color-primary)">(${notices.length})</span></div>
      <div id="notice-list" style="display:flex;flex-direction:column;gap:8px">
        ${notices.length
          ? notices.slice().reverse().map((n, revI) => renderNoticeItem(n, notices.length - 1 - revI)).join('')
          : '<p style="font-size:13px;color:var(--color-text-3)">등록된 공지가 없습니다.</p>'}
      </div>`;

    let noticeType = 'normal';
    el.querySelectorAll('[data-notice-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('[data-notice-type]').forEach(b => b.classList.remove('chip--active'));
        btn.classList.add('chip--active');
        noticeType = btn.dataset.noticeType;
      });
    });

    el.querySelector('#notice-add-btn')?.addEventListener('click', () => {
      const title   = el.querySelector('#notice-title')?.value.trim();
      const content = el.querySelector('#notice-content')?.value.trim();
      if (!title) { alert('공지 제목을 입력하세요.'); return; }
      const notices = JSON.parse(localStorage.getItem('tb_local_notices') || '[]');
      notices.push({
        notice_id: `notice_${Date.now()}`,
        title, content, type: noticeType,
        is_visible: true,
        created:    new Date().toISOString(),
      });
      localStorage.setItem('tb_local_notices', JSON.stringify(notices));
      showToast(`"${title}" 공지 등록됨`);
      renderNoticesTab();
    });
  }

  function renderNoticeItem(n, realIdx) {
    const date = new Date(n.created).toLocaleDateString('ko-KR', { month:'short', day:'numeric' });
    return `
      <div style="padding:12px;background:var(--color-chip);border-radius:var(--radius-md);border-left:3px solid ${n.type==='important'?'var(--color-danger)':'var(--color-border)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px">${n.type==='important'?'🔴':'📢'}</span>
            <span style="font-size:13px;font-weight:700">${n.title}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:10px;color:var(--color-text-3)">${date}</span>
            <button data-notice-del="${realIdx}" style="border:none;background:none;font-size:13px;cursor:pointer;color:var(--color-text-3)" title="삭제">🗑</button>
          </div>
        </div>
        ${n.content ? `<div style="font-size:12px;color:var(--color-text-2);line-height:1.5">${n.content}</div>` : ''}
      </div>`;
  }

  document.addEventListener('click', e => {
    const noticeDel = e.target.closest('[data-notice-del]');
    if (!noticeDel) return;
    if (!confirm('이 공지를 삭제하시겠습니까?')) return;
    const notices = JSON.parse(localStorage.getItem('tb_local_notices') || '[]');
    notices.splice(Number(noticeDel.dataset.noticeDel), 1);
    localStorage.setItem('tb_local_notices', JSON.stringify(notices));
    showToast('공지가 삭제됐습니다');
    renderNoticesTab();
  });

  /* ═══════════════════════════════════════════════════
     통계 탭
  ═══════════════════════════════════════════════════ */
  function renderStats() {
    const el = document.getElementById('admin-pane-stats');
    if (!el) return;

    const { books = [], categories = [], webtoons = [] } = window._tb_appData || {};
    const localBooks = JSON.parse(localStorage.getItem('tb_local_books') || '[]').filter(b => !b.is_deleted);
    const localBanners = JSON.parse(localStorage.getItem('tb_local_banners') || '[]');
    const localNotices = JSON.parse(localStorage.getItem('tb_local_notices') || '[]');

    const totalViews   = books.reduce((s,b) => s + (b.view_count||0), 0);
    const totalLikes   = books.reduce((s,b) => s + (b.like_count||0), 0);
    const totalComments= books.reduce((s,b) => s + (b.comment_count||0), 0);
    const topBooks     = [...books].sort((a,b) => (b.view_count||0)-(a.view_count||0)).slice(0,5);

    const stat = (label, value, color='var(--color-primary)') =>
      `<div style="background:var(--color-chip);border-radius:var(--radius-lg);padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${color}">${value}</div>
        <div style="font-size:11px;color:var(--color-text-3);margin-top:3px">${label}</div>
      </div>`;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${stat('전체 도서', books.length)}
        ${stat('로컬 등록', localBooks.length, 'var(--color-text)')}
        ${stat('총 조회수', totalViews.toLocaleString(), 'var(--color-text)')}
        ${stat('총 좋아요', totalLikes.toLocaleString(), 'var(--color-danger, #e53e3e)')}
        ${stat('댓글 수', totalComments.toLocaleString(), 'var(--color-text)')}
        ${stat('카테고리', categories.length, 'var(--color-text)')}
        ${stat('웹툰', webtoons.length, 'var(--color-text)')}
        ${stat('공지', localNotices.length, 'var(--color-text)')}
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--color-text-2);margin-bottom:8px">👁 조회수 TOP 5</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${topBooks.length ? topBooks.map((b,i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--color-chip);border-radius:var(--radius-md)">
            <span style="font-size:13px;font-weight:800;color:${i<3?'var(--color-primary)':'var(--color-text-3)'};width:16px;text-align:center;flex-shrink:0">${i+1}</span>
            <div style="width:24px;height:34px;border-radius:4px;background:${b.cover_color||'#3D3080'};flex-shrink:0;${b.cover_data_url?`background-image:url('${b.cover_data_url}');background-size:cover`:''}"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title}</div>
              <div style="font-size:10px;color:var(--color-text-3)">${b.author}</div>
            </div>
            <span style="font-size:11px;color:var(--color-text-3);flex-shrink:0">👁 ${(b.view_count||0).toLocaleString()}</span>
          </div>`).join('')
          : '<p style="font-size:13px;color:var(--color-text-3)">데이터를 불러오는 중...</p>'}
      </div>`;
  }

  /* ═══════════════════════════════════════════════════
     새 카테고리 모달
  ═══════════════════════════════════════════════════ */
  function openCatModal() {
    const overlay = document.getElementById('cat-modal-overlay');
    if (!overlay) return;
    populateCatPositionSelect();
    overlay.classList.add('modal-overlay--open');
    document.getElementById('cat-modal-name')?.focus();
  }
  function closeCatModal() {
    document.getElementById('cat-modal-overlay')?.classList.remove('modal-overlay--open');
  }
  function populateCatPositionSelect() {
    const sel = document.getElementById('cat-modal-position');
    if (!sel) return;
    const localCats = JSON.parse(localStorage.getItem('tb_local_cats') || '[]');
    const items = ['인기 도서 다음','이달의 추천 다음','웹툰 도서 다음','학년별 BEST 다음','마지막에 추가',...localCats.map(c=>c.name+' 다음')];
    sel.innerHTML = items.map((v,i) => `<option value="${i}">${v}</option>`).join('');
    sel.value = String(items.length - 1);
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#cat-modal-close') || e.target.closest('#cat-modal-cancel')) { closeCatModal(); return; }
    const overlay = document.getElementById('cat-modal-overlay');
    if (e.target === overlay) { closeCatModal(); return; }

    const catColorBtn = e.target.closest('[data-cat-color]');
    if (catColorBtn) {
      document.querySelectorAll('[data-cat-color]').forEach(b => b.classList.remove('color-pick--active'));
      catColorBtn.classList.add('color-pick--active');
      catModalColor = catColorBtn.dataset.catColor;
    }

    const catGradeBtn = e.target.closest('[data-cat-grade]');
    if (catGradeBtn) catGradeBtn.classList.toggle('chip--active');

    if (e.target.closest('#cat-modal-confirm')) {
      const name = document.getElementById('cat-modal-name')?.value.trim();
      if (!name) { alert('카테고리 이름을 입력하세요.'); return; }
      const grades = Array.from(document.querySelectorAll('[data-cat-grade].chip--active')).map(b=>b.dataset.catGrade).join(',');
      const newCat = {
        category_id: `cat_local_${Date.now()}`, name,
        color: catModalColor, applied_grades: grades,
        display_order: 99, is_default: false, is_deleted: false,
      };
      const catSaved = JSON.parse(localStorage.getItem('tb_local_cats') || '[]');
      catSaved.push(newCat);
      localStorage.setItem('tb_local_cats', JSON.stringify(catSaved));
      buildCatChips();
      closeCatModal();
      document.getElementById('cat-modal-name').value = '';
      showToast(`"${name}" 카테고리 추가됨`);
    }
  });

  document.getElementById('cat-modal-name')?.addEventListener('input', function() {
    const counter = document.getElementById('cat-name-count');
    if (counter) counter.textContent = `${this.value.length} / 20`;
  });

  /* ── 카테고리 칩 생성 ── */
  async function buildCatChips() {
    const el = document.getElementById('admin-cat-chips');
    if (!el) return;
    try {
      const remoteCats = await TB.getCategories();
      const localCats  = JSON.parse(localStorage.getItem('tb_local_cats') || '[]');
      const allCats    = [...remoteCats, ...localCats];
      el.innerHTML = allCats.map(c => `
        <button class="chip" data-cat-select="${c.category_id}" style="border-color:${c.color||'var(--color-primary)'}">
          ${c.name}
        </button>`).join('') +
        `<button class="chip chip--dashed" data-cat-select="__new__" style="border-style:dashed">+ 새 카테고리</button>`;
    } catch {
      el.innerHTML = `<button class="chip chip--dashed" data-cat-select="__new__" style="border-style:dashed">+ 새 카테고리</button>`;
    }
  }

  /* ── 도서 목록 렌더 ── */
  function renderAdminList() {
    const list    = document.getElementById('admin-book-list');
    const counter = document.getElementById('admin-count');
    if (!list) return;
    const saved = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    if (counter) counter.textContent = saved.length ? `(${saved.length})` : '';
    if (!saved.length) {
      list.innerHTML = '<p style="font-size:13px;color:var(--color-text-3);padding:8px 0">아직 추가된 도서가 없습니다.</p>';
      return;
    }
    list.innerHTML = saved.map((b, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:${i===editIdx?'var(--color-edit-bg)':'var(--color-chip)'};border-radius:var(--radius-md);border:${i===editIdx?'1.5px solid var(--color-edit-border)':'1.5px solid transparent'}">
        <div style="width:32px;height:44px;border-radius:6px;background:${b.cover_color||'#3D3080'};flex-shrink:0;${b.cover_data_url?`background-image:url('${b.cover_data_url}');background-size:cover;background-position:center`:''}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title}</div>
          <div style="font-size:11px;color:var(--color-text-3)">${b.author||'작가 미입력'} · ${b.grade==='elementary'?'초등':b.grade==='middle'?'중등':b.grade==='high'?'고등':b.grade}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button data-edit-idx="${i}" style="border:none;background:none;font-size:14px;cursor:pointer;color:${i===editIdx?'var(--color-edit-text)':'var(--color-text-2)'}" title="수정">✏️</button>
          <button data-del-idx="${i}"  style="border:none;background:none;font-size:14px;cursor:pointer;color:var(--color-text-3)" title="삭제">🗑</button>
        </div>
      </div>`).join('');
  }

  /* ── 폼 초기화 ── */
  function resetForm() {
    editIdx = -1;
    ['admin-title','admin-author','admin-subtitle','admin-tags'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const orderEl    = document.getElementById('admin-order');
    const featuredEl = document.getElementById('admin-featured');
    if (orderEl)    orderEl.value      = '0';
    if (featuredEl) featuredEl.checked = false;
    /* 통계 기본값: 신규 등록 시 적절한 숫자로 채움 */
    const vcEl = document.getElementById('admin-view-count');
    const lcEl = document.getElementById('admin-like-count');
    const ccEl = document.getElementById('admin-comment-count');
    if (vcEl) vcEl.value = Math.floor(Math.random() * 900 + 100);
    if (lcEl) lcEl.value = Math.floor(Math.random() * 490 + 10);
    if (ccEl) ccEl.value = Math.floor(Math.random() * 40 + 5);

    document.querySelectorAll('[data-cat-select]').forEach(b => b.classList.remove('chip--active'));
    document.querySelectorAll('[data-grade-select]').forEach((b,i) => b.classList.toggle('chip--active', i === 0));
    selectedGrade = 'elementary';
    selectedColor = '#3D3080';
    coverDataUrl  = null;

    const preview     = document.getElementById('admin-dropzone-preview');
    const placeholder = document.getElementById('admin-dropzone-placeholder');
    if (preview)     { preview.style.backgroundImage=''; preview.style.display='none'; }
    if (placeholder) placeholder.style.display = 'flex';
    document.querySelectorAll('.color-pick:not([data-cat-color]):not([data-banner-color])').forEach((b,i) => b.classList.toggle('color-pick--active', i === 0));

    const saveBtn   = document.getElementById('admin-save');
    const cancelBtn = document.getElementById('admin-cancel');
    if (saveBtn)   saveBtn.textContent   = '💾 저장하기';
    if (cancelBtn) cancelBtn.textContent = '취소';

    const banner = document.getElementById('admin-edit-banner');
    if (banner) banner.style.display = 'none';

    renderAdminList();
  }

  /* ── 섹션 새로고침 (app.js 연동) ── */
  function _reloadSections() {
    if (typeof window._tb_reloadSections === 'function') window._tb_reloadSections();
  }

  /* ── 토스트 알림 ── */
  function showToast(msg) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-toast';
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:9999;opacity:0;transition:opacity 0.3s;white-space:nowrap;pointer-events:none';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  function openAdminPanel() {
    document.getElementById('admin-panel')?.classList.add('admin-panel--open');
    document.getElementById('admin-overlay')?.classList.add('admin-overlay--open');
  }

  /* ═══════════════════════════════════════════════════
     외부 API 노출
  ═══════════════════════════════════════════════════ */

  /* 카드 ✏️ → 관리자 패널 편집 모드 진입 */
  window._tb_openEdit = function(bookId) {
    const items = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    const idx   = items.findIndex(b => b.book_id === bookId);
    if (idx >= 0) {
      editIdx = idx;
      loadBookIntoForm(items[idx]);
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
      document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('admin-tab-pane--active'));
      document.querySelector('[data-admin-tab="books"]')?.classList.add('admin-tab--active');
      document.getElementById('admin-pane-books')?.classList.add('admin-tab-pane--active');
      openAdminPanel();
    } else {
      openAdminPanel();
      showToast('Google Sheets 도서는 시트에서 직접 편집하세요');
    }
  };

  /* 카드 🖼 → 파일 선택 → 표지 즉시 변경 */
  window._tb_changeCover = function(bookId) {
    const items = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    const idx   = items.findIndex(b => b.book_id === bookId);
    if (idx < 0) { showToast('로컬 등록 도서만 표지 변경이 가능합니다'); return; }

    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast('파일 크기 5MB 초과'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        items[idx].cover_data_url = ev.target.result;
        items[idx].updated        = new Date().toISOString();
        localStorage.setItem('tb_local_books', JSON.stringify(items));
        showToast(`"${items[idx].title}" 표지 변경됨`);
        _reloadSections();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  /* ── 초기화 ── */
  buildCatChips();
  renderAdminList();

})();

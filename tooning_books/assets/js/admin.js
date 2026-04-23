/* 관리자 패널 v0.4 — 탭/폼/드롭존/새카테고리/localStorage + 편집 모드 */
(function initAdmin() {

  /* ── 상태 ── */
  let selectedColor = '#3D3080';
  let selectedGrade = 'elementary';
  let catModalColor = '#3D3080';
  let coverDataUrl  = null;
  let editIdx       = -1; // -1 = 신규, >=0 = 수정 중 인덱스

  /* ── 숨겨진 관리자 활성화: 로고 5회 클릭 ── */
  let logoClickCount = 0;
  const logo = document.querySelector('.tooning-logo');
  if (logo) {
    logo.addEventListener('click', e => {
      e.preventDefault();
      logoClickCount++;
      if (logoClickCount >= 5) {
        logoClickCount = 0;
        localStorage.setItem('tb_admin_mode', 'true');
        openAdminPanel();
      }
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
  });

  /* ── 색상 선택 ── */
  document.addEventListener('click', e => {
    const colorBtn = e.target.closest('.color-pick:not([data-cat-color])');
    if (!colorBtn) return;
    document.querySelectorAll('.color-pick:not([data-cat-color])').forEach(b => b.classList.remove('color-pick--active'));
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

  /* ── 저장 / 수정 ── */
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

    const saved = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
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
      like_count:      prev?.like_count    || 0,
      view_count:      prev?.view_count    || 0,
      comment_count:   prev?.comment_count || 0,
      webtoon_count:   prev?.webtoon_count || 0,
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
    if (!e.target.closest('#admin-cancel')) return;
    resetForm();
  });

  /* ── 도서 목록 수정/삭제 버튼 ── */
  document.addEventListener('click', e => {
    /* 수정 */
    const editBtn = e.target.closest('[data-edit-idx]');
    if (editBtn) {
      const idx   = Number(editBtn.dataset.editIdx);
      const items = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
      if (items[idx]) {
        editIdx = idx;
        loadBookIntoForm(items[idx]);
        document.getElementById('admin-title')?.focus();
        document.getElementById('admin-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    /* 삭제 */
    const delBtn = e.target.closest('[data-del-idx]');
    if (!delBtn) return;
    const idx = Number(delBtn.dataset.delIdx);
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
    const featuredEl = document.getElementById('admin-featured');
    if (featuredEl) featuredEl.checked = !!book.is_featured;

    /* 학년 */
    selectedGrade = book.grade || 'elementary';
    document.querySelectorAll('[data-grade-select]').forEach(b =>
      b.classList.toggle('chip--active', b.dataset.gradeSelect === selectedGrade));

    /* 색상 */
    selectedColor = book.cover_color || '#3D3080';
    document.querySelectorAll('.color-pick:not([data-cat-color])').forEach(b =>
      b.classList.toggle('color-pick--active', b.dataset.color === selectedColor));

    /* 카테고리 */
    const catIds = (book.categories || '').split(',').map(s => s.trim());
    document.querySelectorAll('[data-cat-select]').forEach(b => {
      if (b.dataset.catSelect !== '__new__')
        b.classList.toggle('chip--active', catIds.includes(b.dataset.catSelect));
    });

    /* 표지 이미지 */
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

    /* 버튼 텍스트 */
    const saveBtn = document.getElementById('admin-save');
    if (saveBtn) saveBtn.textContent = '✏️ 수정 완료';
    const cancelBtn = document.getElementById('admin-cancel');
    if (cancelBtn) cancelBtn.textContent = '← 취소';

    /* 수정 중 배너 */
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
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('admin-dropzone--over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('admin-dropzone--over'));
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

  /* ── 새 카테고리 모달 ── */
  let catModalOpen = false;

  function openCatModal() {
    const overlay = document.getElementById('cat-modal-overlay');
    if (!overlay) return;
    populateCatPositionSelect();
    overlay.classList.add('modal-overlay--open');
    catModalOpen = true;
    document.getElementById('cat-modal-name')?.focus();
  }

  function closeCatModal() {
    document.getElementById('cat-modal-overlay')?.classList.remove('modal-overlay--open');
    catModalOpen = false;
  }

  function populateCatPositionSelect() {
    const sel = document.getElementById('cat-modal-position');
    if (!sel) return;
    const localCats = JSON.parse(localStorage.getItem('tb_local_cats') || '[]');
    const items = ['인기 도서 다음', '이달의 추천 다음', '웹툰 도서 다음', '학년별 BEST 다음', '마지막에 추가', ...localCats.map(c => c.name + ' 다음')];
    sel.innerHTML = items.map((v, i) => `<option value="${i}">${v}</option>`).join('');
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
      const grades = Array.from(document.querySelectorAll('[data-cat-grade].chip--active')).map(b => b.dataset.catGrade).join(',');
      const newCat = {
        category_id: `cat_local_${Date.now()}`,
        name, color: catModalColor,
        applied_grades: grades,
        display_order: 99,
        is_default: false, is_deleted: false
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
        <button class="chip" data-cat-select="${c.category_id}" style="border-color:${c.color || 'var(--color-primary)'}">
          ${c.name}
        </button>`).join('') +
        `<button class="chip chip--dashed" data-cat-select="__new__" style="border-style:dashed">+ 새 카테고리</button>`;
    } catch {
      el.innerHTML = '<button class="chip chip--dashed" data-cat-select="__new__" style="border-style:dashed">+ 새 카테고리</button>';
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
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:${i === editIdx ? 'var(--color-edit-bg)' : 'var(--color-chip)'};border-radius:var(--radius-md);border:${i === editIdx ? '1.5px solid var(--color-edit-border)' : '1.5px solid transparent'}">
        <div style="width:32px;height:44px;border-radius:6px;background:${b.cover_color || '#3D3080'};flex-shrink:0;${b.cover_data_url ? `background-image:url(${b.cover_data_url});background-size:cover;background-position:center` : ''}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title}</div>
          <div style="font-size:11px;color:var(--color-text-3)">${b.author || '작가 미입력'} · ${b.grade === 'elementary' ? '초등' : b.grade === 'middle' ? '중등' : b.grade === 'high' ? '고등' : b.grade}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button data-edit-idx="${i}" style="border:none;background:none;font-size:14px;cursor:pointer;color:${i === editIdx ? 'var(--color-edit-text)' : 'var(--color-text-2)'}" title="수정">✏️</button>
          <button data-del-idx="${i}" style="border:none;background:none;font-size:14px;cursor:pointer;color:var(--color-text-3)" title="삭제">🗑</button>
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
    const orderEl = document.getElementById('admin-order');
    if (orderEl) orderEl.value = '0';
    const featuredEl = document.getElementById('admin-featured');
    if (featuredEl) featuredEl.checked = false;
    document.querySelectorAll('[data-cat-select]').forEach(b => b.classList.remove('chip--active'));
    document.querySelectorAll('[data-grade-select]').forEach((b, i) => b.classList.toggle('chip--active', i === 0));
    selectedGrade = 'elementary';
    selectedColor = '#3D3080';
    coverDataUrl  = null;
    const preview     = document.getElementById('admin-dropzone-preview');
    const placeholder = document.getElementById('admin-dropzone-placeholder');
    if (preview)     { preview.style.backgroundImage = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    document.querySelectorAll('.color-pick:not([data-cat-color])').forEach((b, i) => b.classList.toggle('color-pick--active', i === 0));

    const saveBtn = document.getElementById('admin-save');
    if (saveBtn) saveBtn.textContent = '💾 저장하기';
    const cancelBtn = document.getElementById('admin-cancel');
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

  /* ── 초기화 ── */
  buildCatChips();
  renderAdminList();

})();

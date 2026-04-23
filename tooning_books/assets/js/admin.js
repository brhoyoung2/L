/* 관리자 패널 — 도서 등록 & 목록 (v0.3: localStorage 저장) */
(function initAdmin() {

  let selectedColor = '#3D3080';
  let selectedGrade = 'elementary';

  /* 카테고리 칩 동적 생성 */
  async function buildCatChips() {
    const el = document.getElementById('admin-cat-chips');
    if (!el) return;
    try {
      const cats = await TB.getCategories();
      el.innerHTML = cats.map(c => `
        <button class="chip" data-cat-select="${c.category_id}" style="border-color:${c.color}">
          ${c.name}
        </button>`).join('');
    } catch(e) {
      el.innerHTML = '<span style="font-size:12px;color:var(--color-text-3)">카테고리 로드 실패</span>';
    }
  }

  function getSelectedCats() {
    const chips = document.querySelectorAll('[data-cat-select].chip--active');
    return Array.from(chips).map(c => c.dataset.catSelect).join(',');
  }

  function renderAdminList() {
    const list    = document.getElementById('admin-book-list');
    const counter = document.getElementById('admin-count');
    if (!list) return;

    const saved = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    if (counter) counter.textContent = `(${saved.length})`;
    if (!saved.length) {
      list.innerHTML = '<p style="font-size:13px;color:var(--color-text-3);padding:8px 0">아직 추가된 도서가 없습니다.</p>';
      return;
    }
    list.innerHTML = saved.map((b, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--color-chip);border-radius:var(--radius-md)">
        <div style="width:32px;height:42px;border-radius:6px;background:${b.cover_color};flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.1)"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title}</div>
          <div style="font-size:11px;color:var(--color-text-3)">${b.author || '작가 미입력'} · ${b.grade}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button data-edit-idx="${i}" style="border:none;background:none;font-size:14px;cursor:pointer;color:var(--color-primary)" title="상세 보기">→</button>
          <button data-del-idx="${i}" style="border:none;background:none;font-size:14px;cursor:pointer;color:var(--color-text-3)" title="삭제">🗑</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-del-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.delIdx);
        const items = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
        items.splice(idx, 1);
        localStorage.setItem('tb_local_books', JSON.stringify(items));
        renderAdminList();
      });
    });
  }

  document.addEventListener('click', e => {

    /* 색상 선택 */
    const colorBtn = e.target.closest('.color-pick');
    if (colorBtn) {
      document.querySelectorAll('.color-pick').forEach(b => b.classList.remove('color-pick--active'));
      colorBtn.classList.add('color-pick--active');
      selectedColor = colorBtn.dataset.color;
    }

    /* 학년 선택 */
    const gradeBtn = e.target.closest('[data-grade-select]');
    if (gradeBtn) {
      document.querySelectorAll('[data-grade-select]').forEach(b => b.classList.remove('chip--active'));
      gradeBtn.classList.add('chip--active');
      selectedGrade = gradeBtn.dataset.gradeSelect;
    }

    /* 카테고리 선택 (토글) */
    const catBtn = e.target.closest('[data-cat-select]');
    if (catBtn) {
      catBtn.classList.toggle('chip--active');
    }

    /* 저장 */
    if (e.target.closest('#admin-save')) {
      const title    = document.getElementById('admin-title')?.value.trim();
      const author   = document.getElementById('admin-author')?.value.trim();
      const subtitle = document.getElementById('admin-subtitle')?.value.trim();
      if (!title) { alert('도서 제목을 입력하세요.'); return; }

      const saved = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
      saved.push({
        book_id:    `local_${Date.now()}`,
        title,
        author:     author || '',
        subtitle:   subtitle || '',
        grade:      selectedGrade,
        cover_color: selectedColor,
        cover_deco: 'circle',
        categories: getSelectedCats(),
        is_featured: false,
        created:    new Date().toISOString()
      });
      localStorage.setItem('tb_local_books', JSON.stringify(saved));

      /* 입력 초기화 */
      ['admin-title','admin-author','admin-subtitle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.querySelectorAll('[data-cat-select]').forEach(b => b.classList.remove('chip--active'));

      renderAdminList();
      alert(`"${title}" 저장됨 (로컬 전용)\nv0.4+에서 Google Sheets에 실제 반영됩니다.`);
    }

    /* 취소 */
    if (e.target.closest('#admin-cancel')) {
      ['admin-title','admin-author','admin-subtitle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }

  });

  buildCatChips();
  renderAdminList();

})();

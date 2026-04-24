/* ─────────────────────────────────────────────────────────
   TOONING BOOKS — Data Layer  (Phase 6: Sheets 실연결)
   ───────────────────────────────────────────────────────── */

const SHEET_ID  = '1BfK8nHrCc89dbfqxJv0oV9NNq3eDz5TgxMoXb15hmOY';
const USE_SHEETS = true; // Phase 6: 실연결 ON

/* Sheets 탭 이름 (대소문자 정확히) */
const SHEET_NAMES = {
  books:      'Books',
  categories: 'Categories',
  comments:   'Comments',
  webtoons:   'UserWebtoons',
  banners:    'Banners',
  notices:    'Notices',
};

/* ── 연결 상태 추적 ── */
const _status = { source: 'pending', error: null };

/* ── 세션 캐시 (페이지 이동 간 재요청 방지) ── */
const _sessionKey = (tab) => `tb_cache_${tab}_${SHEET_ID.slice(-6)}`;

function _cacheGet(tab) {
  try {
    const raw = sessionStorage.getItem(_sessionKey(tab));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > 5 * 60 * 1000) return null; // 5분 TTL
    return data;
  } catch { return null; }
}

function _cacheSet(tab, data) {
  try {
    sessionStorage.setItem(_sessionKey(tab), JSON.stringify({ ts: Date.now(), data }));
  } catch { /* 저장 실패 무시 */ }
}

/* ── Sheets fetch (8초 타임아웃) ── */
async function fetchSheet(tabName) {
  const cached = _cacheGet(tabName);
  if (cached) { console.log(`[TB] 캐시 사용: ${tabName}`); return cached; }

  const url = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(tabName)}`;
  console.log(`[TB] Sheets 요청 시작: ${tabName}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  let res;
  try {
    res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`Sheets 네트워크 오류(${tabName}): ${err.message}`);
  }
  clearTimeout(timer);

  if (!res.ok) throw new Error(`Sheets HTTP ${res.status}: ${tabName}`);
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) throw new Error(`Sheet empty: ${tabName}`);
  if (Object.keys(data[0]).length === 0) throw new Error(`Sheet 헤더 없음: ${tabName}`);

  console.log(`[TB] Sheets 로드 완료: ${tabName} (${data.length}행)`);
  _cacheSet(tabName, data);
  return data;
}

/* ── Mock fetch ── */
const BASE_PATH = (() => {
  try {
    const s = document.querySelector('script[src*="data.js"]');
    return s ? s.src.replace(/assets\/js\/data\.js.*$/, '') : './';
  } catch { return './'; }
})();

async function fetchMock(name) {
  const url = `${BASE_PATH}data/${name.toLowerCase()}.mock.json`;
  console.log(`[TB] Mock 로드: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mock 파일 없음(${res.status}): ${url}`);
  const data = await res.json();
  console.log(`[TB] Mock 로드 완료: ${name} (${data.length}행)`);
  return data;
}

/* ── 통합 fetch (Sheets → mock fallback) ── */
async function fetchData(name) {
  const sheetTab = SHEET_NAMES[name] || name;

  if (USE_SHEETS) {
    try {
      const data = await fetchSheet(sheetTab);
      _status.source = 'sheets';
      _status.error  = null;
      return data;
    } catch (err) {
      console.warn(`[TB] Sheets(${sheetTab}) 실패 → mock 폴백`, err.message);
      _status.source = 'mock';
      _status.error  = err.message;
    }
  }

  const data = await fetchMock(name);
  _status.source = _status.source === 'sheets' ? 'sheets' : 'mock';
  return data;
}

/* ── Sheets 연결 상태 확인 (헬스 체크) ── */
async function checkSheetsConnection() {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/Books`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0 || Object.keys(data[0]).length === 0)
      return { ok: false, reason: '시트가 비어있거나 헤더가 없습니다' };
    return { ok: true, rows: data.length };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/* ── 타입 캐스팅 ── */
function parseBool(v) { return v === 'true' || v === 'TRUE' || v === true; }
function parseNum(v)  { return Number(v) || 0; }
function parseCSV(v)  { return (v || '').split(',').map(s => s.trim()).filter(Boolean); }

function castBook(row) {
  return {
    ...row,
    year:            parseNum(row.year),
    view_count:      parseNum(row.view_count),
    like_count:      parseNum(row.like_count),
    comment_count:   parseNum(row.comment_count),
    webtoon_count:   parseNum(row.webtoon_count),
    reading_minutes: parseNum(row.reading_minutes),
    display_order:   parseNum(row.display_order),
    is_featured:     parseBool(row.is_featured),
    is_published:    parseBool(row.is_published),
    is_deleted:      parseBool(row.is_deleted),
    categories:      parseCSV(row.categories),
    genre_tags:      parseCSV(row.genre_tags),
    detail_blocks:   (() => {
      try { return row.detail_blocks ? JSON.parse(row.detail_blocks) : []; }
      catch { return []; }
    })(),
  };
}

function castCategory(row) {
  return {
    ...row,
    category_id:   (row.category_id || '').trim(),
    name:          (row.name || '').trim(),
    display_order: parseNum(row.display_order),
    is_default:    parseBool(row.is_default),
    is_deleted:    parseBool(row.is_deleted),
  };
}

function castWebtoon(row) {
  return {
    ...row,
    panel_count: parseNum(row.panel_count),
    view_count:  parseNum(row.view_count),
    like_count:  parseNum(row.like_count),
    is_published: parseBool(row.is_published),
    is_deleted:   parseBool(row.is_deleted),
  };
}

/* ── 시트 book_id 번호 → 이미지 경로 자동 매핑 ── */
const TITLE_IMAGE_MAP = {
  '왕자와 거지':    './images/book_01.png',
  '홍길동전':      './images/book_02.png',
  '전우치전':      './images/book_03.png',
  '박씨전':        './images/book_04.png',
  '로빈슨 크루소':  './images/book_05.png',
  '크리스마스 선물': './images/book_06.png',
};

function applyImageMap(book) {
  if (book.cover_data_url || book.image_url) return book;
  /* book_01, book_02 … book_06 형식 ID → 번호 그대로 매핑 */
  const idMatch = String(book.book_id).match(/^book_(\d+)$/);
  if (idMatch) {
    const num = String(Number(idMatch[1])).padStart(2, '0');
    return { ...book, image_url: `./images/book_${num}.png` };
  }
  /* 로컬 도서: 제목으로 매핑 */
  if (TITLE_IMAGE_MAP[book.title]) {
    return { ...book, image_url: TITLE_IMAGE_MAP[book.title] };
  }
  return book;
}

/* ── 공개 API ── */
async function getBooks() {
  const raw = await fetchData('books');
  const sheetBooks = raw.map(castBook).filter(b => !b.is_deleted && b.is_published).map(applyImageMap);
  try {
    const localRaw = JSON.parse(localStorage.getItem('tb_local_books') || '[]');
    const localBooks = localRaw.map(castBook).filter(b => !b.is_deleted && b.is_published).map(applyImageMap);
    return [...sheetBooks, ...localBooks];
  } catch { return sheetBooks; }
}

async function getCategories() {
  const raw = await fetchData('categories');
  const sheetCats = raw.map(castCategory).filter(c => !c.is_deleted).sort((a, b) => a.display_order - b.display_order);
  try {
    const localCats = JSON.parse(localStorage.getItem('tb_local_cats') || '[]').filter(c => !c.is_deleted);
    return [...sheetCats, ...localCats];
  } catch { return sheetCats; }
}

async function getWebtoons(bookId) {
  const raw = await fetchData('webtoons');
  return raw
    .map(castWebtoon)
    .filter(w => !w.is_deleted && w.is_published)
    .filter(w => !bookId || w.book_id === bookId);
}

function getBooksInCategory(books, categoryId) {
  const id = (categoryId || '').trim();
  return books
    .filter(b => Array.isArray(b.categories) && b.categories.includes(id))
    .sort((a, b) => a.display_order - b.display_order);
}

function getDataStatus() { return { ..._status }; }

window.TB = {
  getBooks,
  getCategories,
  getWebtoons,
  getBooksInCategory,
  checkSheetsConnection,
  getDataStatus,
  fetchData,
  parseBool,
  parseNum,
};

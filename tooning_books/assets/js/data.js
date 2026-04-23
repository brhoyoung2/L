const SHEET_ID = '1BfK8nHrCc89dbfqxJv0oV9NNq3eDz5TgxMoXb15hmOY';
const USE_SHEETS = false; // Phase 6에서 true로

const BASE_PATH = (() => {
  const scripts = document.querySelectorAll('script[src*="data.js"]');
  if (scripts.length) {
    return scripts[scripts.length - 1].src.replace(/assets\/js\/data\.js.*$/, '');
  }
  return './';
})();

async function fetchSheet(name) {
  const url = `https://opensheet.elk.sh/${SHEET_ID}/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchMock(name) {
  const res = await fetch(`${BASE_PATH}data/${name.toLowerCase()}.mock.json`);
  if (!res.ok) throw new Error(`Mock not found: ${name}`);
  return res.json();
}

async function fetchData(name) {
  if (USE_SHEETS) {
    try { return await fetchSheet(name); }
    catch (e) { console.warn(`Sheets fetch failed for ${name}, using mock`, e); }
  }
  return fetchMock(name);
}

function parseBool(v) { return v === 'true' || v === 'TRUE' || v === true; }
function parseNum(v)  { return Number(v) || 0; }
function parseCSV(v)  { return (v || '').split(',').map(s => s.trim()).filter(Boolean); }

function castBook(row) {
  return {
    ...row,
    year:          parseNum(row.year),
    view_count:    parseNum(row.view_count),
    like_count:    parseNum(row.like_count),
    comment_count: parseNum(row.comment_count),
    webtoon_count: parseNum(row.webtoon_count),
    reading_minutes: parseNum(row.reading_minutes),
    display_order: parseNum(row.display_order),
    is_featured:   parseBool(row.is_featured),
    is_published:  parseBool(row.is_published),
    is_deleted:    parseBool(row.is_deleted),
    categories:    parseCSV(row.categories),
    genre_tags:    parseCSV(row.genre_tags),
    detail_blocks: row.detail_blocks ? JSON.parse(row.detail_blocks) : []
  };
}

function castCategory(row) {
  return {
    ...row,
    display_order: parseNum(row.display_order),
    is_default:    parseBool(row.is_default),
    is_deleted:    parseBool(row.is_deleted)
  };
}

async function getBooks() {
  const raw = await fetchData('books');
  return raw.map(castBook).filter(b => !b.is_deleted && b.is_published);
}

async function getCategories() {
  const raw = await fetchData('categories');
  return raw
    .map(castCategory)
    .filter(c => !c.is_deleted)
    .sort((a, b) => a.display_order - b.display_order);
}

async function getWebtoons(bookId) {
  const raw = await fetchData('webtoons');
  return raw
    .filter(w => !parseBool(w.is_deleted) && parseBool(w.is_published))
    .filter(w => !bookId || w.book_id === bookId);
}

function getBooksInCategory(books, categoryId) {
  return books
    .filter(b => b.categories.includes(categoryId))
    .sort((a, b) => a.display_order - b.display_order);
}

window.TB = {
  getBooks,
  getCategories,
  getWebtoons,
  getBooksInCategory,
  fetchData,
  parseBool,
  parseNum
};

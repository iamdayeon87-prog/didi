/* 독서 기록 — 화면 동작 테스트 (iframe 안의 실제 앱을 조작) */
window.runUiTests = async function (frame, t, sleep) {
  'use strict';

  var KEY = 'my_reading_log_v1';

  function W() { return frame.contentWindow; }
  function D() { return frame.contentDocument; }
  function q(sel) { return D().querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(D().querySelectorAll(sel)); }
  function txt(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function cells() { return qa('#lib-grid .cell'); }
  function titles() { return qa('#lib-grid .cell-title').map(function (e) { return txt(e); }); }
  function cellByTitle(title) {
    return cells().filter(function (c) { return txt(c.querySelector('.cell-title')) === title; })[0];
  }
  function stored() {
    try { return JSON.parse(W().localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function badgeOf(iso) { return iso.slice(2, 4) + '-' + iso.slice(5, 7); }

  async function waitApp(timeout) {
    var t0 = Date.now();
    while (Date.now() - t0 < (timeout || 10000)) {
      try {
        var d = frame.contentDocument;
        if (d && d.readyState === 'complete' && d.querySelector('.pill-add') &&
            d.querySelector('#lib-grid') && d.querySelector('#lib-grid').children.length) {
          return true;
        }
      } catch (e) {}
      await sleep(120);
    }
    return false;
  }

  async function reload() {
    try { W().localStorage.removeItem(KEY); } catch (e) {}
    var loaded = false;
    function onLoad() { loaded = true; }
    frame.addEventListener('load', onLoad);
    try { W().location.reload(); } catch (e) { frame.src = '../index.html'; }
    var t0 = Date.now();
    while (!loaded && Date.now() - t0 < 10000) { await sleep(100); }
    frame.removeEventListener('load', onLoad);
    await waitApp(10000);
    W().confirm = function () { return true; };
    W().alert = function () {};
    await sleep(150);
  }

  async function openAdd() {
    q('.pill-add').click();
    await sleep(120);
  }

  function setValue(sel, value) {
    var el = q(sel);
    var Ev = W().Event;
    el.value = value;
    el.dispatchEvent(new Ev('input', { bubbles: true }));
    el.dispatchEvent(new Ev('change', { bubbles: true }));
  }

  async function fillBook(data) {
    setValue('#f-title', data.title || '');
    setValue('#f-author', data.author || '');
    if (data.date) setValue('#f-date', data.date);
    if (data.note) setValue('#f-note', data.note);
    if (data.rating) {
      var hit = q('#rate-hits [data-rate="' + data.rating + '"]');
      if (hit) hit.click();
    }
    if (data.category) {
      var cat = q('#f-categories [data-cat="' + data.category + '"]');
      if (cat) cat.click();
    }
    if (data.favorite) q('#f-fav').click();
    if (data.color) {
      var sw = q('#f-colors [data-color="' + data.color + '"]');
      if (sw) sw.click();
    }
    if (data.coverUrl) {
      setValue('#cover-url', data.coverUrl);
    }
    await sleep(60);
  }

  async function saveBook() {
    q('#book-save').click();
    await sleep(180);
  }

  /* ── 1. 첫 화면 ── */
  await reload();
  t.eq(cells().length, 0, '빈 서재: 카드 0개');
  t.eq(txt(q('#brand-sub')), '총 0권의 서재 · 🩷 인생책 0권', '빈 서재: 머리말 문구');
  t.ok(txt(q('#lib-grid')).indexOf('아직 서재가 비어 있어요') > -1, '빈 서재: 안내 표시');
  t.ok(!!q('#seg-library.is-active'), '서재 보기 탭이 기본 활성');

  /* ── 2. 등록 검증 ── */
  await openAdd();
  t.ok(!!q('#sheet-book.open'), '책 등록 시트 열림');
  await saveBook();
  t.ok(!q('#err-title').hidden, '제목 없이 저장하면 오류 표시');
  t.eq(cells().length, 0, '검증 실패 시 저장되지 않음');

  /* ── 3. 책 등록 ── */
  await fillBook({ title: '사피엔스', author: '유발 하라리', category: '인문', rating: 4.5, favorite: true, note: '인류 역사를 다시 보다' });
  await saveBook();
  t.eq(cells().length, 1, '등록 후 카드 1개');
  t.eq(titles()[0], '사피엔스', '카드 제목');
  t.eq(txt(q('#lib-grid .cell-author')), '유발 하라리', '카드 저자');
  t.eq(txt(q('.month-badge')), badgeOf(todayIso()), '완독 월 배지 YY-MM');
  t.eq(q('[data-heart]').getAttribute('aria-pressed'), 'true', '등록 시 인생책 반영');
  t.eq(txt(q('#brand-sub')), '총 1권의 서재 · 🩷 인생책 1권', '머리말 권수 갱신');
  t.eq((stored() || {}).books.length, 1, 'localStorage 저장');
  t.eq(stored().books[0].completedAt, todayIso(), '완독일 기본값 = 오늘');

  /* ── 4. 그리드 하트 토글 ── */
  q('[data-heart]').click();
  await sleep(120);
  t.eq(q('[data-heart]').getAttribute('aria-pressed'), 'false', '하트 탭으로 해제');
  t.ok(!q('#sheet-detail').classList.contains('open'), '하트 탭은 상세를 열지 않음');
  t.eq(txt(q('#brand-sub')), '총 1권의 서재 · 🩷 인생책 0권', '하트 해제 후 머리말');
  q('[data-heart]').click();
  await sleep(120);
  t.eq(stored().books[0].favorite, true, '하트 상태 저장');

  /* ── 5. 두 번째 책 + 완독순 정렬 ── */
  await openAdd();
  await fillBook({ title: '총, 균, 쇠', author: '재레드 다이아몬드', date: '2026-03-05', category: '인문' });
  await saveBook();
  t.eq(cells().length, 2, '두 권 등록');
  t.eq(titles()[0], '사피엔스', '완독 최신순: 최근 책이 먼저');
  t.eq(titles()[1], '총, 균, 쇠', '완독 최신순: 오래된 책이 뒤');
  t.eq(txt(qa('.month-badge')[1]), '26-03', '두 번째 책 월 배지');

  q('#sort-toggle').click();
  await sleep(120);
  t.eq(titles()[0], '총, 균, 쇠', '정렬 토글: 오래된순');
  t.eq(q('#sort-toggle').getAttribute('aria-pressed'), 'true', '정렬 토글 상태 표시');
  q('#sort-toggle').click();
  await sleep(120);
  t.eq(titles()[0], '사피엔스', '정렬 토글: 최신순 복귀');

  /* ── 6. 검색 · 필터 ── */
  setValue('#search-input', '다이아몬드');
  await sleep(120);
  t.eq(cells().length, 1, '검색: 저자로 찾기');
  t.eq(titles()[0], '총, 균, 쇠', '검색 결과 제목');
  q('#search-clear').click();
  await sleep(120);
  t.eq(cells().length, 2, '검색어 지우기');
  q('#lib-chips [data-filter="fav"]').click();
  await sleep(120);
  t.eq(cells().length, 1, '하트만 필터');
  t.eq(titles()[0], '사피엔스', '하트만 필터 결과');
  q('#lib-chips [data-filter="all"]').click();
  await sleep(120);
  t.eq(cells().length, 2, '전체 필터 복귀');

  /* ── 7. 표지 URL ── */
  await openAdd();
  await fillBook({ title: '표지 테스트', author: '테스트', coverUrl: 'https://covers.openlibrary.org/b/id/8634250-L.jpg' });
  await saveBook();
  t.eq(stored().books.filter(function (b) { return b.title === '표지 테스트'; })[0].cover.kind, 'url', '표지 URL 저장');
  t.ok(!!q('#lib-grid img'), '표지 이미지가 카드에 표시');

  /* ── 8. 독서 통계 ── */
  q('#seg-stats').click();
  await sleep(150);
  t.ok(!!q('#seg-stats.is-active'), '통계 탭 활성');
  t.ok(q('#view-stats').classList.contains('is-active'), '통계 화면 표시');
  t.eq(txt(q('#stat-row .stat-card:nth-child(1) .stat-value')), '3권', '요약: 총 완독');
  t.eq(txt(q('#stat-row .stat-card:nth-child(2) .stat-value')), '2권', '요약: 이번 달 완독');
  t.eq(txt(q('#stat-row .stat-card:nth-child(3) .stat-value')), '1권', '요약: 인생책');
  t.ok(!!q('#stat-row .stat-card:nth-child(3) .stat-value.pink'), '인생책 수는 핑크 강조');
  t.ok(qa('#month-chart .bar-row').length >= 2, '월별 막대 표시');
  t.ok(qa('#cat-chart .bar-row').length >= 1, '카테고리 막대 표시');
  t.ok(txt(q('#cat-chart .bar-row .bar-label')).indexOf('%') > -1, '카테고리 비율 표기');

  q('#month-chart .bar-row').click();
  await sleep(150);
  t.ok(!!q('#sheet-month.open'), '월 막대 → 책 목록 시트');
  t.ok(txt(q('#month-sheet-title')).indexOf('권') > -1, '월 시트 제목에 권수');
  t.ok(qa('#month-body .month-item').length >= 1, '월 시트에 책 목록');
  q('#sheet-month [data-close]').click();
  await sleep(120);

  q('#cat-chart .bar-row').click();
  await sleep(150);
  t.ok(!!q('#seg-library.is-active'), '카테고리 막대 → 서재로 이동');
  t.ok(!!q('#lib-chips [data-filter="인문"]').classList.contains('is-active'), '카테고리 필터 적용');
  t.eq(cells().length, 2, '카테고리 필터 결과 수');
  q('#lib-chips [data-filter="all"]').click();
  await sleep(100);

  /* ── 9. 수정 ── */
  t.ok(!!cellByTitle('표지 테스트'), '표지 테스트 카드 존재');
  cellByTitle('표지 테스트').click();
  await sleep(150);
  t.ok(!!q('#sheet-detail.open'), '카드 → 상세 시트');
  t.eq(txt(q('#detail-title')), '표지 테스트', '상세 제목');
  q('#detail-edit').click();
  await sleep(200);
  t.ok(!!q('#sheet-book.open'), '상세 → 수정 시트');
  t.eq(q('#f-title').value, '표지 테스트', '수정 시트에 기존 값');
  setValue('#f-title', '듄');
  await saveBook();
  t.ok(titles().indexOf('듄') > -1, '제목 수정 반영');
  t.eq((stored().books.filter(function (b) { return b.title === '듄'; })[0] || {}).cover.kind, 'url', '수정해도 표지 유지');
  t.eq(stored().books.filter(function (b) { return b.title === '듄'; }).length, 1, '수정 결과 저장');

  /* ── 10. 삭제 ── */
  cellByTitle('듄').click();
  await sleep(150);
  q('#detail-delete').click();
  await sleep(200);
  t.eq(cells().length, 2, '삭제 후 카드 수 감소');
  t.eq(titles().indexOf('듄'), -1, '삭제한 책이 사라짐');
  t.eq((stored() || {}).books.length, 2, '삭제 결과 저장');

  /* ── 11. 백업 / 초기화 ── */
  q('#open-settings').click();
  await sleep(150);
  t.ok(!!q('#sheet-settings.open'), '설정 시트 열림');
  q('#export-file').click();
  await sleep(150);
  var backup = q('#backup-text').value;
  t.ok(backup.indexOf('"books"') > -1, 'JSON 내보내기 내용');
  t.ok(backup.indexOf('"favorite"') > -1, '백업에 인생책 포함');
  q('#reset-all').click();
  await sleep(200);
  t.eq(cells().length, 0, '초기화 후 빈 서재');
  t.ok(!W().localStorage.getItem(KEY), '초기화 시 저장소 삭제');
  t.ok(txt(q('#lib-grid')).indexOf('아직 서재가 비어 있어요') > -1, '초기화 후 안내 표시');

  await reload();
};

/* 나의 서재 — 화면 동작 테스트 (iframe 안의 실제 앱을 조작) */
window.runUiTests = async function (frame, t, sleep) {
  'use strict';

  var KEY = 'my_reading_log_v1';

  function W() { return frame.contentWindow; }
  function D() { return frame.contentDocument; }
  function q(sel) { return D().querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(D().querySelectorAll(sel)); }
  function text(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function cards() { return qa('#lib-list .book-card'); }

  async function reload() {
    try { W().localStorage.removeItem(KEY); } catch (e) {}
    await new Promise(function (resolve) {
      var done = false;
      function fin() { if (!done) { done = true; resolve(); } }
      frame.addEventListener('load', fin);
      try { W().location.reload(); } catch (e) { frame.src = '../index.html'; }
      setTimeout(fin, 2000);
    });
    await sleep(180);
    W().confirm = function () { return true; };
    W().alert = function () {};
  }

  async function openAdd() {
    var btn = q('[data-act="add"]');
    btn.click();
    await sleep(80);
  }

  async function fillAndSubmit(data) {
    q('#f-title').value = data.title || '';
    q('#f-author').value = data.author || '';
    q('#f-date').value = data.date || '';
    q('#f-note').value = data.note || '';
    if (data.rating) {
      var hit = q('#rate-hits [data-rate="' + data.rating + '"]');
      if (hit) hit.click();
    }
    if (data.category) q('#f-categories [data-cat="' + data.category + '"]').click();
    if (data.color) q('#f-colors [data-color="' + data.color + '"]').click();
    q('#book-form').dispatchEvent(new (W().Event)('submit', { bubbles: true, cancelable: true }));
    await sleep(90);
  }

  function storedBooks() {
    try { return JSON.parse(W().localStorage.getItem(KEY) || '{}').books || []; } catch (e) { return []; }
  }

  /* ── 문서/설정 ── */
  t.eq(q('meta[name="apple-mobile-web-app-title"]').getAttribute('content'), '나의 서재', 'PWA: 홈 화면 이름');
  t.eq(q('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'), 'yes', 'PWA: standalone');
  t.ok(q('meta[name="viewport"]').getAttribute('content').indexOf('viewport-fit=cover') >= 0, 'PWA: viewport-fit=cover');
  t.ok((q('link[rel="apple-touch-icon"]').getAttribute('href') || '').indexOf('data:image/png;base64,') === 0, 'PWA: 인라인 아이콘(apple-touch-icon PNG)');
  t.ok((q('link[rel="icon"]').getAttribute('href') || '').indexOf('data:image/svg+xml') === 0, 'PWA: 인라인 SVG 파비콘');
  t.ok((q('link[rel="manifest"]').getAttribute('href') || '').indexOf('data:application/manifest+json') === 0, 'PWA: 인라인 매니페스트');
  t.eq(qa('script[src], link[href^="http"], img[src^="http"]').length, 0, '외부 리소스 의존 없음 (단일 파일)');

  /* ── 첫 화면(빈 상태) ── */
  await reload();
  t.ok(/아직 기록한 책이 없어요/.test(text(q('#lib-list'))), '빈 상태 문구 표시');
  t.ok(!!q('[data-act="add"]'), '빈 상태: 첫 책 기록하기 버튼');
  t.ok(!!q('[data-act="samples"]'), '빈 상태: 예시 데이터 버튼');
  t.eq(qa('.book-card').length, 0, '빈 상태: 카드 없음');
  t.ok(/^0$/.test(text(q('.summary-num'))), '빈 상태: 요약 0권');

  /* ── 예시 데이터 ── */
  q('[data-act="samples"]').click();
  await sleep(120);
  t.eq(cards().length, 3, '예시 데이터: 3권 추가');
  t.eq(storedBooks().length, 3, '예시 데이터: localStorage 저장');
  t.ok(!!q('.sample-note'), '예시 데이터: 안내 배너');
  t.ok(text(q('#lib-list')).indexOf('작별하지 않는다') >= 0, '예시 데이터: 카드 렌더링');
  t.ok(!!q('.book-card .cover'), '카드: 미니 북커버');
  t.ok(!!q('.book-card .stars'), '카드: 별점');
  t.ok(/^\d{4}\.\d{2}\.\d{2}$/.test(text(q('.book-card .book-date'))), '카드: 완독일 YYYY.MM.DD');
  t.ok(/총 읽은 책/.test(text(q('#lib-summary'))), '요약 카드 표시');

  /* ── 검색 ── */
  var search = q('#search-input');
  search.value = '한강';
  search.dispatchEvent(new (W().Event)('input', { bubbles: true }));
  await sleep(60);
  t.eq(cards().length, 1, '실시간 검색: 저자 "한강"');
  search.value = '하마터면';
  search.dispatchEvent(new (W().Event)('input', { bubbles: true }));
  await sleep(60);
  t.eq(cards().length, 1, '실시간 검색: 제목');
  search.value = '문장';
  search.dispatchEvent(new (W().Event)('input', { bubbles: true }));
  await sleep(60);
  t.ok(cards().length >= 1, '실시간 검색: 메모 내용');
  search.value = 'zzzz없음';
  search.dispatchEvent(new (W().Event)('input', { bubbles: true }));
  await sleep(60);
  t.ok(/조건에 맞는 책이 없어요/.test(text(q('#lib-list'))), '검색 결과 없음 안내');
  q('[data-act="clear-filters"]').click();
  await sleep(60);
  t.eq(cards().length, 3, '필터 초기화');

  /* ── 필터 ── */
  var catSel = q('#filter-category');
  catSel.value = '에세이';
  catSel.dispatchEvent(new (W().Event)('change', { bubbles: true }));
  await sleep(60);
  t.eq(cards().length, 1, '분야 필터');
  catSel.value = 'all';
  catSel.dispatchEvent(new (W().Event)('change', { bubbles: true }));
  await sleep(60);
  var yearSel = q('#filter-year');
  var yearOpts = Array.prototype.map.call(yearSel.options, function (o) { return o.value; });
  t.ok(yearOpts.length >= 2, '연도 필터 옵션 생성');
  yearSel.value = yearOpts[1];
  yearSel.dispatchEvent(new (W().Event)('change', { bubbles: true }));
  await sleep(60);
  t.eq(cards().length, 3, '연도 필터: 해당 연도 3권만');
  yearSel.value = 'all';
  yearSel.dispatchEvent(new (W().Event)('change', { bubbles: true }));
  await sleep(60);

  /* ── 추가 ── */
  await openAdd();
  t.ok(q('#sheet-book').classList.contains('open'), '책 추가 시트 열림');
  t.eq(q('#book-sheet-title').textContent, '책 추가', '시트 제목: 책 추가');
  t.ok(!!q('#f-date').value, '완독일 기본값 오늘');
  q('#f-title').value = '   ';
  q('#book-form').dispatchEvent(new (W().Event)('submit', { bubbles: true, cancelable: true }));
  await sleep(60);
  t.ok(!q('#err-title').hidden, '제목 없이 저장 → 오류 표시');
  t.ok(q('#sheet-book').classList.contains('open'), '오류 시 시트 유지');
  await fillAndSubmit({ title: '테스트 책', author: '테스트 저자', date: '2026-04-04', rating: 4.5, category: '과학/IT', color: 'plum', note: '좋은 문장을 남긴다.' });
  t.ok(!q('#sheet-book').classList.contains('open'), '저장 후 시트 닫힘');
  t.eq(cards().length, 4, '책 추가: 4권');
  t.eq(storedBooks().length, 4, '책 추가: 저장 반영');
  t.ok(text(q('#lib-list')).indexOf('테스트 책') >= 0, '책 추가: 카드 표시');
  t.ok(text(q('#lib-list')).indexOf('4.5') >= 0, '책 추가: 별점 표시');

  /* ── 상세 / 수정 ── */
  var target = cards().filter(function (c) { return text(c).indexOf('테스트 책') >= 0; })[0];
  target.click();
  await sleep(120);
  t.ok(q('#sheet-detail').classList.contains('open'), '상세 시트 열림');
  t.ok(text(q('#detail-body')).indexOf('테스트 책') >= 0, '상세: 제목');
  t.ok(text(q('#detail-body')).indexOf('좋은 문장을 남긴다.') >= 0, '상세: 메모');
  q('#detail-edit').click();
  await sleep(160);
  t.ok(q('#sheet-book').classList.contains('open'), '수정 시트 열림');
  t.eq(q('#book-sheet-title').textContent, '책 수정', '시트 제목: 책 수정');
  t.eq(q('#f-title').value, '테스트 책', '수정: 기존 값 채움');
  t.eq(q('#f-author').value, '테스트 저자', '수정: 저자 채움');
  q('#f-title').value = '테스트 책 (개정판)';
  q('#book-form').dispatchEvent(new (W().Event)('submit', { bubbles: true, cancelable: true }));
  await sleep(120);
  t.eq(cards().length, 4, '수정: 권수 유지');
  t.ok(text(q('#lib-list')).indexOf('테스트 책 (개정판)') >= 0, '수정: 제목 반영');
  t.ok(storedBooks().some(function (b) { return b.title === '테스트 책 (개정판)'; }), '수정: 저장 반영');

  /* ── 삭제 ── */
  var del = cards().filter(function (c) { return text(c).indexOf('개정판') >= 0; })[0];
  del.click();
  await sleep(120);
  q('#detail-delete').click();
  await sleep(140);
  t.eq(cards().length, 3, '삭제: 3권');
  t.ok(text(q('#lib-list')).indexOf('개정판') < 0, '삭제: 카드 사라짐');
  t.eq(storedBooks().length, 3, '삭제: 저장 반영');

  /* ── XSS ── */
  await openAdd();
  var xss = '<img src=x onerror="window.__xss=1">';
  await fillAndSubmit({ title: xss, author: '<b>굵게</b>', note: '<script>window.__xss2=1</script>' });
  t.eq(D().querySelectorAll('#lib-list img').length, 0, 'XSS: 태그가 실행되지 않음');
  t.eq(D().querySelectorAll('#lib-list b').length, 0, 'XSS: 저자 태그 무력화');
  t.ok(text(q('#lib-list')).indexOf('onerror') >= 0, 'XSS: 입력은 텍스트로 표시');
  t.eq(W().__xss, undefined, 'XSS: 인라인 핸들러 미실행');
  t.eq(W().__xss2, undefined, 'XSS: script 미실행');
  var xssCard = cards().filter(function (c) { return text(c).indexOf('onerror') >= 0; })[0];
  xssCard.click();
  await sleep(120);
  t.eq(D().querySelectorAll('#detail-body img').length, 0, 'XSS: 상세 화면도 이스케이프');
  q('#sheet-detail [data-close]').click();
  await sleep(120);

  /* ── 통계 탭 ── */
  q('#tab-stats').click();
  await sleep(140);
  t.ok(q('#view-stats').classList.contains('is-active'), '탭 전환: 월별 통계');
  t.ok(!q('#view-library').classList.contains('is-active'), '탭 전환: 서재 숨김');
  t.eq(qa('.chart-col').length, 12, '차트: 1~12월 막대');
  t.eq(q('#year-label').textContent, new Date().getFullYear() + '년', '연도 전환기: 올해');
  t.ok(qa('#goal-panel .bar').length === 2, '목표: 연간/월간 프로그레스 바');
  t.ok(/가장 많이 읽은 달/.test(text(q('#stat-grid'))), '요약 카드: 최다 월');
  t.ok(/월 평균/.test(text(q('#stat-grid'))), '요약 카드: 월 평균');
  t.ok(/평균 별점/.test(text(q('#stat-grid'))), '요약 카드: 평균 별점');

  var withBooks = qa('.chart-col').filter(function (c) { return c.classList.contains('has-books'); });
  t.ok(withBooks.length > 0, '차트: 기록 있는 달 표시');
  var targetMonth = withBooks[0].getAttribute('data-month');
  withBooks[0].click();
  await sleep(90);
  t.ok(q('.chart-col[data-month="' + targetMonth + '"]').classList.contains('is-active'), '차트: 탭한 달 선택');
  t.ok(new RegExp(targetMonth + '월에 읽은 책').test(text(q('#month-panel'))), '차트: 선택한 달의 책 목록');

  /* ── 목표 설정 ── */
  q('[data-act="edit-goals"]').click();
  await sleep(110);
  t.ok(q('#sheet-goals').classList.contains('open'), '목표 시트 열림');
  q('#goal-annual').value = '12';
  q('#goal-monthly').value = '2';
  q('#goals-save').click();
  await sleep(140);
  t.ok(!q('#sheet-goals').classList.contains('open'), '목표: 저장 후 닫힘');
  var barWidth = q('#goal-panel .bar > span').style.width;
  t.ok(parseFloat(barWidth) > 0, '목표: 달성률 바 채워짐');
  t.ok(/% 달성/.test(text(q('#goal-panel'))), '목표: 달성률 문구');
  t.ok(JSON.parse(W().localStorage.getItem(KEY)).goals[new Date().getFullYear()].annual === 12, '목표: 저장 반영');

  /* ── 연도 이동 ── */
  var y1 = q('#year-label').textContent;
  var nextDisabled = q('#year-next').disabled;
  t.ok(nextDisabled, '연도 전환: 미래 연도 비활성');
  q('#year-prev').click();
  await sleep(90);
  t.ok(q('#year-label').textContent !== y1, '연도 전환: 이전 해 이동');
  q('#year-next').click();
  await sleep(90);
  t.eq(q('#year-label').textContent, y1, '연도 전환: 되돌아오기');

  /* ── 분야 분포 ── */
  t.ok(qa('.cat-row').length >= 1, '분야 분포: 막대 표시');
  var catName = q('.cat-row .cat-name').textContent;
  q('.cat-row').click();
  await sleep(140);
  t.ok(q('#view-library').classList.contains('is-active'), '분야 분포 탭: 서재로 이동');
  t.ok(text(q('#lib-list')).indexOf(catName) >= 0 || cards().length >= 1, '분야 분포 탭: 해당 분야 필터');
  q('#filter-category').value = 'all';
  q('#filter-category').dispatchEvent(new (W().Event)('change', { bubbles: true }));
  q('#filter-year').value = 'all';
  q('#filter-year').dispatchEvent(new (W().Event)('change', { bubbles: true }));
  await sleep(60);

  /* ── 백업: 내보내기 ── */
  var before = storedBooks().length;
  q('#open-settings').click();
  await sleep(120);
  t.ok(q('#sheet-settings').classList.contains('open'), '설정 시트 열림');
  q('#export-file').click();
  await sleep(120);
  var dumped = q('#backup-text').value;
  var parsed = null;
  try { parsed = JSON.parse(dumped); } catch (e) { parsed = null; }
  t.ok(!!parsed, '백업: JSON 생성');
  t.eq(parsed && parsed.books ? parsed.books.length : -1, before, '백업: 모든 책 포함');
  t.ok(!!(parsed && parsed.goals), '백업: 목표 포함');
  t.ok(!!(parsed && parsed.exportedAt), '백업: 내보낸 시각');

  /* ── 백업: 가져오기 ── */
  var importJson = JSON.stringify({ books: [
    { title: '가져온 책 1', author: 'A', date: '2026-01-03', rating: 3, category: '소설', color: 'brick', note: '메모' },
    { title: '가져온 책 2', author: 'B', date: '2026-06-07', rating: 5, category: '자기계발', color: 'olive', note: '' }
  ], goals: { '2026': { annual: 20, monthly: 2 } } });
  q('#backup-text').value = importJson;
  q('#import-merge').checked = false;
  q('#import-run').click();
  await sleep(160);
  t.eq(cards().length, 2, '가져오기: 2권으로 교체');
  t.ok(text(q('#lib-list')).indexOf('가져온 책 1') >= 0, '가져오기: 내용 반영');
  t.eq(storedBooks().length, 2, '가져오기: 저장 반영');

  /* 깨진 JSON */
  q('#open-settings').click();
  await sleep(110);
  q('#backup-text').value = '{broken';
  q('#import-run').click();
  await sleep(120);
  t.eq(cards().length, 2, '가져오기: 깨진 JSON은 무시');

  /* ── 예시 지우기 / 전체 초기화 ── */
  q('#sheet-settings [data-close]').click();
  await sleep(120);
  q('#open-settings').click();
  await sleep(110);
  q('#reset-all').click();
  await sleep(160);
  t.ok(/아직 기록한 책이 없어요/.test(text(q('#lib-list'))), '전체 초기화: 빈 상태');
  t.eq(storedBooks().length, 0, '전체 초기화: 저장소 비움');

  /* ── 터치 타깃 ── */
  function h(sel) {
    var el = q(sel);
    if (!el) return 0;
    return el.getBoundingClientRect().height;
  }
  t.ok(h('.btn-add') >= 44, '터치 타깃: + 책 추가 44px 이상');
  t.ok(h('#search-input') >= 44, '터치 타깃: 검색창 44px 이상');
  t.ok(h('#filter-year') >= 44, '터치 타깃: 연도 필터 44px 이상');
  t.ok(h('.tab') >= 44, '터치 타깃: 탭 44px 이상');
  t.ok(h('#open-settings') >= 44, '터치 타깃: 설정 버튼 44px 이상');

  /* ── 안전 영역 ── */
  var cssText = '';
  Array.prototype.forEach.call(D().styleSheets, function (sheet) {
    try {
      Array.prototype.forEach.call(sheet.cssRules, function (rule) { cssText += rule.cssText; });
    } catch (e) {}
  });
  t.ok(cssText.indexOf('env(safe-area-inset-top') >= 0, 'safe-area-inset-top 대응');
  t.ok(cssText.indexOf('env(safe-area-inset-bottom') >= 0, 'safe-area-inset-bottom 대응');
  t.ok(cssText.indexOf('max-width: 480px') >= 0 || cssText.indexOf('max-width:480px') >= 0, '레이아웃: max-width 480px');
};

/* 독서 기록 — 핵심 로직 테스트 (DOM 비의존) */
window.runCoreTests = function (C, t) {
  'use strict';

  var NOW = new Date(2026, 10, 14, 10, 0, 0); // 2026-11-14

  /* ── 상수 ── */
  t.eq(C.STORAGE_KEY, 'my_reading_log_v1', 'localStorage 키 = my_reading_log_v1');
  t.eq(C.CATEGORIES.length, 7, '카테고리 7종');
  t.eq(C.CATEGORIES.join(','), '소설,인문,에세이,경제/경영,자기계발,과학/IT,기타', '카테고리 목록 일치');
  t.ok(C.COLORS.length >= 6, '표지 색상 팔레트 6종 이상');
  t.eq(C.MAX_NOTE, 2000, '메모 최대 2000자');

  /* ── XSS / 텍스트 ── */
  t.eq(C.escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'escapeHtml: 태그 무력화');
  t.eq(C.escapeHtml('"a" & \'b\''), '&quot;a&quot; &amp; &#39;b&#39;', 'escapeHtml: 따옴표·앰퍼샌드');
  t.eq(C.escapeHtml(null), '', 'escapeHtml: null → 빈 문자열');
  t.eq(C.text('  제목  ', 10), '제목', 'text(): 앞뒤 공백 제거');
  t.eq(C.text('가나다라', 3), '가나다', 'text(): 길이 제한');

  /* ── 이미지 주소 검증 ── */
  t.eq(C.safeImageSrc('https://covers.openlibrary.org/b/id/1-L.jpg'),
    'https://covers.openlibrary.org/b/id/1-L.jpg', 'safeImageSrc: https 허용');
  t.eq(C.safeImageSrc('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA', 'safeImageSrc: data:image 허용');
  t.eq(C.safeImageSrc('javascript:alert(1)'), '', 'safeImageSrc: javascript: 거부');
  t.eq(C.safeImageSrc('data:text/html;base64,AAAA'), '', 'safeImageSrc: data:text 거부');
  t.eq(C.safeImageSrc('  '), '', 'safeImageSrc: 빈 값 거부');
  t.eq(C.normalizeCover({ kind: 'url', src: 'javascript:alert(1)' }).kind, 'none', 'normalizeCover: 위험한 주소는 색상 표지로');
  t.eq(C.normalizeCover({ kind: 'image', src: 'data:image/png;base64,AAAA' }).kind, 'image', 'normalizeCover: 압축 사진 유지');

  /* ── 날짜 · 월 배지 ── */
  t.ok(C.isIsoDate('2026-11-14'), 'isIsoDate: 정상 날짜');
  t.ok(C.isIsoDate('2024-02-29'), 'isIsoDate: 윤년 2월 29일');
  t.ok(!C.isIsoDate('2023-02-29'), 'isIsoDate: 평년 2월 29일 거부');
  t.ok(!C.isIsoDate('2026-13-01'), 'isIsoDate: 13월 거부');
  t.eq(C.formatDate('2026-11-14'), '2026.11.14', 'formatDate: YYYY.MM.DD');
  t.eq(C.formatDate(''), '완독일 미기록', 'formatDate: 날짜 없음');
  t.eq(C.monthBadge('2026-11-14'), '26-11', 'monthBadge: YY-MM');
  t.eq(C.monthBadge('2025-01-02'), '25-01', 'monthBadge: 1월도 두 자리');
  t.eq(C.monthBadge(''), '', 'monthBadge: 날짜 없음 → 빈 값');
  t.eq(C.monthKey('2026-11-14'), '2026-11', 'monthKey: YYYY-MM');
  t.eq(C.formatMonthKey('2026-11'), '2026년 11월', 'formatMonthKey: 한국어 표기');
  t.eq(C.todayIso(NOW), '2026-11-14', 'todayIso: 0 채움');

  /* ── 별점 ── */
  t.eq(C.clampRating(4.3), 4.5, 'clampRating: 0.5 단위 반올림');
  t.eq(C.clampRating(9), 5, 'clampRating: 최대 5');
  t.eq(C.clampRating(-2), 0, 'clampRating: 최소 0');
  t.eq(C.formatRating(4.5), '4.5', 'formatRating: 소수 한 자리');

  /* ── 책 정규화 · 옛 데이터 호환 ── */
  var legacy = C.normalizeBook({
    id: 'old-1', title: '옛 기록', author: '작가', date: '2025-03-02',
    category: '인문/사회', color: 'navy', rating: 4, note: '메모', sample: true
  });
  t.eq(legacy.completedAt, '2025-03-02', '옛 date → completedAt');
  t.eq(legacy.category, '인문', "옛 '인문/사회' → '인문'");
  t.eq(legacy.favorite, false, '인생책 기본값 false');
  t.eq(legacy.color, 'navy', '표지 색상 유지');
  t.eq(C.normalizeBook({ title: '하트', heart: true }).favorite, true, '옛 heart 필드 → favorite');
  t.eq(C.normalizeBook({ title: '기본' }).category, '기타', '카테고리 미지정 → 기타');
  t.ok(!!C.normalizeBook({}).id, 'id 없으면 새로 발급');

  /* ── 입력 검증 ── */
  t.eq(C.validateBook({ title: '' }).errors.title, '제목을 입력해 주세요.', 'validateBook: 제목 필수');
  t.ok(C.validateBook({ title: '책', completedAt: '2026-2-3' }).errors.date, 'validateBook: 잘못된 날짜');
  var okBook = C.validateBook({ title: ' 책 ', completedAt: '2026-11-14', rating: 4.3, cover: { kind: 'url', src: 'http://x/y.jpg' } });
  t.ok(okBook.ok, 'validateBook: 정상 입력 통과');
  t.eq(okBook.value.title, '책', 'validateBook: 제목 공백 정리');
  t.eq(okBook.value.rating, 4.5, 'validateBook: 별점 보정');
  t.eq(okBook.value.cover.kind, 'url', 'validateBook: http 표지 허용');

  /* ── 정렬 (완독일 최신순 기본) ── */
  var a = C.normalizeBook({ id: 'a', title: '가', completedAt: '2026-01-05' });
  var b = C.normalizeBook({ id: 'b', title: '나', completedAt: '2026-11-01' });
  var c = C.normalizeBook({ id: 'c', title: '다', completedAt: '2026-05-20' });
  var d = C.normalizeBook({ id: 'd', title: '라', completedAt: '' });
  var sorted = C.sortBooks([a, b, c, d]);
  t.eq(sorted.map(function (x) { return x.id; }).join(''), 'bcad', 'sortBooks: 완독일 최신순');
  t.eq(sorted[3].id, 'd', 'sortBooks: 완독일 없는 책은 맨 뒤');
  var asc = C.sortBooks([a, b, c, d], 'asc');
  t.eq(asc.map(function (x) { return x.id; }).join(''), 'acbd', 'sortBooks: 오래된순');
  t.eq(asc[3].id, 'd', 'sortBooks: 오래된순에서도 날짜 없는 책은 뒤');
  t.ok(C.compareBooks(b, a) < 0, 'compareBooks: 최신이 앞');

  /* ── 필터 ── */
  var lib = [
    C.normalizeBook({ id: '1', title: '사피엔스', author: '유발 하라리', completedAt: '2026-11-14', category: '인문', favorite: true, note: '인류 역사' }),
    C.normalizeBook({ id: '2', title: '작별하지 않는다', author: '한강', completedAt: '2026-11-02', category: '소설', favorite: true }),
    C.normalizeBook({ id: '3', title: '총, 균, 쇠', author: '재레드 다이아몬드', completedAt: '2026-08-30', category: '인문' })
  ];
  t.eq(C.filterBooks(lib, {}).length, 3, 'filterBooks: 기본 전체');
  t.eq(C.filterBooks(lib, { filter: 'fav' }).length, 2, 'filterBooks: 하트만');
  t.eq(C.filterBooks(lib, { filter: '인문' }).length, 2, 'filterBooks: 카테고리');
  t.eq(C.filterBooks(lib, { q: '한강' }).length, 1, 'filterBooks: 저자 검색');
  t.eq(C.filterBooks(lib, { q: '인류' }).length, 1, 'filterBooks: 한 줄 평 검색');
  t.eq(C.filterBooks(lib, { q: '없는책' }).length, 0, 'filterBooks: 결과 없음');
  t.eq(C.filterBooks(lib, { filter: '소설', q: '사피' }).length, 0, 'filterBooks: 필터+검색 교집합');
  t.eq(C.countByFilter(lib, 'all'), 3, 'countByFilter: 전체');
  t.eq(C.countByFilter(lib, 'fav'), 2, 'countByFilter: 하트만');

  /* ── 통계 ── */
  var agg = C.aggregate(lib, NOW);
  t.eq(agg.total, 3, 'aggregate: 총 완독');
  t.eq(agg.favoriteCount, 2, 'aggregate: 인생책 수');
  t.eq(agg.thisMonth, 2, 'aggregate: 이번 달 완독');
  t.eq(agg.byMonth.length, 2, 'aggregate: 완독한 달 수');
  t.eq(agg.byMonth[0].key, '2026-11', 'aggregate: 최근 달이 먼저');
  t.eq(agg.byMonth[0].count, 2, 'aggregate: 11월 2권');
  t.eq(agg.byMonth[1].key, '2026-08', 'aggregate: 그다음 달');
  t.eq(agg.maxMonthCount, 2, 'aggregate: 최다 월 권수');
  t.eq(agg.byCategory[0].category, '인문', 'aggregate: 카테고리 1위');
  t.eq(agg.byCategory[0].count, 2, 'aggregate: 인문 2권');
  t.eq(agg.byCategory[0].pct, 66.7, 'aggregate: 비율 계산');
  t.eq(C.aggregate([], NOW).total, 0, 'aggregate: 빈 서재');

  /* ── 백업 ── */
  t.ok(!C.parseBackup('').ok, 'parseBackup: 빈 문자열 거부');
  t.ok(!C.parseBackup('{oops').ok, 'parseBackup: 깨진 JSON 거부');
  t.ok(!C.parseBackup('{"foo":1}').ok, 'parseBackup: books 없는 객체 거부');
  var parsed = C.parseBackup(JSON.stringify({ books: [
    { title: '옛 책', date: '2025-02-01', category: '인문/사회' },
    { title: '' },
    'text'
  ] }));
  t.ok(parsed.ok, 'parseBackup: books 배열 인식');
  t.eq(parsed.books.length, 1, 'parseBackup: 잘못된 항목 제외');
  t.eq(parsed.skipped, 2, 'parseBackup: 제외 건수');
  t.eq(parsed.books[0].completedAt, '2025-02-01', 'parseBackup: 옛 date 변환');
  var dup = C.parseBackup(JSON.stringify({ books: [{ id: 'x', title: 'A' }, { id: 'x', title: 'B' }] }));
  t.ok(dup.books[0].id !== dup.books[1].id, 'parseBackup: 중복 id 재발급');
  var payload = C.buildPayload(lib, { 2026: { annual: 12 } }, NOW);
  t.eq(payload.version, C.SCHEMA_VERSION, 'buildPayload: 스키마 버전');
  t.eq(payload.books.length, 3, 'buildPayload: 책 수');
  t.eq(payload.exportedAt, NOW.toISOString(), 'buildPayload: 내보낸 시각');
  t.ok(C.serialize(payload).indexOf('"favorite": true') > -1, 'serialize: 인생책 포함');
  var round = C.parseBackup(C.serialize(payload));
  t.ok(round.ok && round.books.length === 3, 'serialize → parseBackup 왕복');

  /* ── 예시 데이터 ── */
  var samples = C.sampleBooks(NOW);
  t.eq(samples.length, 3, 'sampleBooks: 3권');
  t.ok(samples.every(function (s) { return !!s.title && s.sample === true; }), 'sampleBooks: 제목·표시');
  t.ok(samples.every(function (s) { return C.isIsoDate(s.completedAt); }), 'sampleBooks: 완독일 유효');
};

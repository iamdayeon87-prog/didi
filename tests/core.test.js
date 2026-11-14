/* 나의 서재 — 핵심 로직 테스트 (DOM 비의존) */
window.runCoreTests = function (C, t) {
  'use strict';

  /* ── 상수 ── */
  t.eq(C.STORAGE_KEY, 'my_reading_log_v1', 'localStorage 키 = my_reading_log_v1');
  t.eq(C.CATEGORIES.length, 7, '분야 7종');
  t.eq(C.CATEGORIES.join(','), '소설,에세이,인문/사회,경제/경영,자기계발,과학/IT,기타', '분야 목록 일치');
  t.ok(C.COLORS.length >= 6, '표지 색상 팔레트 6종 이상');

  /* ── XSS 이스케이프 ── */
  t.eq(C.escapeHtml('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;', 'escapeHtml: 태그 무력화');
  t.eq(C.escapeHtml('"a" & \'b\''), '&quot;a&quot; &amp; &#39;b&#39;', 'escapeHtml: 따옴표·앰퍼샌드');
  t.eq(C.escapeHtml(null), '', 'escapeHtml: null → 빈 문자열');
  t.eq(C.text('  제목  ', 10), '제목', 'text(): 앞뒤 공백 제거');
  t.eq(C.text('가나다라', 3), '가나', 'text(): 길이 제한');

  /* ── 날짜 ── */
  t.ok(C.isIsoDate('2026-11-14'), 'isIsoDate: 정상 날짜');
  t.ok(C.isIsoDate('2024-02-29'), 'isIsoDate: 윤년 2월 29일');
  t.ok(!C.isIsoDate('2023-02-29'), 'isIsoDate: 평년 2월 29일 거부');
  t.ok(!C.isIsoDate('2026-13-01'), 'isIsoDate: 13월 거부');
  t.ok(!C.isIsoDate('2026-1-1'), 'isIsoDate: 자릿수 부족 거부');
  t.ok(!C.isIsoDate(''), 'isIsoDate: 빈 값 거부');
  t.eq(C.formatDate('2026-11-14'), '2026.11.14', 'formatDate: YYYY.MM.DD');
  t.eq(C.formatDate(''), '완독일 미기록', 'formatDate: 날짜 없음');
  t.eq(C.yearOf('2026-11-14'), 2026, 'yearOf');
  t.eq(C.monthOf('2026-11-14'), 11, 'monthOf');
  t.eq(C.todayIso(new Date(2026, 0, 5)), '2026-01-05', 'todayIso: 0 채움');

  /* ── 별점 ── */
  t.eq(C.clampRating(3.7), 3.5, 'clampRating: 0.5 단위 반올림');
  t.eq(C.clampRating(4.8), 5, 'clampRating: 최대 5');
  t.eq(C.clampRating(-2), 0, 'clampRating: 최소 0');
  t.eq(C.clampRating('abc'), 0, 'clampRating: 숫자 아님 → 0');
  t.eq(C.formatRating(4), '4.0', 'formatRating: 한 자리 소수');

  /* ── 유효성 검사 ── */
  var v1 = C.validateBook({ title: '   ' });
  t.ok(!v1.ok, 'validateBook: 빈 제목 거부');
  t.ok(!!v1.errors.title, 'validateBook: 제목 오류 메시지');

  var v2 = C.validateBook({ title: '  채식주의자 ', author: ' 한강 ', date: '2026-01-02', rating: 4.5, category: '소설', color: 'forest', note: '  좋다 ' });
  t.ok(v2.ok, 'validateBook: 정상 입력 통과');
  t.eq(v2.value.title, '채식주의자', 'validateBook: 제목 trim');
  t.eq(v2.value.author, '한강', 'validateBook: 저자 trim');
  t.eq(v2.value.rating, 4.5, 'validateBook: 별점 유지');
  t.eq(v2.value.note, '좋다', 'validateBook: 메모 trim');

  var v3 = C.validateBook({ title: '책', date: '2026-02-30' });
  t.ok(!v3.ok && !!v3.errors.date, 'validateBook: 잘못된 완독일 거부');

  var v4 = C.validateBook({ title: '책', category: '없는분야', color: '없는색' });
  t.ok(v4.ok, 'validateBook: 알 수 없는 분야/색이어도 통과');
  t.eq(v4.value.category, '기타', 'validateBook: 알 수 없는 분야 → 기타');
  t.eq(v4.value.color, C.DEFAULT_COLOR, 'validateBook: 알 수 없는 색 → 기본색');

  /* ── 정규화 ── */
  var n1 = C.normalizeBook({ title: 'A', rating: 9 });
  t.eq(n1.rating, 5, 'normalizeBook: 별점 상한');
  t.ok(/^b/.test(n1.id), 'normalizeBook: id 자동 생성');
  t.ok(typeof C.normalizeBook({ title: 'B' }).id === 'string', 'normalizeBook: id는 항상 존재');
  t.eq(C.normalizeBook({ title: 'B' }).sample, false, 'normalizeBook: sample 기본 false');
  t.eq(C.normalizeBook({ title: 'B', date: 'x' }).date, '', 'normalizeBook: 잘못된 날짜는 빈 값');

  /* ── 필터/검색 ── */
  var books = [
    { id: '1', title: '한강 소설', author: '한강', date: '2026-02-01', category: '소설', color: 'forest', rating: 4.5, note: '이별 이야기' },
    { id: '2', title: '경제 책', author: '홍길동', date: '2025-12-31', category: '경제/경영', color: 'navy', rating: 3, note: '' },
    { id: '3', title: '메모 책', author: '', date: '', category: '기타', color: 'stone', rating: 0, note: '좋은 문장' }
  ];

  t.eq(C.filterBooks(books, {}).length, 3, 'filterBooks: 조건 없음 → 전체');
  t.eq(C.filterBooks(books, { q: '한강' }).map(function (b) { return b.id; }).join(','), '1', 'filterBooks: 제목/저자 검색');
  t.eq(C.filterBooks(books, { q: '이별' }).length, 1, 'filterBooks: 메모 검색');
  t.eq(C.filterBooks(books, { q: '한강 이별' }).length, 1, 'filterBooks: 다중 키워드 AND');
  t.eq(C.filterBooks(books, { q: '없는말' }).length, 0, 'filterBooks: 결과 없음');
  t.eq(C.filterBooks(books, { year: 2026 }).length, 1, 'filterBooks: 연도 필터');
  t.eq(C.filterBooks(books, { year: '2025' }).length, 1, 'filterBooks: 연도 필터(문자열)');
  t.eq(C.filterBooks(books, { year: 'all' }).length, 3, 'filterBooks: 전체 연도');
  t.eq(C.filterBooks(books, { category: '소설' }).length, 1, 'filterBooks: 분야 필터');
  t.eq(C.filterBooks(books, { q: '소설' }).length, 1, 'filterBooks: 분야명 검색');
  t.eq(C.filterBooks(books, {}).map(function (b) { return b.id; }).join(','), '1,2,3', 'filterBooks: 완독일 내림차순, 날짜 없음은 마지막');
  t.eq(C.filterBooks(books, { year: 2026, category: '소설', q: '한강' }).length, 1, 'filterBooks: 복합 조건');

  /* ── 집계 ── */
  var aggBooks = [
    { id: 'a', title: 'A', date: '2026-01-05', category: '소설', rating: 5 },
    { id: 'b', title: 'B', date: '2026-01-20', category: '소설', rating: 4 },
    { id: 'c', title: 'C', date: '2026-03-02', category: '에세이', rating: 0 },
    { id: 'd', title: 'D', date: '2025-03-02', category: '소설', rating: 3 }
  ];
  var agg = C.aggregate(aggBooks, 2026);
  t.eq(agg.total, 3, 'aggregate: 연도 총 권수');
  t.eq(agg.byMonth.length, 12, 'aggregate: 12개월');
  t.eq(agg.byMonth[0].count, 2, 'aggregate: 1월 2권');
  t.eq(agg.byMonth[1].count, 0, 'aggregate: 2월 0권');
  t.eq(agg.byMonth[2].count, 1, 'aggregate: 3월 1권');
  t.eq(agg.byMonth[0].books.length, 2, 'aggregate: 월별 책 목록');
  t.eq(agg.avgRating, 4.5, 'aggregate: 평균 별점(별점 있는 책만)');
  t.eq(agg.ratedCount, 2, 'aggregate: 별점 있는 책 수');
  t.eq(agg.monthlyAvg, 0.3, 'aggregate: 월 평균(총권/12)');
  t.eq(agg.activeMonths, 2, 'aggregate: 기록 있는 달 수');
  t.eq(agg.bestMonth, 1, 'aggregate: 최다 월');
  t.eq(agg.bestMonthCount, 2, 'aggregate: 최다 월 권수');
  t.eq(agg.byCategory[0].category, '소설', 'aggregate: 분야 정렬');
  t.eq(agg.byCategory[0].count, 2, 'aggregate: 분야 권수');
  t.eq(agg.byCategory[0].pct, 66.7, 'aggregate: 분야 비율');
  t.eq(agg.byCategory[1].pct, 33.3, 'aggregate: 분야 비율2');
  var aggEmpty = C.aggregate([], 2026);
  t.eq(aggEmpty.total, 0, 'aggregate: 빈 해 총 0');
  t.eq(aggEmpty.avgRating, 0, 'aggregate: 빈 해 평균 별점 0');
  t.eq(aggEmpty.bestMonth, 0, 'aggregate: 빈 해 최다 월 없음');

  t.eq(C.availableYears(aggBooks).join(','), '2026,2025', 'availableYears: 내림차순');
  t.eq(C.availableYears([]).length, 0, 'availableYears: 빈 목록');

  /* ── 목표 달성률 ── */
  var p = C.progress(5, 10);
  t.eq(p.pct, 50, 'progress');
  t.eq(p.barPct, 50, 'progress: 바 %');
  t.eq(p.remaining, 5, 'progress: 남은 권수');
  var p2 = C.progress(15, 10);
  t.eq(p2.pct, 150, 'progress: 100% 초과 표시');
  t.eq(p2.barPct, 100, 'progress: 바는 100%에서 멈춤');
  t.eq(p2.remaining, 0, 'progress: 남은 권수 0');
  var p3 = C.progress(3, 0);
  t.ok(!p3.hasGoal, 'progress: 목표 미설정');
  t.eq(p3.pct, 0, 'progress: 목표 없으면 0%');
  t.eq(C.normalizeGoals({ '2026': { annual: '24', monthly: 2 }, 'bad': { annual: 3 } })['2026'].annual, 24, 'normalizeGoals: 문자열 숫자 변환');
  t.eq(Object.keys(C.normalizeGoals({ bad: { annual: 3 } })).length, 0, 'normalizeGoals: 잘못된 연도 제외');

  /* ── 백업 파싱 ── */
  var bad1 = C.parseBackup('');
  t.ok(!bad1.ok, 'parseBackup: 빈 문자열 거부');
  var bad2 = C.parseBackup('{not json');
  t.ok(!bad2.ok && bad2.error.indexOf('JSON') >= 0, 'parseBackup: 깨진 JSON 거부');
  var bad3 = C.parseBackup('{"foo":1}');
  t.ok(!bad3.ok, 'parseBackup: books 없는 객체 거부');

  var ok1 = C.parseBackup('{"books":[{"title":"A"},{"title":"B"}]}');
  t.ok(ok1.ok && ok1.books.length === 2, 'parseBackup: 객체 형식');
  var ok2 = C.parseBackup('[{"title":"A"}, {"title":"B"}]');
  t.ok(ok2.ok && ok2.books.length === 2, 'parseBackup: 배열 형식');
  var skip = C.parseBackup('{"books":[{"title":"A"}, {"nope":1}, "x", null, {"title":"  "}]}');
  t.eq(skip.books.length, 1, 'parseBackup: 제목 없는 항목 제외');
  t.eq(skip.skipped, 4, 'parseBackup: 제외 건수');
  var dup = C.parseBackup('{"books":[{"id":"same","title":"A"},{"id":"same","title":"B"}]}');
  t.ok(dup.books[0].id !== dup.books[1].id, 'parseBackup: 중복 id 재발급');
  var g = C.parseBackup('{"books":[{"title":"A"}],"goals":{"2026":{"annual":24,"monthly":2}}}');
  t.eq(g.goals['2026'].annual, 24, 'parseBackup: 목표 복원');

  /* ── 직렬화 왕복 ── */
  var payload = C.buildPayload(aggBooks, { '2026': { annual: 10, monthly: 1 } });
  var round = C.parseBackup(C.serialize(payload));
  t.ok(round.ok, '직렬화 → 파싱 성공');
  t.eq(round.books.length, 4, '직렬화 왕복: 권수 유지');
  t.eq(round.books[0].title, 'A', '직렬화 왕복: 내용 유지');
  t.eq(round.goals['2026'].annual, 10, '직렬화 왕복: 목표 유지');
  t.ok(C.serialize(payload).indexOf('\n  ') > 0, '직렬화: 읽기 좋은 JSON');

  /* ── 표지 색상 ── */
  t.eq(C.shadeHex('#FFFFFF', -0.5), '#808080', 'shadeHex: 어둡게');
  t.eq(C.shadeHex('#000000', 0.5), '#808080', 'shadeHex: 밝게');
  t.ok(C.coverStyle('forest').indexOf('linear-gradient') >= 0, 'coverStyle: 그라데이션');
  t.ok(C.coverStyle('forest').indexOf('#2D5A43') >= 0, 'coverStyle: 포레스트 그린');
  t.eq(C.colorLabel('forest'), '포레스트', 'colorLabel');

  /* ── 예시 데이터 ── */
  var samples = C.sampleBooks(new Date(2026, 10, 14));
  t.eq(samples.length, 3, 'sampleBooks: 3권');
  t.ok(samples.every(function (b) { return b.title && C.isIsoDate(b.date) && b.rating > 0 && b.sample; }), 'sampleBooks: 필수 필드 채움');
  t.ok(samples.every(function (b) { return C.yearOf(b.date) === 2026; }), 'sampleBooks: 올해 날짜');
  t.ok(samples.every(function (b) { return C.isCategory(b.category); }), 'sampleBooks: 3권 모두 분야 지정');

  /* ── 정렬 ── */
  var sorted = C.sortBooks([
    { title: 'B', date: '2026-01-01' },
    { title: 'A', date: '2026-05-01' },
    { title: 'C', date: '' }
  ]);
  t.eq(sorted.map(function (b) { return b.title; }).join(''), 'ABC', 'sortBooks: 날짜 내림차순 + 날짜 없음 마지막');
};

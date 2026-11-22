/* 집들이 초대장 공통 설정 — build.py가 채웁니다. 손으로 고쳐도 돼요. */
window.INVITE = {
  hosts: {{HOSTS}},
  sign: {{SIGN}},
  dates: {{DATES}},             // 후보 날짜 초기값. 이후엔 호스트 모드에서 바꾸면 시트에 저장돼요.
  confirmedDate: '',            // 날짜 확정되면 '2027-03-13' 처럼 넣기 → 투표가 닫히고 확정 날짜로 표시
  start: '18:00', end: '22:00',
  voteDeadline: '',             // 비워두면 마감 없음
  /* ── 오시는 길: 고정 ── */
  complex: '동탄2신도시호반베르디움22단지',
  road: '경기도 화성시 동탄순환대로20길 104',
  unit: '2202동 404호',
  mapQuery: '동탄2신도시호반베르디움22단지',
  parking: '방문차량 등록 필수, 지하주차장 자유롭게 주차',
  menu: '배달음식',
  photos: { hero: '', gallery: [] },
  /* Google Apps Script 웹앱 주소. 비어 있으면 '미리보기 모드'(각자 폰에만 저장) */
  endpoint: {{ENDPOINT}},
};

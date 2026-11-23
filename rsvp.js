/* 참석/투표 데이터 레이어: Apps Script 웹앱(구글 시트) 또는 미리보기용 localStorage */
(function () {
  const C = window.INVITE;
  const W = ['일', '월', '화', '수', '목', '금', '토'];
  const LS = 'mingjja-rsvp-preview';
  const local = {
    get() { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; } },
    set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} },
  };
  const norm = s => String(s || '').replace(/\s+/g, '');
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  /* 시트에서 이상한 날짜 값이 와도 화면에 NaN이 뜨지 않게 올바른 'yyyy-mm-dd'만 남긴다 */
  const clean = rows => (rows || []).map(x => ({ ...x,
    dates: x.attend === 'no' ? [] : [...new Set((x.dates || []).map(String).filter(d => DATE_RE.test(d)))] }));
  /* 내가 등록한 이름의 '수정 열쇠'. 처음 등록한 폰에만 저장돼서 남이 같은 이름으로 덮어쓰지 못한다 */
  const TK = 'mingjja-tokens';
  const tokens = { get() { try { return JSON.parse(localStorage.getItem(TK)) || {}; } catch { return {}; } },
                   set(n, t) { try { const m = tokens.get(); m[n] = t; localStorage.setItem(TK, JSON.stringify(m)); } catch {} } };
  /* 맨 앞이 = + - @ 탭 줄바꿈이면 스프레드시트가 수식으로 실행할 수 있어서 막는다 */
  const canApply = v => typeof v !== 'string' || !/^[=+\-@\t\r]/.test(v.trim());
  const LSS = 'mingjja-settings-preview';
  let settings = {};
  const dates = () => { const s = (settings.dates || []).filter(d => DATE_RE.test(d)); return s.length ? s : C.dates; };
  const take = j => { if (j && j.settings && typeof j.settings === 'object') settings = j.settings; };

  async function list() {
    if (!C.endpoint) { try { settings = JSON.parse(localStorage.getItem(LSS)) || {}; } catch { settings = {}; } return clean(local.get()); }
    const r = await fetch(C.endpoint + '?action=list&t=' + Date.now());
    const j = await r.json();
    take(j);
    return clean(j.rows);
  }
  async function submit(entry) {
    entry = { ...entry, name: String(entry.name).trim(), ts: new Date().toISOString() };
    if (!C.endpoint) {
      const rows = local.get().filter(r => norm(r.name) !== norm(entry.name));
      rows.push(entry); local.set(rows); return rows;
    }
    entry.token = tokens.get()[norm(entry.name)] || '';
    const r = await fetch(C.endpoint, { method: 'POST', body: JSON.stringify({ action: 'upsert', entry, key: hostKey() || undefined }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'save failed');
    if (j.token) tokens.set(norm(entry.name), j.token);
    take(j);
    return clean(j.rows);
  }

  const HK = 'mingjja-host';
  const hostKey = () => { try { return sessionStorage.getItem(HK) || ''; } catch { return ''; } };
  const setHostKey = k => { try { k ? sessionStorage.setItem(HK, k) : sessionStorage.removeItem(HK); } catch {} };
  async function remove(name) {
    if (!C.endpoint) { const rows = local.get().filter(r => norm(r.name) !== norm(name)); local.set(rows); return rows; }
    const r = await fetch(C.endpoint, { method: 'POST', body: JSON.stringify({ action: 'delete', name, key: hostKey() }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'delete failed');
    take(j);
    return clean(j.rows);
  }
  async function saveDates(list) {
    const clean = [...new Set(list.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
    if (!C.endpoint) { settings = { ...settings, dates: clean }; try { localStorage.setItem(LSS, JSON.stringify(settings)); } catch {} return clean; }
    const r = await fetch(C.endpoint, { method: 'POST', body: JSON.stringify({ action: 'settings', key: hostKey(), settings: { dates: clean } }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'settings failed');
    if (!j.settings) throw new Error('old-script');
    take(j);
    return dates();
  }

  const closed = () => !!settings.closed;
  async function setClosed(v) {
    if (!C.endpoint) { settings = { ...settings, closed: !!v }; try { localStorage.setItem(LSS, JSON.stringify(settings)); } catch {} return; }
    const r = await fetch(C.endpoint, { method: 'POST', body: JSON.stringify({ action: 'close', key: hostKey(), closed: !!v }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'close failed');
    take(j);
  }
  /* 시트가 돌려준 거절 사유를 사람이 읽을 문장으로 */
  const why = code => ({
    rate: '지금 등록이 몰려서 잠깐 막혔어요. 1분 뒤에 다시 눌러주세요',
    busy: '지금 등록이 몰려서 잠깐 막혔어요. 1분 뒤에 다시 눌러주세요',
    closed: '지금은 등록을 잠시 닫아뒀어요. 조금 뒤에 다시 열게요',
    full: '등록 인원이 가득 찼어요. 호스트에게 연락해 주세요',
    key: '호스트 비밀번호가 틀려요',
    'name-format': '이름은 한글·영문·숫자로 10자까지 적어주세요',
    dates: '되는 날을 하나 이상 골라주세요',
    car: '차량번호 형식이 아니에요 (예: 12가 3456)',
    owner: '이미 다른 사람이 등록한 이름이에요. 본인이면 처음 등록한 폰에서 고쳐주세요',
  })[code];

  function tally(rows) {
    const going = rows.filter(r => r.attend !== 'no');
    const n = going.length;
    const counts = Object.fromEntries(dates().map(d => [d, 0]));
    going.forEach(r => (r.dates || []).forEach(d => { if (d in counts) counts[d]++; }));
    let best = null;
    dates().forEach(d => { if (!best || counts[d] > counts[best]) best = d; });
    const majority = best && n > 0 && counts[best] > n / 2 ? best : null;
    return { n, counts, best, majority, people: n };
  }

  const dObj = s => new Date(s + 'T00:00:00');
  const fmt = {
    md: s => { const d = dObj(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; },
    mdw: s => { const d = dObj(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${W[d.getDay()]})`; },
    time: t => { const [h, m] = t.split(':').map(Number); return (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + '시' + (m ? ` ${m}분` : ''); },
    car: s => { s = String(s || '').replace(/\s+/g, ''); return s.length > 4 ? '•'.repeat(Math.min(3, s.length - 4)) + s.slice(-4) : s; },
  };
  const voteOpen = () => !C.confirmedDate && (!C.voteDeadline || new Date() < new Date(C.voteDeadline + 'T23:59:59'));

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.RSVP = { list, submit, remove, canApply, closed, setClosed, why, saveDates, dates, hostKey, setHostKey, tally, fmt, voteOpen, copy, esc, preview: !C.endpoint,
    address: () => `${C.road} ${C.unit} (${C.complex})`,
    maps: () => ({ kakao: 'https://map.kakao.com/link/search/' + encodeURIComponent(C.mapQuery), naver: 'https://map.naver.com/p/search/' + encodeURIComponent(C.mapQuery) }),
  };
})();

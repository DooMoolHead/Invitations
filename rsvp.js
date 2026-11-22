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

  async function list() {
    if (!C.endpoint) return local.get();
    const r = await fetch(C.endpoint + '?action=list&t=' + Date.now());
    const j = await r.json();
    return j.rows || [];
  }
  async function submit(entry) {
    entry = { ...entry, name: String(entry.name).trim(), ts: new Date().toISOString() };
    if (!C.endpoint) {
      const rows = local.get().filter(r => norm(r.name) !== norm(entry.name));
      rows.push(entry); local.set(rows); return rows;
    }
    const r = await fetch(C.endpoint, { method: 'POST', body: JSON.stringify({ action: 'upsert', entry }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'save failed');
    return j.rows;
  }

  const HK = 'mingjja-host';
  const hostKey = () => { try { return sessionStorage.getItem(HK) || ''; } catch { return ''; } };
  const setHostKey = k => { try { k ? sessionStorage.setItem(HK, k) : sessionStorage.removeItem(HK); } catch {} };
  async function remove(name) {
    if (!C.endpoint) { const rows = local.get().filter(r => norm(r.name) !== norm(name)); local.set(rows); return rows; }
    const r = await fetch(C.endpoint, { method: 'POST', body: JSON.stringify({ action: 'delete', name, key: hostKey() }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'delete failed');
    return j.rows;
  }

  function tally(rows) {
    const going = rows.filter(r => r.attend !== 'no');
    const n = going.length;
    const counts = Object.fromEntries(C.dates.map(d => [d, 0]));
    going.forEach(r => (r.dates || []).forEach(d => { if (d in counts) counts[d]++; }));
    let best = null;
    C.dates.forEach(d => { if (!best || counts[d] > counts[best]) best = d; });
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

  window.RSVP = { list, submit, remove, hostKey, setHostKey, tally, fmt, voteOpen, copy, esc, preview: !C.endpoint,
    address: () => `${C.road} ${C.unit} (${C.complex})`,
    maps: () => ({ kakao: 'https://map.kakao.com/link/search/' + encodeURIComponent(C.mapQuery), naver: 'https://map.naver.com/p/search/' + encodeURIComponent(C.mapQuery) }),
  };
})();

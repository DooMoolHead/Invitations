/* 참석 폼 + 투표 현황 + 참석자 명단. 디자인은 각 초안의 CSS가 .rv-* 클래스로 입힙니다. */
(function () {
  const C = window.INVITE, R = window.RSVP, esc = R.esc;
  let rows = [];
  const openDates = new Set();
  const openPeople = new Set();

  const chipsHTML = (checked = []) => R.dates().map(d => `<label><input type="checkbox" name="dates" value="${d}"${checked.includes(d) ? ' checked' : ''}><span>${R.fmt.mdw(d)}</span></label>`).join('');
  const deLi = d => `<li><input type="date" value="${d}" aria-label="후보 날짜"><button type="button" class="rv-de-del">삭제</button><button type="button" class="rv-de-handle" aria-label="순서 이동 (꾹 눌러 위아래로 끌기)">↕</button></li>`;
  const editorHTML = () => `
      <div class="rv-de">
        <p class="rv-sub">후보 날짜 관리 <span class="rv-sub-hint">↕를 꾹 눌러 끌면 순서가 바뀌어요</span></p>
        <ul class="rv-de-list">${R.dates().map(d => `${deLi(d)}`).join('')}</ul>
        <div class="rv-de-row"><input type="date" class="rv-de-new" aria-label="추가할 날짜"><button type="button" class="rv-de-add">추가</button></div>
        <button type="button" class="rv-de-save">날짜 저장</button>
        <p class="rv-de-msg" role="status"></p>
      </div>`;
  let editing = false;

  function formHTML(L) {
    const open = R.voteOpen();
    return `
    <form class="rv-form" novalidate>
      <label class="rv-field"><span class="rv-label">${L.name}</span>
        <input name="name" maxlength="20" autocomplete="name" placeholder="이름" required></label>
      <div class="rv-field"><span class="rv-label">${L.attend}</span>
        <div class="rv-seg">
          <label><input type="radio" name="attend" value="yes" checked><span>갈게요</span></label>
          <label><input type="radio" name="attend" value="no"><span>이번엔 못 가요</span></label>
        </div></div>
      <div class="rv-field rv-when"><span class="rv-label">${open ? L.dates : '날짜'}</span>
        ${open ? `<p class="rv-hint">되는 날을 <b>전부</b> 골라주세요. 가장 많이 되는 날로 정할게요.</p>
        <div class="rv-chips">${chipsHTML()}</div>`
        : `<p class="rv-hint">${C.confirmedDate ? R.fmt.mdw(C.confirmedDate) + '로 확정됐어요' : '투표가 마감됐어요'}</p>`}
      </div>
      <div class="rv-field rv-yes"><span class="rv-label">${L.car}</span>
        <div class="rv-seg">
          <label><input type="radio" name="hasCar" value="0" checked><span>대중교통·택시</span></label>
          <label><input type="radio" name="hasCar" value="1"><span>자차 이동</span></label>
          <label><input type="radio" name="hasCar" value="2"><span>친구 차로 같이</span></label>
        </div>
        <input class="rv-car" name="car" maxlength="12" placeholder="차량번호 (예: 12가 3456)" hidden>
        <input class="rv-car rv-ride" name="ride" maxlength="20" placeholder="누구 차 타고 와요? (선택)" hidden></div>
      <label class="rv-field"><span class="rv-label">${L.message}</span>
        <input name="message" maxlength="60" placeholder="선택 · 먹고 싶은 배달 메뉴도 환영"></label>
      <p class="rv-err" role="alert"></p>
      <button class="rv-submit" type="submit">${L.submit}</button>
      ${R.preview ? '<p class="rv-preview">미리보기 모드: 지금은 이 폰에만 저장돼요</p>' : ''}
    </form>`;
  }

  function resultsHTML(L) {
    const t = R.tally(rows);
    const open = R.voteOpen();
    const max = Math.max(1, ...Object.values(t.counts));
    const going0 = rows.filter(r => r.attend !== 'no');
    const voters = d => going0.filter(r => (r.dates || []).includes(d));
    const bars = C.confirmedDate ? '' : `
      <p class="rv-title">투표 현황 <span>날짜를 누르면 누가 골랐는지 보여요</span></p>
      <div class="rv-bars">${R.dates().map(d => {
        const vs = voters(d), on = openDates.has(d);
        return `
        <div class="rv-row ${on ? 'is-open' : ''}">
          <button type="button" class="rv-bar ${d === t.majority ? 'is-major' : ''} ${d === t.best && t.counts[d] ? 'is-best' : ''}" data-date="${d}" aria-expanded="${on}">
            <span class="rv-bar-l">${R.fmt.mdw(d)}</span>
            <span class="rv-bar-t"><i style="width:${(t.counts[d] / max) * 100}%"></i></span>
            <span class="rv-bar-n">${t.counts[d]}</span>
          </button>
          <div class="rv-voters" ${on ? '' : 'hidden'}>${vs.length ? vs.map(r => `<span>${esc(r.name)}</span>`).join('') : '<em>아직 아무도 안 골랐어요</em>'}</div>
        </div>`; }).join('')}
      </div>
      <p class="rv-sum">${t.n ? `${t.n}명 응답 · ${t.majority ? `<b>${R.fmt.md(t.majority)}</b>이 과반이에요` : '아직 과반인 날이 없어요'}` : '아직 아무도 안 냈어요. 1등 해주세요'}${open && C.voteDeadline ? ` · ${R.fmt.md(C.voteDeadline)} 마감` : ''}${R.preview ? '' : ` · <span class="rv-live">실시간</span>`}</p>`;
    const going = rows.filter(r => r.attend !== 'no');
    const cars = going.filter(r => r.car);
    const no = rows.filter(r => r.attend === 'no');
    const host = R.hostKey();
    const card = r => {
      const k = esc(r.name), on = openPeople.has(r.name);
      return `<li class="rv-person ${on ? 'is-open' : ''}">
        <button type="button" class="rv-person-h" data-person="${k}" aria-expanded="${on}">
          <b>${k}</b>${r.attend === 'no' ? '' : `<span class="rv-tr">${transportShort(r)}</span>`}${r.message ? `<em>${esc(r.message)}</em>` : ''}
        </button>
        <div class="rv-person-d" ${on ? '' : 'hidden'}>
          <dl>
            <dt>되는 날</dt><dd>${(r.dates || []).length ? [...r.dates].filter(d => R.dates().includes(d)).sort().map(d => `(${R.fmt.md(d)})`).join(', ') || '—' : '—'}</dd>
            ${r.attend === 'no' ? '' : `<dt>이동</dt><dd>${transportLong(r)}</dd>`}
            <dt>한마디</dt><dd>${r.message ? esc(r.message) : '—'}</dd>
          </dl>
          ${host ? `<div class="rv-admin"><button type="button" class="rv-edit" data-person="${k}">수정</button><button type="button" class="rv-del" data-person="${k}">삭제</button></div>` : ''}
        </div>
      </li>`;
    };
    return `${R.closed() ? '<p class="rv-err rv-closed">지금은 등록을 잠시 닫아뒀어요. 조금 뒤에 다시 열게요.</p>' : ''}${bars}
      <div class="rv-people">
        <p class="rv-sub">${L.going} <b>${t.people}</b>명 <span class="rv-sub-hint">이름을 누르면 자세히 보여요</span></p>
        <ul class="rv-list">${going.map(card).join('') || '<li class="rv-empty">아직 없어요</li>'}</ul>
        ${cars.length ? `<p class="rv-sub">방문차량 등록 <b>${cars.length}</b>대</p>
        <ul class="rv-cars">${cars.map(r => `<li><span>${esc(r.name)}</span><code>${esc(r.car)}</code></li>`).join('')}</ul>` : ''}
        ${no.length ? `<p class="rv-sub">아쉽지만 다음에 <b>${no.length}</b>명</p><ul class="rv-list">${no.map(card).join('')}</ul>` : ''}
        ${host ? editorHTML() : ''}
        <p class="rv-host">${host ? `<button type="button" class="rv-lock">${R.closed() ? '등록 다시 열기' : '등록 잠시 닫기'}</button> · 호스트 모드 켜짐 · <button type="button" class="rv-host-off">끄기</button>` : `<button type="button" class="rv-host-on">호스트</button>`}</p>
        <form class="rv-host-form" hidden><input name="key" type="password" autocomplete="off" placeholder="호스트 비밀번호" aria-label="호스트 비밀번호"><button type="submit">확인</button></form>
      </div>`;
  }

  const trKind = r => (['transit', 'car', 'ride'].includes(r.transport) ? r.transport : (r.car ? 'car' : 'transit'));
  const transportShort = r => ({ transit: '대중교통', car: '자차', ride: '친구 차' })[trKind(r)];
  const transportLong = r => {
    const k = trKind(r);
    if (k === 'car') return `자차 · ${esc(r.car || '번호 미입력')}`;
    if (k === 'ride') return `친구 차로 같이${r.ride ? ` (${esc(r.ride)} 차)` : ''}`;
    return '대중교통·택시';
  };

  window.RSVPUI = {
    async mount({ form, results, labels = {}, onChange }) {
      const L = Object.assign({ name: '이름', attend: '참석', dates: '되는 날', count: '인원', car: '오는 방법', message: '한마디', submit: '보내기', going: '오는 사람' }, labels);
      form.innerHTML = formHTML(L);
      const f = form.querySelector('form');
      const render = () => { results.innerHTML = resultsHTML(L); onChange && onChange(R.tally(rows), rows); };
      const sync = () => {
        const yes = f.elements.attend.value === 'yes';
        f.querySelectorAll('.rv-yes, .rv-when').forEach(el => el.hidden = !yes);
        f.elements.car.hidden = f.elements.hasCar.value !== '1';
        f.elements.ride.hidden = f.elements.hasCar.value !== '2';
      };
      f.addEventListener('change', sync);
      f.addEventListener('input', e => { const x = e.target.nextElementSibling; if (x && x.classList.contains('rv-ferr')) x.remove(); });
      f.addEventListener('change', e => { if (e.target.name === 'dates') { const x = f.querySelector('.rv-chips + .rv-ferr'); if (x) x.remove(); } });
      f.addEventListener('input', () => { const b = f.querySelector('.rv-submit'); if (b.classList.contains('is-done')) { b.classList.remove('is-done'); b.textContent = L.submit; } });
      const fill = mine => {
        f.elements.name.value = mine.name;
        f.elements.attend.value = mine.attend;
        f.querySelectorAll('[name=dates]').forEach(c => c.checked = (mine.dates || []).includes(c.value));
        const k = trKind(mine);
        f.elements.hasCar.value = k === 'car' ? '1' : k === 'ride' ? '2' : '0';
        f.elements.car.value = mine.car || ''; f.elements.ride.value = mine.ride || ''; f.elements.message.value = mine.message || '';
        sync();
      };
      f.elements.name.addEventListener('change', () => {
        const mine = rows.find(r => r.name.replace(/\s+/g, '') === f.elements.name.value.replace(/\s+/g, ''));
        if (mine) fill(mine);
      });
      f.onsubmit = async e => {
        e.preventDefault();
        const err = f.querySelector('.rv-err'); err.textContent = '';
        f.querySelectorAll('.rv-ferr').forEach(x => x.remove());
        /* 문제가 있는 칸 바로 밑에 안내를 띄우고, 그 칸으로 화면을 옮긴다 */
        const fieldErr = (el, msg, focus = true) => {
          el.insertAdjacentHTML('afterend', `<p class="rv-err rv-ferr" role="alert">${msg}</p>`);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (focus && el.focus) el.focus({ preventScroll: true });
        };
        const yes = f.elements.attend.value === 'yes';
        const dates = [...f.querySelectorAll('[name=dates]:checked')].map(c => c.value);
        if (!f.elements.name.value.trim()) { fieldErr(f.elements.name, '이름을 적어주세요'); return; }
        if (!/^[가-힣a-zA-Z0-9 ]{1,10}$/.test(f.elements.name.value.trim())) { fieldErr(f.elements.name, '이름은 한글·영문·숫자로 10자까지 적어주세요'); return; }
        const bad = ['name', 'car', 'ride', 'message'].find(k => f.elements[k] && !f.elements[k].hidden && !R.canApply(f.elements[k].value));
        if (bad) { fieldErr(f.elements[bad], '맨 앞에 = + - @ 기호는 쓸 수 없어요'); return; }
        if (yes && R.voteOpen() && !dates.length) { fieldErr(f.querySelector('.rv-chips'), '되는 날을 하나 이상 골라주세요', false); return; }
        if (yes && f.elements.hasCar.value === '1' && !/^\d{2,3}\s?[가-힣]\s?\d{4}$/.test(f.elements.car.value.trim())) { fieldErr(f.elements.car, '차량번호 형식이 아니에요 (예: 12가 3456)'); return; }
        const btn = f.querySelector('.rv-submit'); btn.disabled = true; const label = btn.textContent; btn.textContent = '등록 중…';
        try {
          rows = await R.submit({ name: f.elements.name.value, attend: f.elements.attend.value, dates: yes ? dates : [], count: yes ? 1 : 0,
            car: yes && f.elements.hasCar.value === '1' ? f.elements.car.value.trim() : '',
            transport: yes ? ['transit', 'car', 'ride'][Number(f.elements.hasCar.value)] : '',
            ride: yes && f.elements.hasCar.value === '2' ? f.elements.ride.value.trim() : '', message: f.elements.message.value.trim() });
          render(); btn.textContent = '등록완료!'; btn.classList.add('is-done');
          results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (er) {
          btn.textContent = label;
          const at = { 'name-format': f.elements.name, owner: f.elements.name, car: f.elements.car, dates: f.querySelector('.rv-chips') }[er.message];
          if (at) fieldErr(at, R.why(er.message), er.message !== 'dates');
          else err.textContent = R.why(er.message) || '저장이 안 됐어요. 잠시 후 다시 눌러주세요';
        }
        btn.disabled = false;
      };
      sync();
      results.innerHTML = '<p class="rv-hint">불러오는 중…</p>';
      results.addEventListener('click', async e => {
        const p = e.target.closest('.rv-person-h');
        if (p) {
          const n = p.dataset.person; openPeople.has(n) ? openPeople.delete(n) : openPeople.add(n);
          const li = p.parentElement, on = openPeople.has(n);
          li.classList.toggle('is-open', on); p.setAttribute('aria-expanded', on); li.querySelector('.rv-person-d').hidden = !on;
          return;
        }
        const ed = e.target.closest('.rv-edit');
        if (ed) { const r = rows.find(x => x.name === ed.dataset.person); if (r) { fill(r); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); f.querySelector('.rv-submit').textContent = `${r.name} 응답 수정하기`; } return; }
        const del = e.target.closest('.rv-del');
        if (del) {
          if (!del.classList.contains('is-armed')) { del.classList.add('is-armed'); del.textContent = '한 번 더 누르면 삭제'; return; }
          del.disabled = true; del.textContent = '삭제 중…';
          try { rows = await R.remove(del.dataset.person); openPeople.delete(del.dataset.person); render(); }
          catch (er) { del.disabled = false; del.classList.remove('is-armed'); del.textContent = er.message === 'key' ? '비밀번호가 틀려요' : er.message === 'rate' ? '잠깐 막혔어요, 1분 뒤에' : '삭제 실패, 다시 눌러주세요'; }
          return;
        }
        if (e.target.closest('.rv-de-del')) { e.target.closest('li').remove(); editing = true; return; }
        if (e.target.closest('.rv-de-add')) {
          const inp = results.querySelector('.rv-de-new'); if (!inp.value) { inp.focus(); return; }
          results.querySelector('.rv-de-list').insertAdjacentHTML('beforeend', deLi(inp.value));
          inp.value = ''; editing = true; return;
        }
        const sv = e.target.closest('.rv-de-save');
        if (sv) {
          const list = [...results.querySelectorAll('.rv-de-list input')].map(i => i.value).filter(Boolean);
          const msg = results.querySelector('.rv-de-msg');
          if (!list.length) { msg.textContent = '날짜가 하나는 있어야 해요'; return; }
          sv.disabled = true; sv.textContent = '저장 중…';
          try {
            await R.saveDates(list); editing = false;
            const checked = [...f.querySelectorAll('[name=dates]:checked')].map(c => c.value);
            const chips = f.querySelector('.rv-chips'); if (chips) chips.innerHTML = chipsHTML(checked);
            render(); document.dispatchEvent(new CustomEvent('rsvp:dates'));
            const m2 = results.querySelector('.rv-de-msg'); if (m2) m2.textContent = '저장했어요. 모두에게 바로 반영돼요.';
          } catch (er) {
            sv.disabled = false; sv.textContent = '날짜 저장';
            msg.textContent = R.why(er.message) && er.message !== 'closed' ? R.why(er.message) : er.message === 'old-script' || er.message === 'name' ? 'Apps Script를 새 버전으로 다시 배포해야 저장돼요' : '저장이 안 됐어요. 다시 눌러주세요';
          }
          return;
        }
        if (e.target.closest('.rv-host-on')) { const hf = results.querySelector('.rv-host-form'); hf.hidden = false; hf.elements.key.focus(); return; }
        if (e.target.closest('.rv-host-off')) { R.setHostKey(''); render(); return; }
        const lk = e.target.closest('.rv-lock');
        if (lk) {
          lk.disabled = true; lk.textContent = '바꾸는 중…';
          try { await R.setClosed(!R.closed()); render(); }
          catch (er) { lk.disabled = false; lk.textContent = R.why(er.message) || '실패, 다시 눌러주세요'; }
          return;
        }
        const b = e.target.closest('.rv-bar[data-date]'); if (!b) return;
        const d = b.dataset.date; openDates.has(d) ? openDates.delete(d) : openDates.add(d);
        const row = b.parentElement, on = openDates.has(d);
        row.classList.toggle('is-open', on); b.setAttribute('aria-expanded', on); row.querySelector('.rv-voters').hidden = !on;
      });
      results.addEventListener('input', e => { if (e.target.closest('.rv-de')) editing = true; });
      results.addEventListener('pointerdown', e => {
        const h = e.target.closest('.rv-de-handle'); if (!h) return;
        e.preventDefault();
        const li = h.closest('li'), list = li.parentElement;
        li.classList.add('is-drag'); editing = true;
        const move = ev => {
          const sibs = [...list.children].filter(x => x !== li);
          const after = sibs.find(s => { const r = s.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
          if (after) { if (li.nextElementSibling !== after) list.insertBefore(li, after); } else if (list.lastElementChild !== li) list.appendChild(li);
        };
        const up = () => { li.classList.remove('is-drag'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
      });
      results.addEventListener('keydown', e => {
        const h = e.target.closest('.rv-de-handle'); if (!h || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); const li = h.closest('li');
        if (e.key === 'ArrowUp' && li.previousElementSibling) li.parentElement.insertBefore(li, li.previousElementSibling);
        if (e.key === 'ArrowDown' && li.nextElementSibling) li.parentElement.insertBefore(li.nextElementSibling, li);
        h.focus(); editing = true;
      });
      results.addEventListener('submit', e => {
        if (!e.target.matches('.rv-host-form')) return;
        e.preventDefault(); const k = e.target.elements.key.value.trim(); if (!k) return;
        R.setHostKey(k); render();
      });
      let loadErr = false;
      try { rows = await R.list(); } catch { rows = []; loadErr = true; }
      { const chips = f.querySelector('.rv-chips'); if (chips) chips.innerHTML = chipsHTML([...f.querySelectorAll('[name=dates]:checked')].map(c => c.value)); }
      document.dispatchEvent(new CustomEvent('rsvp:dates'));
      render();
      if (loadErr) results.insertAdjacentHTML('afterbegin', '<p class="rv-err">응답 목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>');
      if (!R.preview) {
        const refresh = async () => {
          if (document.hidden) return;
          if (editing) return;
          try {
            const before = R.dates().join(); const next = await R.list();
            if (before !== R.dates().join()) { const chips = f.querySelector('.rv-chips'); if (chips) chips.innerHTML = chipsHTML([...f.querySelectorAll('[name=dates]:checked')].map(c => c.value)); document.dispatchEvent(new CustomEvent('rsvp:dates')); rows = next; render(); }
            else if (JSON.stringify(next) !== JSON.stringify(rows)) { rows = next; render(); }
          } catch {}
        };
        setInterval(refresh, 15000);
        document.addEventListener('visibilitychange', refresh);
      }
    },
  };
})();

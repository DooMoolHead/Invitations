/* 사진 탭하면 크게 보기. 같은 묶음 안에서 좌우로 넘김(스와이프·화살표). */
(function () {
  const css = `
  .lb{position:fixed; inset:0; z-index:50; background:rgba(10,10,10,.94); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity .2s; touch-action:pan-y}
  .lb.on{opacity:1; pointer-events:auto}
  .lb img{max-width:100vw; max-height:86vh; object-fit:contain; user-select:none; -webkit-user-drag:none}
  .lb button{position:absolute; background:none; border:0; color:#fff; font:400 30px/1 system-ui,sans-serif; width:52px; height:52px; cursor:pointer; opacity:.85}
  .lb .x{top:max(10px,env(safe-area-inset-top)); right:8px}
  .lb .p{left:2px; top:50%; transform:translateY(-50%)} .lb .n{right:2px; top:50%; transform:translateY(-50%)}
  .lb .c{position:absolute; bottom:max(18px,env(safe-area-inset-bottom)); left:0; right:0; text-align:center; color:#ddd; font:13px/1.4 system-ui,sans-serif}
  img.zoomable{cursor:zoom-in}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  const lb = document.createElement('div');
  lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', '사진 크게 보기');
  lb.innerHTML = '<img alt=""><button class="x" aria-label="닫기">×</button><button class="p" aria-label="이전">‹</button><button class="n" aria-label="다음">›</button><p class="c"></p>';
  document.body.appendChild(lb);
  const big = lb.querySelector('img'), cap = lb.querySelector('.c');
  let group = [], i = 0;
  const show = () => {
    big.src = group[i].src; big.alt = group[i].alt;
    cap.textContent = group.length > 1 ? `${i + 1} / ${group.length}` : '';
    lb.querySelector('.p').hidden = lb.querySelector('.n').hidden = group.length < 2;
  };
  const go = d => { i = (i + d + group.length) % group.length; show(); };
  const close = () => { lb.classList.remove('on'); document.body.style.overflow = ''; };
  document.addEventListener('click', e => {
    const img = e.target.closest('img.zoomable'); if (!img) return;
    const box = img.closest('[data-group]') || img.parentElement;
    group = [...box.querySelectorAll('img.zoomable')]; i = group.indexOf(img);
    show(); lb.classList.add('on'); document.body.style.overflow = 'hidden';
  });
  lb.addEventListener('click', e => {
    if (e.target.closest('.p')) return go(-1);
    if (e.target.closest('.n')) return go(1);
    if (e.target !== big || e.target.closest('.x')) close();
  });
  big.addEventListener('click', close);
  addEventListener('keydown', e => { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  let x0 = null;
  lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40 && group.length > 1) { e.preventDefault(); go(dx < 0 ? 1 : -1); } });
  document.querySelectorAll('.su img').forEach(im => im.classList.add('zoomable'));
})();

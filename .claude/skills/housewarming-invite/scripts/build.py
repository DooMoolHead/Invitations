#!/usr/bin/env python3
"""집들이 초대장 빌더.

사용법:
    python3 build.py invite.json OUT_DIR

invite.json 형식은 ../SKILL.md 와 ../examples/mingjja.json 을 보세요.
OUT_DIR 에는 그대로 GitHub Pages 에 올릴 수 있는 사이트가 만들어집니다.
호스트 비밀번호가 들어간 Apps Script 코드는 공개되면 안 되므로
OUT_DIR 밖(OUT_DIR.apps-script.gs)에 따로 저장합니다.
"""
import html
import json
import os
import shutil
import sys
import time

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(HERE, '..', 'template')

DEFAULT_LETTER = [
    '드디어 우리 집이 생겼어요.',
    '아직 짐 정리는 덜 됐지만,',
    '제일 먼저 보여주고 싶은 사람들을 불러요.',
    '요리는 잘 하는데 귀찮으니까 배달로 거하게 쏠게요.',
]
DEFAULT_LABEL = '짜릿한 추억을 위한 세 가지 약속'

# 모자이크 세기: 블록 한 변 = 사진 가로폭 × 이 비율
STRENGTH = {'light': 0.009, 'medium': 0.018, 'strong': 0.024, 'heavy': 0.045}


def esc(s):
    return html.escape(str(s), quote=True)


def load(path, base):
    p = path if os.path.isabs(path) else os.path.join(base, path)
    return ImageOps.exif_transpose(Image.open(p)).convert('RGB')


def mosaic(im, box, strength):
    """box: [x0, y0, x1, y1] 사진 크기 대비 비율(0~1)."""
    w, h = im.size
    b = (int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h))
    bs = max(4, int(w * STRENGTH.get(strength, STRENGTH['strong'])))
    r = im.crop(b)
    small = r.resize((max(1, r.width // bs), max(1, r.height // bs)), Image.BILINEAR)
    im.paste(small.resize(r.size, Image.NEAREST), b[:2])


def build_photo(ph, base, out_dir, name):
    im = load(ph['src'], base)
    for m in ph.get('mosaic', []):
        mosaic(im, m['box'], m.get('strength', 'strong'))
    im.thumbnail((900, 1200))
    im.save(os.path.join(out_dir, 'photos', name), quality=82, optimize=True)
    ratio = ph.get('ratio') or round(im.width / im.height, 3)
    style = f'--r:{ratio}'
    if ph.get('ratio'):
        style += f"; object-position:{ph.get('position', '50% 50%')}"
    return f'<img style="{style}" src="photos/{name}" alt="{esc(ph.get("alt", "사진"))}" loading="lazy">'


def build_og(og, base, out_dir):
    im = load(og['src'], base)
    w, h = im.size
    cw = min(w, int(w * og.get('width', 0.8)))
    ch = int(cw * 630 / 1200)
    cx = int(og.get('center_x', 0.5) * w)
    x0 = min(max(0, cx - cw // 2), w - cw)
    y0 = min(max(0, int(og.get('top_y', 0.3) * h)), h - ch)
    im.crop((x0, y0, x0 + cw, y0 + ch)).resize((1200, 630), Image.LANCZOS).save(
        os.path.join(out_dir, 'og.jpg'), quality=85, optimize=True)


def main():
    cfg_path, out_dir = sys.argv[1], sys.argv[2]
    base = os.path.dirname(os.path.abspath(cfg_path))
    c = json.load(open(cfg_path, encoding='utf-8'))
    os.makedirs(os.path.join(out_dir, 'photos'), exist_ok=True)

    hosts = c['hosts']
    sign = c.get('sign') or f"- {'&'.join(hosts)} -"
    site = c.get('site_url', '').rstrip('/') + '/'

    items = []
    for i, p in enumerate(c['promises'], 1):
        imgs = ''.join(build_photo(ph, base, out_dir, f'p{i}-{j}.jpg')
                       for j, ph in enumerate(p.get('photos', []), 1))
        fig = f'<figure data-group class="su mem"><div>{imgs}</div></figure>' if imgs else ''
        items.append(f'    <li><span class="no">No!</span><b>{esc(p["title"])}</b>'
                     f'<span>{esc(p.get("subtitle", ""))}</span>{fig}</li>')

    letter = c.get('letter_lines') or DEFAULT_LETTER
    letter_html = '<br>\n'.join('    ' + esc(x) for x in letter)

    page = open(os.path.join(TPL, 'index.html'), encoding='utf-8').read()
    fills = {
        'TITLE': esc(c['title']),
        'SUBTITLE_HTML': c.get('subtitle_html', ''),   # <em>강조</em>, <br> 허용
        'OG_DESC': esc(c.get('og_description') or f"{' & '.join(hosts)}가 이사했어요. 되는 날 골라주세요!"),
        'SITE_URL': site,
        'YEAR': str(c.get('year') or c['dates'][0][:4]),
        'PROMISES_LABEL': esc(c.get('promises_label', DEFAULT_LABEL)),
        'PROMISES_HTML': '\n'.join(items),
        'LETTER_HTML': letter_html,
        'VERSION': str(int(time.time())),
    }
    for k, v in fills.items():
        page = page.replace('{{' + k + '}}', v)
    open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(page)

    conf = open(os.path.join(TPL, 'config.js'), encoding='utf-8').read()
    for k, v in {'HOSTS': hosts, 'SIGN': sign, 'DATES': sorted(c['dates']),
                 'ENDPOINT': c.get('endpoint', '')}.items():
        conf = conf.replace('{{' + k + '}}', json.dumps(v, ensure_ascii=False))
    open(os.path.join(out_dir, 'config.js'), 'w', encoding='utf-8').write(conf)

    for f in ('rsvp.js', 'form.js', 'lightbox.js'):
        shutil.copy(os.path.join(TPL, f), out_dir)
    open(os.path.join(out_dir, '.nojekyll'), 'w').close()

    if c.get('og_image'):
        build_og(c['og_image'], base, out_dir)

    gs = open(os.path.join(TPL, 'apps-script.gs'), encoding='utf-8').read()
    pw = str(c.get('host_password') or '')
    if not pw:
        print('경고: host_password 가 비어 있어요. 호스트 모드(삭제·날짜 관리)를 쓰려면 invite.json 에 넣고 다시 빌드하세요.')
    else:
        gs = gs.replace("'여기에-비밀번호'", json.dumps(pw).replace('"', "'"))
    secret = os.path.abspath(out_dir).rstrip('/') + '.apps-script.gs'
    open(secret, 'w', encoding='utf-8').write(gs)

    print('site  :', os.path.abspath(out_dir))
    print('script:', secret, '(비공개 — 저장소에 올리지 말 것)')


if __name__ == '__main__':
    main()

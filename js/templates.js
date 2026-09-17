/* =============================================================================
   templates.js — de vijf Pure Minds post-templates, getekend op HTML5 Canvas
   -----------------------------------------------------------------------------
   Alles wordt getekend in een vast ontwerpraster van 1080 px breed. Exporteren
   op een andere breedte (1200 voor LinkedIn, 2160 voor hoge resolutie) schaalt
   alleen de context, dus maatvoering en verhoudingen blijven exact gelijk.

   Vaste regels voor álle templates (zie GRID en frame()):
     - marge van 88 px rondom
     - cyaan balk van 12 px bovenaan, zoals op elk artboard in het brandbook
     - label linksboven: zeshoek-bullet + Open Sans Bold in hoofdletters
     - logo rechtsonder in een inkt-zeshoek, in elk template op dezelfde plek
     - voetregel links (pureminds.nl of de swipe-indicator), verticaal
       gecentreerd op het logo
     - koppen Open Sans ExtraBold met -2% tracking, tekst Open Sans Regular
     - de zeshoek-duo (foto of vlak + verschoven cyaan lijn) als vormelement

   Kleuren en typografie komen uit PureMinds-Brandbook-v1.svg en het
   designsysteem van de interne tools (SEO-contentGap-Analyzer/styles.css).
   ============================================================================= */
(function (global) {
  'use strict';

  const COLORS = {
    cyan: '#1ab9e2',     // Pure Cyaan: accenten, vlakken, lijnen
    tint: '#e8f7fc',
    soft: '#f2fbfe',
    blue: '#1b71a8',
    deep: '#005aaf',
    magenta: '#b61b50',  // Pure Magenta: alleen de hoofdactie
    green: '#009670',
    ink: '#303030',      // Inkt: tekst en donkere vlakken
    muted: '#5c6670',
    line: '#e1e7ec',
    canvas: '#edf3f7',
    hexline: '#90a4b4',  // lijnkleur van het zeshoekpatroon
    navy: '#10283c',     // donkere ondertoon voor verlopen over foto's
  };

  const FONT_FAMILY = '"PM Open Sans", "Open Sans", Arial, sans-serif';
  const CAP = 0.714;   // cap-hoogte van Open Sans als fractie van de korpsgrootte
  const DESC = 0.24;   // ruimte onder de laatste basislijn
  const SQRT3 = Math.sqrt(3);

  const FORMATS = {
    square: { w: 1080, h: 1080, ratio: '1:1', label: 'vierkant' },
    portrait: { w: 1080, h: 1350, ratio: '4:5', label: 'portret' },
    story: { w: 1080, h: 1920, ratio: '9:16', label: 'story' },
  };

  const GRID = {
    margin: 88,
    bar: 12,
    logoW: 112,
    logoH: 112 * 1109 / 962,  // verhouding van PureMinds-zeshoek-logo.png
    labelSize: 24,
    labelTrack: 0.12,
    labelGap: 72,             // van label tot inhoud
    footerGap: 56,            // van inhoud tot logo-rij
    footerSize: 24,
    storySafe: 250,           // boven en onder in een story zit de Instagram-interface
  };

  // Typografische stijlen, gedeeld door alle templates
  const TYPE = {
    title: { size: 80, weight: 800, emWeight: 800, track: -0.02, lh: 1.1 },
    body: { size: 34, weight: 400, emWeight: 700, track: 0, lh: 1.45 },
  };
  const TITLE_MIN = 44;
  const BODY_MIN = 24;

  // Alle posts zijn donker: inkt of foto, met witte tekst en cyaan nadruk
  const PAL = {
    text: '#ffffff', body: 'rgba(255,255,255,.88)', soft: 'rgba(255,255,255,.72)',
    label: '#ffffff', bullet: COLORS.cyan, em: COLORS.cyan,
    pattern: '#ffffff', patternAlpha: 0.08, dot: 'rgba(255,255,255,.45)', domain: '#ffffff',
  };

  const TEMPLATE_META = [
    { id: 'photo', name: 'Standaard foto', sub: 'strak en simpel' },
    { id: 'overlay', name: 'Foto met tekst', sub: 'tekst op beeld' },
    { id: 'blog', name: 'Pure blog post', sub: 'nieuwe blog + cta' },
    { id: 'case', name: 'Pure case post', sub: 'klant en resultaat' },
    { id: 'carousel', name: 'Info carousel', sub: 'swipe-post in slides' },
  ];

  // Wordt per render gezet zodra een tekst niet in zijn vak past
  let overflow = false;

  /* ---------------------------------------------------------------------------
     Raster
     ------------------------------------------------------------------------- */

  function frame(format) {
    const f = FORMATS[format] || FORMATS.square;
    const m = GRID.margin;
    const story = f.h / f.w > 1.5;
    const v = story ? GRID.storySafe : m;  // verticale marge
    const logo = { x: f.w - m - GRID.logoW, y: f.h - v - GRID.logoH, w: GRID.logoW, h: GRID.logoH };
    return {
      w: f.w,
      h: f.h,
      m,
      v,
      logo,
      story,
      portrait: f.h > f.w,
      labelTop: v,
      contentTop: v + GRID.labelSize * CAP + GRID.labelGap,
      contentBottom: logo.y - GRID.footerGap,
      contentW: f.w - 2 * m,
      footerY: logo.y + logo.h / 2,
    };
  }

  /* ---------------------------------------------------------------------------
     Basis: kleur, font, zeshoek
     ------------------------------------------------------------------------- */

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function setFont(ctx, weight, size, track = 0) {
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(size * track).toFixed(2)}px`;
  }

  // Puntige zeshoek (punt boven), net als het logo; r = straal tot de hoekpunten
  function addHex(ctx, cx, cy, r) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    addHex(ctx, cx, cy, r);
  }

  /**
   * Lijnpatroon van zeshoeken, zoals op de cover van het brandbook en de
   * achtergrond van de interne tools. Eén pad, één stroke: gedeelde randen
   * worden dus niet dubbel zo donker. Het verloop laat het patroon vervagen.
   */
  function hexPattern(ctx, fr, o) {
    const r = o.r || 90;
    const colW = SQRT3 * r;
    const rowH = 1.5 * r;
    ctx.save();
    ctx.beginPath();
    for (let row = -1; row * rowH < fr.h + r; row++) {
      const y = row * rowH;
      const shift = row % 2 !== 0 ? colW / 2 : 0;
      for (let x = -colW + shift; x < fr.w + colW; x += colW) addHex(ctx, x, y, r);
    }
    const g = ctx.createLinearGradient(o.x0, o.y0, o.x1, o.y1);
    g.addColorStop(0, rgba(o.color, o.alpha));
    g.addColorStop(1, rgba(o.color, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = o.lineWidth || 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Inkt met een zachte cyaan gloed rechtsboven en het zeshoekpatroon
  function paintBackground(ctx, fr) {
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, fr.w, fr.h);
    const glow = ctx.createRadialGradient(fr.w, 0, 0, fr.w, 0, fr.w * 0.9);
    glow.addColorStop(0, 'rgba(26,185,226,.16)');
    glow.addColorStop(1, 'rgba(26,185,226,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, fr.w, fr.h);
    hexPattern(ctx, fr, { color: PAL.pattern, alpha: PAL.patternAlpha, x0: 0, y0: 0, x1: 0, y1: fr.h * 0.8 });
  }

  /* ---------------------------------------------------------------------------
     Tekst: **nadruk**, automatische regelval en passend maken
     ------------------------------------------------------------------------- */

  /**
   * Zet tekst om in runs. `**woord**` wordt nadruk. Met dot: true krijgt de kop
   * de cyaan punt uit het merk ("Pure Minds."), tenzij hij al eindigt op ! of ?.
   */
  function runsFrom(text, { dot = false } = {}) {
    const src = String(text || '').replace(/\r/g, '').trim();
    const runs = [];
    let em = false;
    src.split('**').forEach((part, i) => {
      if (i > 0) em = !em;
      if (part) runs.push({ text: part, em });
    });
    if (dot && runs.length) {
      const last = runs[runs.length - 1];
      const t = last.text.replace(/\s+$/, '');
      if (/[^.]\.$|^\.$/.test(t)) {
        last.text = t.slice(0, -1);
        runs.push({ text: '.', accent: true });
      } else if (!/[.!?…:;,]$/.test(t)) {
        last.text = t;
        runs.push({ text: '.', accent: true });
      }
    }
    return runs.filter((r) => r.text);
  }

  function layoutText(ctx, runs, maxW, st) {
    const lineH = st.size * st.lh;
    if (!runs.length) return { lines: [], st, lineH, height: 0, maxW };

    // Woorden opbouwen; runs zonder spatie ertussen blijven aan elkaar vast
    const words = [];
    let cur = null;
    const flush = () => {
      if (cur) words.push(cur);
      cur = null;
    };
    for (const run of runs) {
      for (const tok of run.text.split(/(\n|[ \t]+)/)) {
        if (!tok) continue;
        if (tok === '\n') {
          flush();
          words.push(null);
        } else if (/^[ \t]+$/.test(tok)) {
          flush();
        } else {
          (cur || (cur = [])).push({ text: tok, em: !!run.em, accent: !!run.accent });
        }
      }
    }
    flush();

    const measure = (seg) => {
      setFont(ctx, seg.em ? st.emWeight : st.weight, st.size, st.track);
      return ctx.measureText(seg.text).width;
    };
    setFont(ctx, st.weight, st.size, st.track);
    const space = ctx.measureText(' ').width;

    const lines = [];
    let broken = false;
    let line = { segs: [], w: 0 };
    const newLine = () => {
      lines.push(line);
      line = { segs: [], w: 0 };
    };

    for (const word of words) {
      if (word === null) {
        newLine();
        continue;
      }
      const segs = word.map((s) => ({ ...s, w: measure(s) }));
      const ww = segs.reduce((sum, s) => sum + s.w, 0);
      if (line.segs.length && line.w + space + ww > maxW) newLine();
      if (ww > maxW) {
        // Eén woord breder dan de kolom (bijv. een URL): op tekens afbreken
        broken = true;
        if (line.segs.length) {
          line.segs.push({ space: true, w: space });
          line.w += space;
        }
        for (const s of segs) {
          for (const ch of Array.from(s.text)) {
            const c = { ...s, text: ch };
            c.w = measure(c);
            if (line.segs.length && line.w + c.w > maxW) newLine();
            line.segs.push(c);
            line.w += c.w;
          }
        }
        continue;
      }
      if (line.segs.length) {
        line.segs.push({ space: true, w: space });
        line.w += space;
      }
      line.segs.push(...segs);
      line.w += ww;
    }
    lines.push(line);

    return {
      lines,
      st,
      lineH,
      broken,
      height: st.size * CAP + (lines.length - 1) * lineH + st.size * DESC,
      maxW,
    };
  }

  // Grootste korpsgrootte waarbij de tekst binnen maxW × maxH past, zonder
  // woorden middenin af te breken zolang een kleinere maat dat kan voorkomen
  function fitText(ctx, runs, maxW, maxH, st, { min, maxLines = Infinity } = {}) {
    let block = null;
    let fallback = null;
    for (let size = st.size; size >= min; size -= 2) {
      block = layoutText(ctx, runs, maxW, { ...st, size });
      if (block.height <= maxH && block.lines.length <= maxLines) {
        if (!block.broken) return block;
        if (!fallback) fallback = block;
      }
    }
    if (fallback) return fallback;
    if (block && block.lines.length) overflow = true;
    return block || layoutText(ctx, runs, maxW, st);
  }

  function drawText(ctx, block, x, top, { color, em, accent = COLORS.cyan, align = 'left' }) {
    if (!block || !block.lines.length) return;
    const { st, lineH } = block;
    const cap = st.size * CAP;

    block.lines.forEach((line, i) => {
      const base = top + cap + i * lineH;
      const x0 = align === 'center' ? x + (block.maxW - line.w) / 2 : x;

      let lx = x0;
      for (const s of line.segs) {
        if (!s.space) {
          setFont(ctx, s.em ? st.emWeight : st.weight, st.size, st.track);
          ctx.fillStyle = s.accent ? accent : s.em ? em : color;
          ctx.fillText(s.text, lx, base);
        }
        lx += s.w;
      }
    });
  }

  /**
   * Lopende tekst in alinea's. Een regel die met "- " begint wordt een
   * opsommingspunt met een cyaan zeshoekje; een lege regel geeft extra lucht.
   */
  function layoutBody(ctx, text, maxW, st) {
    const indent = st.size * 1.15;
    const gap = st.size * 0.5;
    const items = [];
    let height = 0;
    let extra = 0;
    String(text || '').replace(/\r/g, '').trim().split('\n').forEach((raw) => {
      if (!raw.trim()) {
        extra += st.size * 0.5;
        return;
      }
      const bullet = /^\s*[-•]\s+/.test(raw);
      const clean = bullet ? raw.replace(/^\s*[-•]\s+/, '') : raw.trim();
      const block = layoutText(ctx, runsFrom(clean), maxW - (bullet ? indent : 0), st);
      const y = items.length ? height + gap + extra : 0;
      items.push({ block, bullet, y });
      height = y + block.height;
      extra = 0;
    });
    return { items, height, st, indent };
  }

  function drawBody(ctx, body, x, top, colors) {
    const { st } = body;
    for (const item of body.items) {
      if (item.bullet) {
        const cap = st.size * CAP;
        hexPath(ctx, x + st.size * 0.3, top + item.y + cap / 2, st.size * 0.22);
        ctx.fillStyle = COLORS.cyan;
        ctx.fill();
      }
      drawText(ctx, item.block, x + (item.bullet ? body.indent : 0), top + item.y, colors);
    }
  }

  function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  /* ---------------------------------------------------------------------------
     Vaste onderdelen: label, voetregel, logo, knop, swipe-indicator
     ------------------------------------------------------------------------- */

  function drawLabel(ctx, fr, text, pal, maxW = fr.contentW) {
    const value = String(text || '').trim();
    if (!value) return;
    const size = GRID.labelSize;
    const cap = size * CAP;
    const r = 12;
    hexPath(ctx, fr.m + r * SQRT3 / 2, fr.labelTop + cap / 2, r);
    ctx.fillStyle = pal.bullet;
    ctx.fill();
    const tx = fr.m + r * SQRT3 + 16;
    setFont(ctx, 700, size, GRID.labelTrack);
    ctx.fillStyle = pal.label;
    ctx.fillText(ellipsize(ctx, value.toUpperCase(), maxW - (tx - fr.m)), tx, fr.labelTop + cap);
  }

  // "pureminds.nl" met de cyaan punt uit het merk
  function drawDomain(ctx, fr, color) {
    setFont(ctx, 700, GRID.footerSize, 0.02);
    const y = fr.footerY + (GRID.footerSize * CAP) / 2;
    let x = fr.m;
    [['pureminds', color], ['.', COLORS.cyan], ['nl', color]].forEach(([part, fill]) => {
      ctx.fillStyle = fill;
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
    });
  }

  // Het witte logo zonder vlak erachter: de achtergrond blijft erdoorheen zichtbaar
  function drawLogo(ctx, fr, img) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const L = fr.logo;
    ctx.drawImage(img, L.x, L.y, L.w, L.h);
  }

  function drawArrow(ctx, x, y, len, color, lw) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';  // brandbook: rechte uiteinden
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len - lw * 0.7, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + len - 13, y - 13);
    ctx.lineTo(x + len, y);
    ctx.lineTo(x + len - 13, y + 13);
    ctx.stroke();
    ctx.restore();
  }

  // Hoofdactie: magenta, rechte hoeken, kleine letters (zoals .btn-primary)
  function planButton(ctx, label) {
    const size = 28;
    const padX = 34;
    const h = 78;
    const text = String(label || '').trim() || 'lees meer';
    setFont(ctx, 700, size, 0.01);
    const tw = ctx.measureText(text).width;
    const w = padX + tw + 20 + 34 + padX;
    return {
      w,
      h,
      draw(x, y) {
        ctx.fillStyle = COLORS.magenta;
        ctx.fillRect(x, y, w, h);
        setFont(ctx, 700, size, 0.01);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x + padX, y + h / 2 + (size * CAP) / 2);
        drawArrow(ctx, x + padX + tw + 20, y + h / 2, 34, '#ffffff', 4);
      },
    };
  }

  // Voortgang als zeshoekjes + "swipe" + pijl, op de plek van de voetregel
  function drawSwipe(ctx, fr, index, total, pal) {
    const y = fr.footerY;
    let x = fr.m;
    if (total > 1 && total <= 10) {
      const r = 11;
      for (let i = 0; i < total; i++) {
        const active = i === index;
        hexPath(ctx, x + (r * SQRT3) / 2, y, active ? r + 2 : r);
        if (active) {
          ctx.fillStyle = COLORS.cyan;
          ctx.fill();
        } else {
          ctx.strokeStyle = pal.dot;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        x += r * SQRT3 + 10;
      }
      x += 18;
    } else if (total > 10) {
      setFont(ctx, 800, GRID.footerSize, 0.02);
      const counter = `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText(counter, x, y + (GRID.footerSize * CAP) / 2);
      x += ctx.measureText(counter).width + 18;
    }
    setFont(ctx, 700, GRID.footerSize, 0.02);
    ctx.fillStyle = pal.text;
    ctx.fillText('swipe', x, y + (GRID.footerSize * CAP) / 2);
    x += ctx.measureText('swipe').width + 16;
    drawArrow(ctx, x, y, 48, COLORS.cyan, 4);
  }

  // Halve cyaan zeshoek aan de rechterrand: "hier gaat het verder"
  function drawEdgeCue(ctx, fr) {
    const r = 72;
    const visible = 60;
    const cx = fr.w - visible + (r * SQRT3) / 2;
    const cy = fr.h / 2;
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    const ax = fr.w - visible / 2 + 2;
    ctx.save();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(ax - 8, cy - 15);
    ctx.lineTo(ax + 7, cy);
    ctx.lineTo(ax - 8, cy + 15);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------------------------
     Foto's
     ------------------------------------------------------------------------- */

  /**
   * Tekent een foto passend in een vak (object-fit: cover), met zoom en
   * uitsnede. Geeft terug hoeveel beeld er buiten het vak valt; de app
   * gebruikt dat om de foto in de preview te verslepen.
   */
  function drawPhoto(ctx, img, box, crop) {
    ctx.save();
    ctx.beginPath();
    if (box.hex) addHex(ctx, box.hex.cx, box.hex.cy, box.hex.r);
    else ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    let info = null;
    const iw = img && (img.naturalWidth || img.width);
    const ih = img && (img.naturalHeight || img.height);
    if (iw && ih) {
      const zoom = clamp(Number(crop && crop.zoom) || 1, 1, 4);
      const fx = clamp(crop && crop.fx != null ? crop.fx : 0.5, 0, 1);
      const fy = clamp(crop && crop.fy != null ? crop.fy : 0.5, 0, 1);
      const scale = Math.max(box.w / iw, box.h / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const overflowX = dw - box.w;
      const overflowY = dh - box.h;
      ctx.drawImage(img, box.x - overflowX * fx, box.y - overflowY * fy, dw, dh);
      info = { overflowX, overflowY };
    } else {
      // Lege staat: merkvlak met patroon en een aanwijzing
      ctx.fillStyle = '#3a4652';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      hexPattern(ctx, { w: box.x + box.w, h: box.y + box.h }, {
        r: 48, color: '#ffffff', alpha: 0.1,
        x0: 0, y0: box.y, x1: 0, y1: box.y + box.h * 1.2,
      });
      setFont(ctx, 700, 26, 0.02);
      const hint = 'sleep hier je foto';
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      const tw = ctx.measureText(hint).width;
      // Op een volledig beeld staat de aanwijzing hoog, zodat hij niet door de tekst loopt
      const hy = box.hex ? box.y + box.h / 2 : box.y + box.h * 0.3;
      ctx.fillText(hint, box.x + (box.w - tw) / 2, hy + 9);
    }
    ctx.restore();
    return info;
  }

  function drawContain(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width || 300;
    const ih = img.naturalHeight || img.height || 150;
    const s = Math.min(w / iw, h / ih);
    ctx.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
  }

  /**
   * Zeshoek-duo: een verschoven cyaan lijn-zeshoek achter een gevulde zeshoek.
   * Dit vormelement komt in elk template met een zeshoek op dezelfde manier
   * terug (zelfde verschuiving en lijndikte, relatief aan de grootte).
   */
  function hexEcho(ctx, cx, cy, r) {
    hexPath(ctx, cx - r * 0.17, cy + r * 0.15, r);
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  /* ---------------------------------------------------------------------------
     Templates
     ------------------------------------------------------------------------- */

  // 1. Standaard foto: volledig beeld, of de foto in een grote zeshoek
  function tplPhoto(ctx, fr, d, env) {
    if (d.style === 'hex') {
      paintBackground(ctx, fr);
      const top = fr.labelTop + GRID.labelSize * CAP + 44;
      const bottom = fr.logo.y - 30;
      const r = Math.min((bottom - top) / 2, fr.contentW / SQRT3);
      const cx = fr.w / 2 + r * 0.08;
      const cy = (top + bottom) / 2 - r * 0.07;
      hexEcho(ctx, cx, cy, r);
      const photo = drawPhoto(ctx, env.photo, { x: cx - (r * SQRT3) / 2, y: cy - r, w: r * SQRT3, h: r * 2, hex: { cx, cy, r } }, env.crop);
      drawLabel(ctx, fr, d.label, PAL);
      drawDomain(ctx, fr, PAL.domain);
      return { photo };
    }

    const photo = drawPhoto(ctx, env.photo, { x: 0, y: 0, w: fr.w, h: fr.h }, env.crop);
    if (env.photo) {
      // Rustige verlopen onder label en voetregel, zodat die leesbaar blijven
      const bottom = ctx.createLinearGradient(0, fr.logo.y - 220, 0, fr.h);
      bottom.addColorStop(0, rgba(COLORS.navy, 0));
      bottom.addColorStop(1, rgba(COLORS.navy, 0.62));
      ctx.fillStyle = bottom;
      ctx.fillRect(0, fr.logo.y - 220, fr.w, fr.h);
      if (String(d.label || '').trim()) {
        const topGrad = ctx.createLinearGradient(0, 0, 0, fr.labelTop + 190);
        topGrad.addColorStop(0, rgba(COLORS.navy, 0.55));
        topGrad.addColorStop(1, rgba(COLORS.navy, 0));
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, fr.w, fr.labelTop + 190);
      }
    }
    drawLabel(ctx, fr, d.label, PAL);
    drawDomain(ctx, fr, '#ffffff');
    return { photo };
  }

  // 2. Foto met tekst-overlay: aankondiging in wit op een merkverloop
  function tplOverlay(ctx, fr, d, env) {
    const photo = drawPhoto(ctx, env.photo, { x: 0, y: 0, w: fr.w, h: fr.h }, env.crop);
    const k = clamp((d.strength != null ? Number(d.strength) : 80) / 100, 0, 1);
    const middle = d.position === 'middle';

    const g = ctx.createLinearGradient(0, 0, 0, fr.h);
    if (middle) {
      g.addColorStop(0, rgba(COLORS.navy, 0.55 * k));
      g.addColorStop(0.5, rgba(COLORS.navy, 0.62 * k));
      g.addColorStop(1, rgba(COLORS.navy, 0.8 * k));
    } else {
      g.addColorStop(0, rgba(COLORS.navy, 0.5 * k));
      g.addColorStop(0.24, rgba(COLORS.navy, 0.06 * k));
      g.addColorStop(0.45, rgba(COLORS.navy, 0.22 * k));
      g.addColorStop(0.75, rgba(COLORS.navy, 0.82 * k));
      g.addColorStop(1, rgba(COLORS.navy, 0.94 * k));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, fr.w, fr.h);
    hexPattern(ctx, fr, { color: '#ffffff', alpha: 0.1, x0: 0, y0: fr.h, x1: 0, y1: fr.h * 0.4 });

    if (d.decor !== false) {
      hexPath(ctx, fr.w - 64, fr.labelTop + 96, 232);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    drawLabel(ctx, fr, d.label, PAL, fr.contentW - 220);

    const maxW = fr.contentW - 40;
    const areaH = fr.contentBottom - fr.contentTop;
    const sub = fitText(ctx, runsFrom(d.subtitle), maxW, 190, TYPE.body, { min: 26, maxLines: 4 });
    const gap = sub.lines.length ? 34 : 0;
    const title = fitText(ctx, runsFrom(d.title, { dot: d.dot }), maxW, areaH - sub.height - gap, TYPE.title, { min: TITLE_MIN });
    const total = title.height + gap + sub.height;
    const top = middle ? fr.contentTop + (areaH - total) / 2 : fr.contentBottom - total;

    drawText(ctx, title, fr.m, top, { color: '#ffffff', em: COLORS.cyan });
    drawText(ctx, sub, fr.m, top + title.height + gap, { color: 'rgba(255,255,255,.9)', em: '#ffffff' });
    drawDomain(ctx, fr, '#ffffff');
    return { photo };
  }

  // 3. Pure blog post: titel links, foto in een zeshoek rechtsboven, cta onderin
  function tplBlog(ctx, fr, d, env) {
    const pal = PAL;
    paintBackground(ctx, fr);

    const r = fr.story ? 300 : fr.portrait ? 272 : 230;
    const cx = fr.w + 34 - (r * SQRT3) / 2;
    const cy = fr.labelTop - 44 + r;
    hexEcho(ctx, cx, cy, r);
    const photo = drawPhoto(ctx, env.photo, { x: cx - (r * SQRT3) / 2, y: cy - r, w: r * SQRT3, h: r * 2, hex: { cx, cy, r } }, env.crop);

    const hexLeft = cx - r * 0.17 - (r * SQRT3) / 2;
    const colW = hexLeft - fr.m - 44;
    drawLabel(ctx, fr, d.label, pal, colW);

    // Onderin: zin met het onderwerp + magenta knop
    const button = planButton(ctx, d.button);
    const topic = String(d.topic || '').trim();
    const ctaText = String(d.cta || '').replace(/\{onderwerp\}/gi, topic ? `**${topic}**` : '…');
    const cta = fitText(ctx, runsFrom(ctaText), fr.contentW, 150, { ...TYPE.body, size: 32 }, { min: BODY_MIN, maxLines: 3 });
    const buttonY = fr.contentBottom - button.h;
    const ctaTop = cta.lines.length ? buttonY - 34 - cta.height : buttonY;

    // Titel bovenin de linkerkolom, naast de zeshoek
    const titleMaxH = Math.max(80, ctaTop - 52 - fr.contentTop);
    const title = fitText(ctx, runsFrom(d.title, { dot: d.dot }), colW, titleMaxH, { ...TYPE.title, size: 72 }, { min: 40 });
    drawText(ctx, title, fr.m, fr.contentTop, { color: pal.text, em: pal.em });

    drawText(ctx, cta, fr.m, ctaTop, { color: pal.body, em: pal.text });
    button.draw(fr.m, buttonY);
    drawDomain(ctx, fr, pal.domain);
    return { photo };
  }

  // Resultaat-tegel voor de case, in de stijl van .score-tile uit de tools
  function planResult(ctx, fr, d, pal) {
    const value = String(d.resultValue || '').trim();
    const label = String(d.resultLabel || '').trim();
    if (!value && !label) return null;

    const pad = 36;
    const bar = 10;
    const x = fr.m;
    const w = fr.contentW;
    const valueSize = 100;
    const headSize = 20;
    setFont(ctx, 800, valueSize, -0.02);
    const valueW = value ? ctx.measureText(value).width : 0;
    const descX = x + bar + pad + (value ? valueW + 36 : 0);
    const descW = x + w - pad - descX;
    const desc = fitText(ctx, runsFrom(label), descW, 150, { ...TYPE.body, size: 32, lh: 1.35 }, { min: BODY_MIN, maxLines: 3 });
    const valueH = value ? valueSize * CAP : 0;
    const descH = desc.lines.length ? desc.height - desc.st.size * DESC : 0;
    const rowH = Math.max(valueH, descH);
    const h = pad + headSize * CAP + 26 + rowH + pad;

    return {
      h,
      draw(y) {
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = COLORS.cyan;
        ctx.fillRect(x, y, bar, h);

        setFont(ctx, 700, headSize, 0.12);
        ctx.fillStyle = pal.soft;
        ctx.fillText('RESULTAAT', x + bar + pad, y + pad + headSize * CAP);

        const rowTop = y + pad + headSize * CAP + 26;
        if (value) {
          setFont(ctx, 800, valueSize, -0.02);
          ctx.fillStyle = COLORS.cyan;
          ctx.fillText(value, x + bar + pad, rowTop + (rowH + valueH) / 2);
        }
        if (desc.lines.length) {
          drawText(ctx, desc, descX, rowTop + (rowH - descH) / 2, { color: pal.body, em: pal.text });
        }
      },
    };
  }

  // 4. Pure case post: klantlogo in een zeshoek, aanpak als kop, resultaat onderin
  function tplCase(ctx, fr, d, env) {
    const usePhoto = !!(d.photoBg && env.photo);
    const pal = PAL;
    let photo = null;
    if (usePhoto) {
      photo = drawPhoto(ctx, env.photo, { x: 0, y: 0, w: fr.w, h: fr.h }, env.crop);
      ctx.fillStyle = rgba(COLORS.ink, 0.86);
      ctx.fillRect(0, 0, fr.w, fr.h);
      hexPattern(ctx, fr, { color: '#ffffff', alpha: 0.08, x0: 0, y0: 0, x1: 0, y1: fr.h * 0.8 });
    } else {
      paintBackground(ctx, fr);
    }

    // Klant in een witte zeshoek rechtsboven
    const r = fr.story ? 140 : fr.portrait ? 134 : 120;
    const hx = fr.w - fr.m - (r * SQRT3) / 2;
    const hy = fr.labelTop + r;
    hexEcho(ctx, hx, hy, r);
    hexPath(ctx, hx, hy, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const client = String(d.client || '').trim();
    if (env.clientLogo) {
      drawContain(ctx, env.clientLogo, hx - r * 0.6, hy - r * 0.42, r * 1.2, r * 0.84);
    } else {
      const name = fitText(ctx, runsFrom(client || 'klantlogo'), r * 1.25, r * 0.9, { size: 32, weight: 800, emWeight: 800, track: -0.01, lh: 1.1 }, { min: 18 });
      drawText(ctx, name, hx - r * 0.625, hy - (name.height - name.st.size * DESC) / 2, { color: COLORS.ink, em: COLORS.ink, align: 'center' });
    }

    const hexLeft = hx - r * 0.17 - (r * SQRT3) / 2;
    const colW = hexLeft - fr.m - 40;
    drawLabel(ctx, fr, d.label, pal, colW);

    // "Voor {klant} hebben wij {diensten} gedaan." — diensten krijgen nadruk
    const services = (d.services || []).map((s) => String(s || '').trim()).filter(Boolean).map((s) => `**${s}**`);
    const joined = services.length <= 1
      ? services[0] || '…'
      : `${services.slice(0, -1).join(', ')} en ${services[services.length - 1]}`;
    const sentence = String(d.sentence || 'Voor {klant} hebben wij {diensten} gedaan.')
      .replace(/\{klant\}/gi, client || 'deze klant')
      .replace(/\{diensten\}/gi, joined);

    const result = planResult(ctx, fr, d, pal);
    const resultY = result ? fr.contentBottom - result.h : fr.contentBottom;
    const titleMaxH = Math.max(80, resultY - 52 - fr.contentTop);
    const title = fitText(ctx, runsFrom(sentence, { dot: d.dot }), colW, titleMaxH, { ...TYPE.title, size: 68 }, { min: 38 });
    drawText(ctx, title, fr.m, fr.contentTop, { color: pal.text, em: pal.em });

    if (result) result.draw(resultY);
    drawDomain(ctx, fr, pal.domain);
    return { photo };
  }

  // 5. Informatieve carousel: nummer in zeshoek, titel + tekst, swipe-indicator
  function tplCarousel(ctx, fr, d, env) {
    const pal = PAL;
    paintBackground(ctx, fr);

    const slides = Array.isArray(d.slides) && d.slides.length ? d.slides : [{ title: '', body: '' }];
    const index = clamp(env.slideIndex != null ? env.slideIndex : d.active || 0, 0, slides.length - 1);
    const slide = slides[index] || {};
    const last = !!slide.last;

    drawLabel(ctx, fr, d.label, pal);

    // Slidenummer in een cyaan zeshoek, zoals de kernwaarden in het brandbook
    const r = 46;
    const bx = fr.m + (r * SQRT3) / 2;
    const by = fr.contentTop + r;
    hexPath(ctx, bx, by, r);
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    setFont(ctx, 800, 32, 0);
    const num = String(index + 1).padStart(2, '0');
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(num, bx - ctx.measureText(num).width / 2, by + (32 * CAP) / 2);

    const top = by + r + 48;
    const areaH = fr.contentBottom - top;
    const maxW = fr.contentW - 16;
    const titleRuns = runsFrom(slide.title, { dot: d.dot });

    // Titel en tekst samen verkleinen tot ze passen, in dezelfde verhouding
    let title;
    let body;
    let gap;
    for (let k = 1; k >= 0.5; k -= 0.04) {
      title = layoutText(ctx, titleRuns, maxW, { ...TYPE.title, size: Math.round(72 * k) });
      body = layoutBody(ctx, slide.body, maxW, { ...TYPE.body, size: Math.max(22, Math.round(36 * k)) });
      gap = title.lines.length && body.items.length ? Math.round(36 * k) : 0;
      if (title.height + gap + body.height <= areaH) break;
      if (k - 0.04 < 0.5) overflow = true;
    }

    drawText(ctx, title, fr.m, top, { color: pal.text, em: pal.em });
    drawBody(ctx, body, fr.m, top + title.height + gap, { color: pal.body, em: pal.text });

    if (last) {
      drawDomain(ctx, fr, pal.domain);
    } else {
      drawSwipe(ctx, fr, index, slides.length, pal);
      drawEdgeCue(ctx, fr);
    }
    return { photo: null, slideIndex: index, last };
  }

  const TEMPLATES = {
    photo: tplPhoto,
    overlay: tplOverlay,
    blog: tplBlog,
    case: tplCase,
    carousel: tplCarousel,
  };

  /* ---------------------------------------------------------------------------
     Publieke functie
     ------------------------------------------------------------------------- */

  /**
   * Tekent de post op `canvas`.
   *   state: { template, format, dot, data: { [template]: {...} } }
   *   env:   { photo, clientLogo, logo, crop, slideIndex }
   *   opts:  { scale } — 1 = 1080 px breed
   */
  function renderPost(canvas, state, env, opts = {}) {
    const fr = frame(state.format);
    const scale = opts.scale || 1;
    const pw = Math.round(fr.w * scale);
    const ph = Math.round(fr.h * scale);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, fr.w, fr.h);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    overflow = false;
    const id = TEMPLATES[state.template] ? state.template : 'photo';
    const data = { ...(state.data && state.data[id]), dot: state.dot !== false };

    ctx.save();
    const info = TEMPLATES[id](ctx, fr, data, env || {}) || {};
    ctx.restore();

    // Vaste elementen als laatste, zodat niets ze kan bedekken
    drawLogo(ctx, fr, env && env.logo);
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(0, 0, fr.w, GRID.bar);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    return { ...info, overflow, width: fr.w, height: fr.h };
  }

  global.PMTemplates = { renderPost, FORMATS, TEMPLATE_META, COLORS, GRID };
})(window);

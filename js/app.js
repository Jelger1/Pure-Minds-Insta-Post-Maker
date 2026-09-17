/* =============================================================================
   app.js — Pure Minds Post Maker
   -----------------------------------------------------------------------------
   Houdt de toestand bij (template, teksten per template, formaat, uitsnede),
   koppelt die aan de invoervelden, en laat templates.js de preview, de
   miniaturen en de export tekenen. Teksten en instellingen worden onthouden
   in localStorage; foto's niet (die zijn te groot).
   ============================================================================= */
(function () {
  'use strict';

  const T = window.PMTemplates;
  const STORAGE_KEY = 'pm-postmaker-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const TEMPLATE_NAMES = Object.fromEntries(T.TEMPLATE_META.map((t) => [t.id, t.name]));

  function defaults() {
    return {
      template: 'overlay',
      format: 'square',
      dot: true,
      crop: { zoom: 1, fx: 0.5, fy: 0.5 },
      exportType: 'png',
      exportWidth: 1080,
      data: {
        photo: { style: 'full', label: '' },
        overlay: {
          label: '',
          title: 'Onze nieuwe **Google Ads-audit** is live',
          subtitle: 'In twee weken weet je precies waar je advertentiebudget weglekt.',
          strength: 80,
          position: 'bottom',
          decor: true,
        },
        blog: {
          label: 'pure blog',
          title: '5 signalen dat je landingspagina conversies laat liggen',
          topic: 'conversie-optimalisatie',
          cta: 'Lees onze nieuwe blog over {onderwerp} op de website.',
          button: 'lees de blog',
        },
        case: {
          label: 'pure case',
          client: 'Studio Noord',
          services: ['Google Ads', 'een nieuwe landingspagina', ''],
          sentence: 'Voor {klant} hebben wij {diensten} gedaan.',
          resultValue: '+184%',
          resultLabel: 'meer aanvragen binnen drie maanden',
          photoBg: false,
        },
        carousel: {
          label: 'pure kennis',
          active: 0,
          slides: [
            { title: 'Zo schrijf je een advertentie die wél klikt', body: 'Vijf lessen uit honderden Google Ads-accounts. Swipe mee.', last: false },
            { title: 'Begin met het zoekwoord', body: 'Laat het **zoekwoord** terugkomen in je eerste kop.\n- herkenbaar voor de zoeker\n- hogere kwaliteitsscore\n- lagere klikprijs', last: false },
            { title: 'Hulp nodig bij je campagnes?', body: 'Plan een gratis adviesgesprek via **pureminds.nl**.', last: true },
          ],
        },
      },
    };
  }

  /* ---------------------------------------------------------------------------
     Toestand en opslag
     ------------------------------------------------------------------------- */

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  // Opgeslagen waarden over de standaard heen leggen, zodat nieuwe velden
  // uit een latere versie altijd een waarde hebben
  function merge(base, saved) {
    if (!isObj(saved)) return base;
    for (const key of Object.keys(base)) {
      if (!(key in saved)) continue;
      if (isObj(base[key])) base[key] = merge(base[key], saved[key]);
      else if (Array.isArray(base[key])) base[key] = Array.isArray(saved[key]) ? saved[key] : base[key];
      else if (typeof saved[key] === typeof base[key]) base[key] = saved[key];
    }
    return base;
  }

  function load() {
    const state = defaults();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) merge(state, JSON.parse(raw));
    } catch (err) {
      /* geen opslag beschikbaar (privévenster): gewoon met de standaard verder */
    }
    const c = state.data.carousel;
    c.slides = c.slides.filter(isObj).map((s) => ({ title: String(s.title || ''), body: String(s.body || ''), last: !!s.last }));
    if (!c.slides.length) c.slides = defaults().data.carousel.slides;
    c.active = Math.min(Math.max(0, c.active | 0), c.slides.length - 1);
    // Oude standaardlabels uit een eerdere versie bijwerken
    if (state.data.blog.label === 'nieuwe blog') state.data.blog.label = 'pure blog';
    if (state.data.case.label === 'case') state.data.case.label = 'pure case';
    if (state.data.overlay.label === 'aankondiging') state.data.overlay.label = '';
    if (!T.TEMPLATE_META.some((t) => t.id === state.template)) state.template = 'overlay';
    if (!T.FORMATS[state.format]) state.format = 'square';
    return state;
  }

  let state = load();
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        /* opslag vol of geblokkeerd: niet erg, alleen niet onthouden */
      }
    }, 300);
  }

  const env = { logo: null, photo: null, clientLogo: null };
  const current = () => state.data[state.template];
  const carousel = () => state.data.carousel;

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), obj);
    target[last] = value;
  }

  /* ---------------------------------------------------------------------------
     Elementen
     ------------------------------------------------------------------------- */

  const el = {
    editor: $('#editor'),
    canvas: $('#postCanvas'),
    stage: $('#stage'),
    tplPill: $('#tplPill'),
    dimPill: $('#dimPill'),
    warning: $('#warning'),
    toast: $('#toast'),
    strip: $('#slideStrip'),
    slideNav: $('#slideNav'),
    slideNo: $('#slideNo'),
    sTitle: $('#sTitle'),
    sBody: $('#sBody'),
    sLast: $('#sLast'),
    dot: $('#dotToggle'),
    photoDrop: $('#photoDrop'),
    photoInput: $('#photoInput'),
    photoCard: $('#photoCard'),
    photoThumb: $('#photoThumb'),
    photoName: $('#photoName'),
    photoSize: $('#photoSize'),
    clientLogoInput: $('#clientLogoInput'),
    clientLogoName: $('#clientLogoName'),
    clientLogoClear: $('#clientLogoClear'),
    downloadBtn: $('#downloadBtn'),
    downloadLabel: $('#downloadLabel'),
    downloadAll: $('#downloadAllBtn'),
    copyBtn: $('#copyBtn'),
    exportWidth: $('#exportWidth'),
    styleBadge: $('#styleBadge'),
  };

  /* ---------------------------------------------------------------------------
     Renderen
     ------------------------------------------------------------------------- */

  let lastInfo = {};
  let frameRequest = 0;
  let thumbTimer = 0;

  const renderEnv = (extra = {}) => ({ ...env, crop: state.crop, ...extra });

  function render() {
    cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      lastInfo = T.renderPost(el.canvas, state, renderEnv());
      const fmt = T.FORMATS[state.format];
      el.canvas.style.setProperty('--ar', String(fmt.w / fmt.h));
      $$('[data-for-format]').forEach((n) => { n.hidden = n.dataset.forFormat !== state.format; });
      el.canvas.classList.toggle('can-pan', !!lastInfo.photo);
      const w = Number(state.exportWidth) || 1080;
      el.dimPill.textContent = `${w} × ${Math.round((fmt.h * w) / fmt.w)} px`;
      el.tplPill.textContent = state.template === 'carousel'
        ? `${TEMPLATE_NAMES.carousel} · slide ${carousel().active + 1}/${carousel().slides.length}`
        : TEMPLATE_NAMES[state.template];
      updateWarning();
    });
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(renderThumbs, 160);
  }

  // Miniaturen tonen elk template met de inhoud die de gebruiker invult
  function renderThumbs() {
    for (const canvas of $$('[data-thumb]')) {
      const id = canvas.dataset.thumb;
      T.renderPost(canvas, { ...state, template: id, format: 'square' }, renderEnv(), { scale: 240 / 1080 });
    }
    if (state.template === 'carousel') renderStrip();
  }

  function renderStrip() {
    const slides = carousel().slides;
    const fmt = T.FORMATS[state.format];
    const items = $$('.strip__item', el.strip);
    slides.forEach((_, i) => {
      let btn = items[i];
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'strip__item';
        btn.appendChild(document.createElement('canvas'));
        btn.addEventListener('click', () => selectSlide(Number(btn.dataset.index)));
        el.strip.appendChild(btn);
      }
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', `Slide ${i + 1}`);
      btn.setAttribute('aria-current', String(i === carousel().active));
      T.renderPost(btn.firstChild, { ...state, template: 'carousel' }, renderEnv({ slideIndex: i }), { scale: 144 / fmt.w });
    });
    items.slice(slides.length).forEach((b) => b.remove());
  }

  function updateWarning() {
    const msgs = [];
    if (lastInfo.overflow) msgs.push('De tekst is te lang voor dit vak en valt mogelijk buiten het kader. Kort hem in voor een rustiger ontwerp.');
    const needsPhoto = state.template === 'photo' || state.template === 'overlay' || state.template === 'blog';
    if (needsPhoto && !env.photo) msgs.push('Nog geen foto: sleep er een op de preview of kies er een bij stap 3.');
    if (state.template === 'carousel') {
      const slides = carousel().slides;
      const lastIdx = slides.length - 1;
      if (slides.length > 1 && !slides[lastIdx].last) msgs.push(`Slide ${lastIdx + 1} is de laatste, maar toont nog de swipe-indicator. Zet daar <b>Laatste slide</b> aan.`);
      const early = slides.findIndex((s, i) => s.last && i < lastIdx);
      if (early !== -1) msgs.push(`Slide ${early + 1} staat op <b>Laatste slide</b> maar er volgen nog slides.`);
    }
    el.warning.hidden = !msgs.length;
    el.warning.innerHTML = msgs.join('<br>');
  }

  /* ---------------------------------------------------------------------------
     Velden <-> toestand
     ------------------------------------------------------------------------- */

  function syncVisibility() {
    for (const node of $$('[data-for]')) {
      node.hidden = !node.dataset.for.split(/\s+/).includes(state.template);
    }
    el.styleBadge.textContent = state.template === 'carousel' ? '3' : '4';
    el.downloadLabel.textContent = state.template === 'carousel' ? 'download deze slide' : 'download post';
  }

  function syncInputs() {
    const data = current();
    for (const input of $$('[data-bind]', el.editor)) {
      const value = getPath(data, input.dataset.bind);
      if (input.type === 'checkbox') input.checked = !!value;
      else if (input.type === 'radio') input.checked = input.value === value;
      else input.value = value == null ? '' : String(value);
    }
    $$('input[name="template"]').forEach((r) => { r.checked = r.value === state.template; });
    $$('input[name="format"]').forEach((r) => { r.checked = r.value === state.format; });
    $$('input[name="exportType"]').forEach((r) => { r.checked = r.value === state.exportType; });
    el.exportWidth.value = String(state.exportWidth);
    el.dot.checked = state.dot !== false;
    syncCrop();
    syncOutputs();
    syncSlides();
  }

  function syncCrop() {
    $('#cropZoom').value = String(Math.round(state.crop.zoom * 100));
    $('#cropX').value = String(Math.round(state.crop.fx * 100));
    $('#cropY').value = String(Math.round(state.crop.fy * 100));
    syncOutputs();
  }

  function syncOutputs() {
    $('#cropZoomVal').textContent = `${Math.round(state.crop.zoom * 100)}%`;
    $('#cropXVal').textContent = `${Math.round(state.crop.fx * 100)}%`;
    $('#cropYVal').textContent = `${Math.round(state.crop.fy * 100)}%`;
    const strength = state.data.overlay.strength;
    $('#oStrengthVal').textContent = `${strength}%`;
  }

  el.editor.addEventListener('submit', (e) => e.preventDefault());

  el.editor.addEventListener('input', (e) => {
    const input = e.target;
    if (input.dataset.bind) {
      let value = input.value;
      if (input.type === 'checkbox') value = input.checked;
      else if (input.type === 'range') value = Number(value);
      else if (input.type === 'radio' && !input.checked) return;
      setPath(current(), input.dataset.bind, value);
      syncOutputs();
      changed();
    } else if (input.dataset.crop) {
      state.crop[input.dataset.crop] = Number(input.value) / 100;
      syncOutputs();
      changed();
    }
  });

  // Radio's en checkboxes vuren 'change'; niet alle browsers ook 'input'
  el.editor.addEventListener('change', (e) => {
    const input = e.target;
    if (input.name === 'template' && input.checked) {
      state.template = input.value;
      syncVisibility();
      syncInputs();
      changed();
    } else if (input.name === 'format' && input.checked) {
      state.format = input.value;
      changed();
    } else if (input === el.dot) {
      state.dot = input.checked;
      changed();
    } else if (input.dataset.bind && (input.type === 'checkbox' || input.type === 'radio')) {
      if (input.type === 'radio' && input.checked) setPath(current(), input.dataset.bind, input.value);
      if (input.type === 'checkbox') setPath(current(), input.dataset.bind, input.checked);
      changed();
    }
  });

  $$('input[name="exportType"]').forEach((r) => r.addEventListener('change', () => {
    if (r.checked) {
      state.exportType = r.value;
      save();
    }
  }));
  el.exportWidth.addEventListener('change', () => {
    state.exportWidth = Number(el.exportWidth.value) || 1080;
    changed();
  });

  function changed() {
    save();
    render();
  }

  /* ---------------------------------------------------------------------------
     Carousel-slides
     ------------------------------------------------------------------------- */

  function syncSlides() {
    const c = carousel();
    const slide = c.slides[c.active];
    el.slideNav.textContent = '';
    c.slides.forEach((s, i) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `slide-tab${s.last ? ' is-last' : ''}`;
      tab.textContent = String(i + 1).padStart(2, '0');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(i === c.active));
      tab.setAttribute('aria-label', `Slide ${i + 1}${s.last ? ' (laatste slide)' : ''}`);
      tab.addEventListener('click', () => selectSlide(i));
      el.slideNav.appendChild(tab);
    });
    if (c.slides.length < 20) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'slide-tab slide-tab--add';
      add.textContent = '+';
      add.title = 'Slide toevoegen';
      add.setAttribute('aria-label', 'Slide toevoegen');
      add.addEventListener('click', addSlide);
      el.slideNav.appendChild(add);
    }
    el.slideNo.textContent = `slide ${c.active + 1} van ${c.slides.length}`;
    el.sTitle.value = slide.title;
    el.sBody.value = slide.body;
    el.sLast.checked = !!slide.last;
    $('#slideLeft').disabled = c.active === 0;
    $('#slideRight').disabled = c.active === c.slides.length - 1;
    $('#slideDel').disabled = c.slides.length === 1;
  }

  function selectSlide(i) {
    const c = carousel();
    c.active = Math.min(Math.max(0, i), c.slides.length - 1);
    syncSlides();
    changed();
  }

  function addSlide() {
    const c = carousel();
    // Een nieuwe slide na de huidige laatste neemt de rol "laatste slide" over
    const wasLast = c.active === c.slides.length - 1 && c.slides[c.active].last;
    if (wasLast) c.slides[c.active].last = false;
    c.slides.splice(c.active + 1, 0, { title: '', body: '', last: wasLast });
    c.active += 1;
    syncSlides();
    changed();
    el.sTitle.focus();
  }

  el.sTitle.addEventListener('input', (e) => {
    e.stopPropagation();
    carousel().slides[carousel().active].title = el.sTitle.value;
    changed();
  });
  el.sBody.addEventListener('input', (e) => {
    e.stopPropagation();
    carousel().slides[carousel().active].body = el.sBody.value;
    changed();
  });
  el.sLast.addEventListener('change', (e) => {
    e.stopPropagation();
    carousel().slides[carousel().active].last = el.sLast.checked;
    syncSlides();
    changed();
  });

  function moveSlide(delta) {
    const c = carousel();
    const to = c.active + delta;
    if (to < 0 || to >= c.slides.length) return;
    const [slide] = c.slides.splice(c.active, 1);
    c.slides.splice(to, 0, slide);
    c.active = to;
    syncSlides();
    changed();
  }
  $('#slideLeft').addEventListener('click', () => moveSlide(-1));
  $('#slideRight').addEventListener('click', () => moveSlide(1));
  $('#slideDup').addEventListener('click', () => {
    const c = carousel();
    if (c.slides.length >= 20) return;
    const copy = { ...c.slides[c.active], last: false };
    c.slides.splice(c.active + 1, 0, copy);
    c.active += 1;
    syncSlides();
    changed();
  });
  $('#slideDel').addEventListener('click', () => {
    const c = carousel();
    if (c.slides.length === 1) return;
    c.slides.splice(c.active, 1);
    c.active = Math.min(c.active, c.slides.length - 1);
    syncSlides();
    changed();
  });

  /* ---------------------------------------------------------------------------
     Afbeeldingen: foto en klantlogo
     ------------------------------------------------------------------------- */

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Kies een afbeelding: JPG, PNG, WebP of SVG.'));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Deze afbeelding kan de browser niet lezen. Probeer een JPG of PNG (HEIC van een iPhone werkt niet).'));
      };
      img.src = url;
    });
  }

  const formatSize = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

  async function setPhoto(file) {
    try {
      const { img, url } = await readImage(file);
      if (env.photoUrl) URL.revokeObjectURL(env.photoUrl);
      env.photo = img;
      env.photoUrl = url;
      state.crop = { zoom: 1, fx: 0.5, fy: 0.5 };
      el.photoThumb.style.backgroundImage = `url("${url}")`;
      el.photoName.textContent = file.name || 'geplakte afbeelding';
      el.photoSize.textContent = `${img.naturalWidth} × ${img.naturalHeight} px · ${formatSize(file.size)}`;
      el.photoCard.hidden = false;
      el.photoDrop.hidden = true;
      if (Math.min(img.naturalWidth, img.naturalHeight) < 1080) {
        toast('Let op: deze foto is kleiner dan 1080 px en kan onscherp worden.');
      }
      if (state.template === 'carousel') toast('Foto geplaatst. De carousel gebruikt geen foto; kies een ander template om hem te zien.');
      syncCrop();
      changed();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function clearPhoto() {
    if (env.photoUrl) URL.revokeObjectURL(env.photoUrl);
    env.photo = null;
    env.photoUrl = null;
    el.photoCard.hidden = true;
    el.photoDrop.hidden = false;
    el.photoInput.value = '';
    render();
  }

  el.photoDrop.addEventListener('click', () => el.photoInput.click());
  el.photoDrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.photoInput.click();
    }
  });
  $('#photoReplace').addEventListener('click', () => el.photoInput.click());
  $('#photoClear').addEventListener('click', clearPhoto);
  el.photoInput.addEventListener('change', () => {
    if (el.photoInput.files[0]) setPhoto(el.photoInput.files[0]);
    el.photoInput.value = '';
  });

  $('#clientLogoBtn').addEventListener('click', () => el.clientLogoInput.click());
  el.clientLogoInput.addEventListener('change', async () => {
    const file = el.clientLogoInput.files[0];
    el.clientLogoInput.value = '';
    if (!file) return;
    try {
      const { img, url } = await readImage(file);
      if (env.clientLogoUrl) URL.revokeObjectURL(env.clientLogoUrl);
      env.clientLogo = img;
      env.clientLogoUrl = url;
      el.clientLogoName.textContent = file.name;
      el.clientLogoClear.hidden = false;
      render();
    } catch (err) {
      toast(err.message, true);
    }
  });
  el.clientLogoClear.addEventListener('click', () => {
    if (env.clientLogoUrl) URL.revokeObjectURL(env.clientLogoUrl);
    env.clientLogo = null;
    env.clientLogoUrl = null;
    el.clientLogoName.textContent = 'geen';
    el.clientLogoClear.hidden = true;
    render();
  });

  // Slepen op de upload-zone of de preview
  function bindDrop(zone, overClass, target) {
    let depth = 0;
    zone.addEventListener('dragenter', (e) => {
      if (!Array.from(e.dataTransfer.types).includes('Files')) return;
      e.preventDefault();
      depth++;
      target.classList.add(overClass);
    });
    zone.addEventListener('dragover', (e) => {
      if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
    });
    zone.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) target.classList.remove(overClass);
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      target.classList.remove(overClass);
      const file = e.dataTransfer.files[0];
      if (file) setPhoto(file);
    });
  }
  bindDrop(el.photoDrop, 'is-over', el.photoDrop);
  bindDrop(el.stage, 'is-over', el.stage);
  // Een foto die naast de zones valt niet in een nieuw tabblad openen
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // Plakken vanaf het klembord
  document.addEventListener('paste', (e) => {
    const item = Array.from(e.clipboardData ? e.clipboardData.items : []).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    setPhoto(item.getAsFile());
  });

  // Uitsnede verschuiven door in de preview te slepen
  let pan = null;
  el.canvas.addEventListener('pointerdown', (e) => {
    if (!lastInfo.photo) return;
    pan = { x: e.clientX, y: e.clientY, fx: state.crop.fx, fy: state.crop.fy };
    el.canvas.setPointerCapture(e.pointerId);
    el.canvas.classList.add('is-panning');
  });
  el.canvas.addEventListener('pointermove', (e) => {
    if (!pan || !lastInfo.photo) return;
    const k = el.canvas.width / el.canvas.getBoundingClientRect().width;
    const { overflowX, overflowY } = lastInfo.photo;
    if (overflowX > 0.5) state.crop.fx = Math.min(1, Math.max(0, pan.fx - ((e.clientX - pan.x) * k) / overflowX));
    if (overflowY > 0.5) state.crop.fy = Math.min(1, Math.max(0, pan.fy - ((e.clientY - pan.y) * k) / overflowY));
    syncCrop();
    render();
  });
  const endPan = () => {
    if (!pan) return;
    pan = null;
    el.canvas.classList.remove('is-panning');
    save();
  };
  el.canvas.addEventListener('pointerup', endPan);
  el.canvas.addEventListener('pointercancel', endPan);

  /* ---------------------------------------------------------------------------
     Export
     ------------------------------------------------------------------------- */

  function slug(text) {
    return String(text || '')
      .replace(/\*\*/g, '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40).replace(/-+$/, '');
  }

  function fileName(slideIndex, w, h) {
    const d = current();
    let subject = d.title || d.client || d.label;
    if (state.template === 'carousel') subject = carousel().slides[0].title;
    const parts = ['pureminds', state.template, slug(subject)];
    if (slideIndex != null) parts.push(`slide-${String(slideIndex + 1).padStart(2, '0')}`);
    parts.push(`${w}x${h}`);
    return `${parts.filter(Boolean).join('-')}.${state.exportType === 'jpg' ? 'jpg' : 'png'}`;
  }

  async function makeBlob(slideIndex, type) {
    await fontsReady;
    const scale = (Number(state.exportWidth) || 1080) / 1080;
    const canvas = document.createElement('canvas');
    T.renderPost(canvas, state, renderEnv(slideIndex != null ? { slideIndex } : {}), { scale });
    const mime = (type || state.exportType) === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Het bestand kon niet worden gemaakt.'))), mime, 0.92);
      } catch (err) {
        reject(err.name === 'SecurityError'
          ? new Error('De browser blokkeert de export. Start de tool via een server (npm start) in plaats van het HTML-bestand direct te openen.')
          : err);
      }
    });
    return { blob, name: fileName(slideIndex, canvas.width, canvas.height) };
  }

  function saveBlob({ blob, name }) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function withBusy(button, task) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await task();
    } catch (err) {
      toast(err.message || 'Er ging iets mis bij het exporteren.', true);
    } finally {
      button.disabled = false;
    }
  }

  function downloadCurrent() {
    return withBusy(el.downloadBtn, async () => {
      const index = state.template === 'carousel' ? carousel().active : null;
      const file = await makeBlob(index);
      saveBlob(file);
      toast(`Gedownload: ${file.name}`);
    });
  }

  el.downloadBtn.addEventListener('click', downloadCurrent);

  el.downloadAll.addEventListener('click', () => withBusy(el.downloadAll, async () => {
    const slides = carousel().slides;
    for (let i = 0; i < slides.length; i++) {
      saveBlob(await makeBlob(i));
      // Korte pauze: browsers slaan snel opeenvolgende downloads anders over
      await new Promise((r) => setTimeout(r, 350));
    }
    toast(`${slides.length} slides gedownload. Vraagt de browser om meerdere downloads toe te staan, klik dan op toestaan.`);
  }));

  el.copyBtn.addEventListener('click', () => withBusy(el.copyBtn, async () => {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('Kopiëren naar het klembord werkt niet in deze browser. Gebruik download.');
    }
    const index = state.template === 'carousel' ? carousel().active : null;
    // Klembord accepteert alleen PNG
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': makeBlob(index, 'png').then((f) => f.blob) })]);
    el.copyBtn.classList.add('is-done');
    el.copyBtn.textContent = 'gekopieerd';
    setTimeout(() => {
      el.copyBtn.classList.remove('is-done');
      el.copyBtn.textContent = 'kopieer';
    }, 1600);
  }));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      downloadCurrent();
    }
  });

  /* ---------------------------------------------------------------------------
     Overig
     ------------------------------------------------------------------------- */

  let toastTimer = 0;
  function toast(message, isError = false) {
    el.toast.textContent = message;
    el.toast.classList.toggle('is-error', isError);
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), isError ? 6000 : 3200);
  }

  $('#resetBtn').addEventListener('click', () => {
    if (!window.confirm('Alle teksten en instellingen terugzetten naar de voorbeelden?')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* niets */
    }
    state = defaults();
    clearPhoto();
    el.clientLogoClear.click();
    syncVisibility();
    syncInputs();
    render();
  });

  // Logo: de PNG via een server; bij file:// de ingebedde kopie, anders
  // blokkeert de browser de export (zie scripts/build-logo-data.js)
  env.logo = new Image();
  env.logo.onload = render;
  env.logo.onerror = () => {
    if (window.PM_LOGO_DATA && env.logo.src !== window.PM_LOGO_DATA) env.logo.src = window.PM_LOGO_DATA;
  };
  env.logo.src = location.protocol === 'file:' && window.PM_LOGO_DATA ? window.PM_LOGO_DATA : 'PureMinds-zeshoek-logo.png';

  // Canvas kent alleen fonts die al geladen zijn: eerst laden, dan opnieuw tekenen
  const fontsReady = document.fonts
    ? Promise.all([300, 400, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "PM Open Sans"`))).catch(() => null)
    : Promise.resolve();
  fontsReady.then(render);

  syncVisibility();
  syncInputs();
  render();
})();

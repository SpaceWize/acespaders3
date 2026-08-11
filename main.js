/* ═══════════════════════════════════════════════════════════════
   ACE SPADERS — behaviour
   Four motion systems, then chrome. Nothing decorative.
     1. heroChoreography()  pinned, scroll-position-driven hero
        fluidHero()         the hero's fluid surface, part of the same idea
     2. flagshipReveal()    ordered stagger on the core four
     3. proofCounters()     one count-up, once
     4. (CSS only)          hover lift on secondary services
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  /* ── 1. HERO CHOREOGRAPHY ──────────────────────────────────────
     Not input hijacking — the page scrolls normally. The stage pins
     and the panels are driven off scroll position, so the reader
     keeps full control of pace and direction.                     */
  function heroChoreography() {
    var hero = document.querySelector('[data-hero]');
    var stage = hero && hero.querySelector('[data-stage]');
    if (!hero || !stage) return;

    // Cinematic only where it can be done well.
    var cine = window.matchMedia(
      '(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
    );
    var ticking = false;
    var bound = false;

    function setBeat(n, t) {
      var e = easeOut(t);
      stage.style.setProperty('--o' + n, e.toFixed(3));
      stage.style.setProperty('--y' + n, ((1 - e) * 46).toFixed(2) + 'px');
    }

    function frame() {
      ticking = false;
      var top = hero.getBoundingClientRect().top;
      var travel = hero.offsetHeight - window.innerHeight;
      var p = travel > 0 ? clamp(-top / travel, 0, 1) : 0;
      var s = stage.style;

      s.setProperty('--scrim', (0.40 + 0.32 * seg(p, 0.18, 0.84)).toFixed(3));

      // Beat 1 is the landing frame — it is never animated in, so the page
      // never opens on an empty screen. Scroll composes beats 2–4 beneath it.
      setBeat(2, seg(p, 0.14, 0.34));   // headline, line two
      setBeat(3, seg(p, 0.42, 0.60));   // identity paragraph
      setBeat(4, seg(p, 0.54, 0.70));   // calls to action

      // the block rides low while it is still half-empty, then rises
      s.setProperty('--cy', ((1 - easeOut(seg(p, 0.08, 0.66))) * 320).toFixed(1) + 'px');
      s.setProperty('--cue', (1 - seg(p, 0, 0.05)).toFixed(3));
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }

    function reset() {
      // hand every custom property back to its settled CSS default
      ['--o2', '--o3', '--o4', '--y2', '--y3', '--y4',
        '--scrim', '--cue', '--cy'].forEach(function (k) { stage.style.removeProperty(k); });
    }

    function sync() {
      if (cine.matches && !bound) {
        bound = true;
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        frame();
      } else if (!cine.matches && bound) {
        bound = false;
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        reset();
      }
    }

    sync();
    if (cine.addEventListener) cine.addEventListener('change', sync);
    else if (cine.addListener) cine.addListener(sync);
  }

  /* ── 1b. FLUID HERO SURFACE ────────────────────────────────────
     Classic 2D water propagation (Hugo Elias): two alternating
     displacement buffers on a downscaled grid, rendered by refracting a
     source texture. The canvas backing store IS the simulation grid
     (≤300px wide), stretched by CSS — the browser's bilinear upscale does
     the softening, which is both cheaper and prettier than blurring in JS.

     Pointer moves leave a trail; a click drops a heavy weight.           */
  function fluidHero() {
    var canvas = document.querySelector('[data-fluid]');
    if (!canvas || !canvas.getContext) return;
    var stage = canvas.parentNode;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var DAMP = 0.985;         // waves dissipate instead of ringing forever
    var TRAIL_R = 2, TRAIL_W = 18;    // pointer trail
    var DROP_R = 6, DROP_W = 180;     // click impact
    // The wave front travels exactly one cell per step, so the step rate is
    // the wave speed. 30Hz reads as a slow swell rather than a splash.
    var STEP = 1000 / 30;
    var DISP = 0.16;          // css px of star travel per unit of height slope
    var MAX_DISP = 34;        // px, so a heavy drop bends light instead of teleporting it
    var LIFT = 0.0045;        // brightness/size gain on a crest — the caustic

    var W = 0, H = 0;                 // simulation grid
    var cw = 0, ch = 0, dpr = 1;      // canvas, in CSS px
    var cur = null, prev = null;      // the two displacement buffers
    var stars = null, sprite = null;
    var raf = null, onScreen = true, nextAmbient = 0;
    var ptr = null, lastPtr = null;
    var acc = 0, lastT = 0;

    /* ---- the field ------------------------------------------------------
       Only the points live on the canvas — the gradient and key light are CSS,
       so they cost nothing and never pixelate. Drawing points rather than
       refracting a pixel buffer is what keeps this sharp on a large display:
       cost scales with star count, not screen area, so the canvas can run at
       full device resolution while the simulation stays coarse and cheap. */
    function makeSprite() {
      var D = 24, s = document.createElement('canvas');
      s.width = D; s.height = D;
      var g = s.getContext('2d');
      var rg = g.createRadialGradient(D / 2, D / 2, 0, D / 2, D / 2, D / 2);
      rg.addColorStop(0, 'rgba(255,247,231,1)');
      rg.addColorStop(0.16, 'rgba(251,224,170,.94)');
      rg.addColorStop(0.42, 'rgba(228,180,106,.30)');
      rg.addColorStop(1, 'rgba(228,180,106,0)');
      g.fillStyle = rg; g.fillRect(0, 0, D, D);
      return s;
    }

    // Seeded, so a resize reflows the field instead of reshuffling it.
    function lcg(seed) {
      var s = seed >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    function makeStars() {
      var rand = lcg(0x5EEDACE);
      var n = Math.max(160, Math.min(1500, Math.round(cw * ch / 1500)));
      var lx = 0.74, ly = 0.06, lr = 0.86;     // key light, normalised
      var a = new Float32Array(n * 4);
      for (var i = 0; i < n; i++) {
        var x = rand(), y = rand(), t = rand();
        var dx = x - lx, dy = (y - ly) * 0.62;
        var fall = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy) / lr);
        a[i * 4] = x;
        a[i * 4 + 1] = y;
        a[i * 4 + 2] = 0.7 + t * t * t * 3.4;   // mostly fine, a few anchors
        a[i * 4 + 3] = (0.16 + rand() * 0.60) * (0.20 + 0.80 * fall * fall);
      }
      return a;
    }

    /* Bilinear so a star drifts smoothly instead of snapping between cells. */
    function sampleH(buf, x, y) {
      if (x < 0) x = 0; else if (x > W - 1) x = W - 1;
      if (y < 0) y = 0; else if (y > H - 1) y = H - 1;
      var x0 = x | 0, y0 = y | 0;
      var x1 = x0 + 1 > W - 1 ? W - 1 : x0 + 1;
      var y1 = y0 + 1 > H - 1 ? H - 1 : y0 + 1;
      var fx = x - x0, fy = y - y0, i0 = y0 * W, i1 = y1 * W;
      var top = buf[i0 + x0] + (buf[i0 + x1] - buf[i0 + x0]) * fx;
      var bot = buf[i1 + x0] + (buf[i1 + x1] - buf[i1 + x0]) * fx;
      return top + (bot - top) * fy;
    }

    /* ---- sizing: keep existing waves across a resize -------------------- */
    function resample(old, ow, oh, nw, nh) {
      var n = new Int32Array(nw * nh);
      if (!old || !ow || !oh) return n;
      for (var y = 0; y < nh; y++) {
        var sy = Math.min(oh - 1, (y * oh / nh) | 0);
        for (var x = 0; x < nw; x++) {
          n[y * nw + x] = old[sy * ow + Math.min(ow - 1, (x * ow / nw) | 0)];
        }
      }
      return n;
    }

    function build() {
      var r = canvas.getBoundingClientRect();
      var ncw = Math.max(1, Math.round(r.width)), nch = Math.max(1, Math.round(r.height));
      var ndpr = Math.min(2, window.devicePixelRatio || 1);
      if (ncw === cw && nch === ch && ndpr === dpr) return;

      cw = ncw; ch = nch; dpr = ndpr;
      // Backing store at device resolution: the points stay pin-sharp on a
      // retina or 4K display instead of being upscaled from the sim grid.
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var ow = W, oh = H;
      W = Math.max(120, Math.min(300, Math.round(cw / 5)));
      H = Math.max(80, Math.round(W * ch / cw));
      cur = resample(cur, ow, oh, W, H);
      prev = resample(prev, ow, oh, W, H);
      if (!sprite) sprite = makeSprite();
      stars = makeStars();
      render(cur);
    }

    /* ---- disturbance ---------------------------------------------------- */
    function drop(cx, cy, radius, weight) {
      if (!prev) return;
      for (var y = -radius; y <= radius; y++) {
        for (var x = -radius; x <= radius; x++) {
          if (x * x + y * y > radius * radius) continue;
          var px = cx + x, py = cy + y;
          if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
          prev[py * W + px] += weight;
        }
      }
    }

    function toGrid(e) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        x: Math.round((e.clientX - r.left) / r.width * W),
        y: Math.round((e.clientY - r.top) / r.height * H)
      };
    }

    /* Coalesce pointer moves to one injection per frame, interpolating along
       the path so a fast sweep leaves a line rather than a dotted trail. */
    function injectPointer() {
      if (!ptr) return;
      if (lastPtr) {
        var dx = ptr.x - lastPtr.x, dy = ptr.y - lastPtr.y;
        var steps = Math.min(6, Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / 3)));
        for (var s = 1; s <= steps; s++) {
          drop(Math.round(lastPtr.x + dx * s / steps),
            Math.round(lastPtr.y + dy * s / steps), TRAIL_R, TRAIL_W);
        }
      } else {
        drop(ptr.x, ptr.y, TRAIL_R, TRAIL_W);
      }
      lastPtr = ptr; ptr = null;
    }

    /* Sparse ambient drops so the surface still breathes with no pointer
       (and on touch devices, where mousemove never fires). Wide and shallow,
       not small and sharp — same energy reads as a swell rather than a plink. */
    function ambient(now) {
      if (now < nextAmbient) return;
      nextAmbient = now + 2800 + Math.random() * 3600;
      drop(5 + Math.random() * (W - 10) | 0, 5 + Math.random() * (H - 10) | 0, 5, 22);
    }

    /* ---- simulation + render -------------------------------------------- */
    function simulate() {
      var w = W;
      for (var y = 1; y < H - 1; y++) {
        var row = y * w;
        for (var x = 1; x < w - 1; x++) {
          var i = row + x;
          cur[i] = ((((prev[i - 1] + prev[i + 1] + prev[i - w] + prev[i + w]) >> 1)
            - cur[i]) * DAMP) | 0;
        }
      }
    }

    /* Each point is refracted individually: the local slope moves it, the local
       height brightens and swells it. That second term is the caustic, and it
       is what makes a passing wave read as water rather than as drifting dust. */
    function render(buf) {
      if (!stars) return;
      ctx.clearRect(0, 0, cw, ch);
      var n = stars.length >> 2, gw = W - 1, gh = H - 1;
      for (var i = 0; i < n; i++) {
        var o = i << 2;
        var nx = stars[o], ny = stars[o + 1], sz = stars[o + 2], al = stars[o + 3];
        var gx = nx * gw, gy = ny * gh;

        var h = sampleH(buf, gx, gy);
        var ox = (sampleH(buf, gx - 1, gy) - sampleH(buf, gx + 1, gy)) * DISP;
        var oy = (sampleH(buf, gx, gy - 1) - sampleH(buf, gx, gy + 1)) * DISP;
        if (ox > MAX_DISP) ox = MAX_DISP; else if (ox < -MAX_DISP) ox = -MAX_DISP;
        if (oy > MAX_DISP) oy = MAX_DISP; else if (oy < -MAX_DISP) oy = -MAX_DISP;

        var e = 1 + h * LIFT;
        if (e < 0.35) e = 0.35; else if (e > 2.3) e = 2.3;
        var a = al * e;
        if (a <= 0.012) continue;                  // skip what would not show
        if (a > 1) a = 1;

        var d = sz * (0.74 + 0.26 * e) * 3.2;      // sprite is mostly halo
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, nx * cw + ox - d / 2, ny * ch + oy - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    }

    /* Fixed timestep. Damping and propagation are both per-step, so without
       this the water would run 2.4x faster on a 144Hz display than a 60Hz one. */
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!lastT) lastT = now;
      acc += now - lastT;
      lastT = now;
      if (acc > 200) acc = 200;                     // came back from a stall
      var stepped = 0;
      while (acc >= STEP && stepped < 4) {
        acc -= STEP; stepped++;
        injectPointer();
        ambient(now);
        simulate();
        var t = cur; cur = prev; prev = t;          // swap the buffers
      }
      if (stepped) render(prev);                    // post-swap, prev is newest
    }

    function start() {
      if (raf || !onScreen || document.hidden) return;
      lastT = 0; acc = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      lastPtr = null; ptr = null; lastT = 0; acc = 0;
    }

    build();

    /* Resize is bound before the reduced-motion guard: the points are drawn at
       device resolution, so a stale backing store stretches them visibly. This
       has to run even when the water doesn't. */
    var resizeRaf = null;
    window.addEventListener('resize', function () {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(function () { resizeRaf = null; build(); });
    }, { passive: true });

    // Reduced motion: keep the field, drop the water.
    if (reduce.matches) return;

    stage.addEventListener('mousemove', function (e) { ptr = toGrid(e); }, { passive: true });
    stage.addEventListener('mouseleave', function () { ptr = null; lastPtr = null; });
    stage.addEventListener('click', function (e) {
      var p = toGrid(e); if (p) drop(p.x, p.y, DROP_R, DROP_W);
    });
    stage.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; if (!t) return;
      var p = toGrid(t); if (p) drop(p.x, p.y, DROP_R, DROP_W);
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      var t = e.touches[0]; if (t) ptr = toGrid(t);
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start(); else stop();
      }, { threshold: 0 }).observe(canvas);
    }
    start();
  }

  /* ── 2. FLAGSHIP ORDERED REVEAL ────────────────────────────────
     One trigger, then CSS walks the four in order via --i.
     Stagger (620ms) is close to the item duration (720ms) so they
     resolve one at a time rather than blooming together.          */
  function flagshipReveal() {
    var list = document.querySelector('[data-four]');
    if (!list) return;
    if (reduce.matches || !('IntersectionObserver' in window)) {
      list.classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    io.observe(list);
  }

  /* ── 3. PROOF COUNTERS ─────────────────────────────────────────
     Fires once. Reduced motion gets the number, not the animation. */
  function proofCounters() {
    var strip = document.querySelector('[data-proof]');
    if (!strip) return;
    var nodes = [].slice.call(strip.querySelectorAll('[data-count]'));
    if (!nodes.length) return;

    var settle = function () {
      nodes.forEach(function (n) {
        n.textContent = Number(n.getAttribute('data-count')).toLocaleString();
      });
    };

    if (reduce.matches || !('IntersectionObserver' in window)) { settle(); return; }

    var run = function () {
      var dur = 1600, t0 = null;
      var targets = nodes.map(function (n) { return Number(n.getAttribute('data-count')) || 0; });
      (function step(ts) {
        if (t0 === null) t0 = ts;
        var t = clamp((ts - t0) / dur, 0, 1);
        var e = easeOut(t);
        nodes.forEach(function (n, i) {
          n.textContent = Math.round(targets[i] * e).toLocaleString();
        });
        if (t < 1) requestAnimationFrame(step); else settle();
      })(performance.now());
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        run();
      });
    }, { threshold: 0.4 });
    io.observe(strip);
  }

  /* ── HEADER: solid once you leave the hero ─────────────────── */
  function header() {
    var head = document.querySelector('[data-head]');
    if (!head) return;
    var ticking = false;
    function check() {
      ticking = false;
      head.classList.toggle('is-stuck', window.scrollY > 24);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    check();
  }

  /* ── NAV: mark the section you're reading ──────────────────── */
  function navState() {
    var links = [].slice.call(document.querySelectorAll('[data-nav] a'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    var sections = links.map(function (a) {
      var el = document.querySelector(a.getAttribute('href'));
      if (el) map[el.id] = a;
      return el;
    }).filter(Boolean);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = map[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('is-current'); });
          a.classList.add('is-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ── MOBILE MENU ───────────────────────────────────────────── */
  function mobileMenu() {
    var btn = document.querySelector('[data-burger]');
    var panel = document.querySelector('[data-mnav]');
    if (!btn || !panel) return;

    function open(state) {
      btn.setAttribute('aria-expanded', String(state));
      panel.hidden = !state;
      document.body.style.overflow = state ? 'hidden' : '';
      btn.querySelector('.sr-only').textContent = state ? 'Close menu' : 'Open menu';
      if (state) { var f = panel.querySelector('a'); if (f) f.focus(); }
    }

    btn.addEventListener('click', function () {
      open(btn.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) { open(false); btn.focus(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (m) {
      if (m.matches && !panel.hidden) open(false);
    });
  }

  /* ── APPLICATION FORM ──────────────────────────────────────────
     Validates in place, then composes a pre-filled email so the form
     works with no backend. To post to a real endpoint instead, set
     the <form action> and delete the mailto branch below.          */
  function applicationForm() {
    var form = document.querySelector('[data-form]');
    if (!form) return;
    var status = form.querySelector('[data-status]');
    var TO = 'hello@acespaders.com'; // REPLACE: destination address

    function fieldOf(input) { return input.closest('.field'); }
    function errOf(input) {
      var f = fieldOf(input);
      return f && f.querySelector('[data-err]');
    }
    function setError(input, msg) {
      var f = fieldOf(input), e = errOf(input);
      if (f) f.classList.toggle('is-bad', !!msg);
      if (e) e.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function validate(input) {
      var v = (input.value || '').trim();
      var label = (fieldOf(input).querySelector('label').textContent || 'This field').trim();
      if (input.required && !v) {
        setError(input, input.getAttribute('data-msg') || label + ' is required.');
        return false;
      }
      if (input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        setError(input, 'Use a full email address, like name@company.com.');
        return false;
      }
      setError(input, '');
      return true;
    }

    var fields = [].slice.call(form.querySelectorAll('input, select, textarea'));
    fields.forEach(function (f) {
      f.addEventListener('blur', function () { validate(f); });
      f.addEventListener('input', function () {
        if (fieldOf(f).classList.contains('is-bad')) validate(f);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null;
      fields.forEach(function (f) {
        if (!validate(f)) { ok = false; if (!first) first = f; }
      });
      if (!ok) {
        status.textContent = 'Fix the highlighted fields and send again.';
        if (first) first.focus();
        return;
      }

      var d = new FormData(form);
      var subject = 'Application — ' + (d.get('door') || 'Ace Spaders');
      var body = [
        'Name: ' + d.get('name'),
        'Email: ' + d.get('email'),
        'Organization: ' + (d.get('org') || '—'),
        'Door: ' + d.get('door'),
        'Timeline: ' + d.get('when'),
        '',
        "What's stuck:",
        d.get('what')
      ].join('\n');

      status.textContent = 'Opening your email client with the application filled in. '
        + 'If nothing happens, send it to ' + TO + '.';
      window.location.href = 'mailto:' + TO
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);
    });
  }

  /* ── boot ──────────────────────────────────────────────────── */
  function init() {
    var y = document.querySelector('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
    heroChoreography();
    fluidHero();
    flagshipReveal();
    proofCounters();
    header();
    navState();
    mobileMenu();
    applicationForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();

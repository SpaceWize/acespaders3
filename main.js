/* ═══════════════════════════════════════════════════════════════
   ACE SPADERS — behaviour
   Four motion systems, then chrome. Nothing decorative.
     1. heroChoreography()  pinned, scroll-position-driven hero
        fluidHero()         the hero's fluid surface, part of the same idea
     2. flagshipReveal()    ordered stagger on the core four
     3. proofCounters()     one count-up, once
     4. (CSS) + alsoTileBloom()   hover lift, plus a cursor-trailing reveal
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
    var rafId = 0;

    function setBeat(n, t) {
      var e = easeOut(t);
      stage.style.setProperty('--o' + n, e.toFixed(3));
      stage.style.setProperty('--y' + n, ((1 - e) * 46).toFixed(2) + 'px');
    }

    function frame() {
      ticking = false;
      rafId = 0;
      /* A queued frame outlives the listener that scheduled it. Without this
         guard, a resize across the 901px line lands reset() first and then
         this callback rewrites every property from the narrow layout — where
         travel is a couple of dozen pixels, so p slams straight to 1 and the
         static hero inherits an end-state it should never have animated to. */
      if (!cine.matches) return;
      var top = hero.getBoundingClientRect().top;
      var travel = hero.offsetHeight - window.innerHeight;
      var p = travel > 0 ? clamp(-top / travel, 0, 1) : 0;
      var s = stage.style;

      s.setProperty('--scrim', (0.40 + 0.32 * seg(p, 0.14, 0.80)).toFixed(3));

      // Beat 1 is the landing frame — it is never animated in, so the page
      // never opens on an empty screen. Scroll composes beats 2–4 beneath it.
      // Each beat needs roughly a couple of wheel notches to read as an event;
      // at ~60px it fires faster than the input that drives it and the whole
      // reveal collapses into a single flick. Sized against the 200vh hero.
      setBeat(2, seg(p, 0.08, 0.28));   // headline, line two
      setBeat(3, seg(p, 0.30, 0.50));   // identity paragraph
      setBeat(4, seg(p, 0.48, 0.68));   // calls to action

      // the block rides low while it is still half-empty, then rises
      s.setProperty('--cy', ((1 - easeOut(seg(p, 0.05, 0.66))) * 320).toFixed(1) + 'px');
      s.setProperty('--cue', (1 - seg(p, 0, 0.05)).toFixed(3));

      // Composed from 0.68 to the release, and it stays that way. There is
      // deliberately no fade-out: the copy holds at full strength until the
      // pin lets go and the section scrolls off under the next one.
    }

    function onScroll() {
      if (!ticking) { ticking = true; rafId = requestAnimationFrame(frame); }
    }

    function reset() {
      // drop any frame already in flight, or it will repopulate what we clear
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      ticking = false;
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

    /* Tuned for a live, crisp surface rather than a calm one. Every value here
       is deliberately energetic: the liquid read comes from fast propagation,
       long-lived rings and a hard specular, and softening any of them is what
       previously flattened this into embossed metal. */
    var DAMP = 0.99;          // rings persist ~4s and keep expanding
    // TRAIL_W raised from 30: the spade reveal is slope-driven, and slope is
    // sharpest at a moving disturbance's leading edge and falls off fast
    // behind it — so a weak trail reveals a thin bright line at the cursor
    // tip and almost nothing in its wake, which is what reads as "barely
    // visible" while just hovering. A stronger trail keeps more energy (and
    // more visible spade) in that wake. Per the README, this is the correct
    // knob for more/less of this effect — leave STEP/DAMP/MAX_OFF/xo*5 alone.
    var TRAIL_R = 2, TRAIL_W = 55;    // pointer trail
    var DROP_R = 6, DROP_W = 500;     // click impact
    // The wave front travels exactly one cell per step, so the step rate is
    // the wave speed. 60Hz read as a hair too fast on a longer look; 52Hz
    // (+2.6ms/step) takes the edge off without losing the splash.
    var STEP = 1000 / 52;
    // Raw offsets from a 500-weight drop reach ~60 cells on a 285-wide grid,
    // which samples garbage instead of refracting. 9 is the most the texture
    // takes while still bending the plate hard enough to read as water.
    var MAX_OFF = 9;
    /* The simulation border is never written by simulate() below, so it sits
       fixed at height 0 forever — a rigid wall. A wave that reaches it
       reflects back at full strength instead of dissipating, which reads as
       the surface "bouncing off the sides." This band absorbs it instead:
       extra damping ramping from 10% at the wall to none 16 cells in, applied
       only to that thin border strip so the interior physics are untouched. */
    var EDGE_BAND = 16, EDGE_MIN = 0.90;
    /* Caustics. Light converges where the surface is concave, and concavity is
       the Laplacian of the height field — so this is the real cause of the
       bright banding on a pool floor, not a fake overlay. It is a *linear*
       operator, which is why it survives the ~5x CSS upscale where the earlier
       exponent-16 specular did not: no term here swings dark-to-peak between
       neighbouring cells. Brightens harder than it dims, because converged
       light is what you notice. */
    var CAUS = 0.045, CAUS_UP = 30, CAUS_DN = 15;

    var W = 0, H = 0;
    var cur = null, prev = null;      // the two displacement buffers
    var src = null;                   // source texture pixels
    var img = null, out = null;       // destination ImageData
    var raf = null, onScreen = true, nextAmbient = 0;
    var ptr = null, lastPtr = null;
    var acc = 0, lastT = 0;

    /* The spade plate shows through in proportion to how bent the surface is,
       so calm water is just the gold field and a ripple opens a window onto
       the spades beneath it. Driven by slope rather than height on purpose:
       slope is where refraction actually happens, so the reveal lands exactly
       on the visible structure of the wave instead of on its crests. */
    var SPADE_GAIN = 0.30, SPADE_MAX = 0.90;
    var SPADES_SRC = 'assets/images/gold-spades.jpg';
    var spadeImg = null, spd = null;

    /* ---- source texture -------------------------------------------------
       Warm charcoal field with one key light high-right, and nothing else.
       The lattice that used to live here is gone: the spade plate below is
       what the wave bends now, and unlike the lattice it is only present
       where the water is actually moving. */
    function texture(w, h) {
      var t = document.createElement('canvas');
      t.width = w; t.height = h;
      var g = t.getContext('2d', { willReadFrequently: true });
      var lx = w * 0.74, ly = h * 0.04, lr = w * 0.78;

      var base = g.createLinearGradient(0, 0, w * 0.4, h);
      base.addColorStop(0, '#241E17');
      base.addColorStop(0.45, '#100E0C');
      base.addColorStop(1, '#050505');
      g.fillStyle = base; g.fillRect(0, 0, w, h);

      var key = g.createRadialGradient(lx, ly, 0, lx, ly, lr);
      key.addColorStop(0, 'rgba(240,198,122,.46)');
      key.addColorStop(0.30, 'rgba(232,184,104,.14)');
      key.addColorStop(0.62, 'rgba(190,146,80,.04)');
      key.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = key; g.fillRect(0, 0, w, h);

      return g.getImageData(0, 0, w, h).data;
    }

    /* The plate the ripples open onto. Cover-fit, never tiled — one large
       image, so no repeat seam can ever land inside the frame. Multiplied by
       the same key-light falloff as the field above, so a revealed spade sits
       in the scene's lighting instead of glowing on top of it. */
    function spadePlate(w, h) {
      if (!spadeImg || !w || !h) return null;
      var t = document.createElement('canvas');
      t.width = w; t.height = h;
      var g = t.getContext('2d', { willReadFrequently: true });
      var lx = w * 0.74, ly = h * 0.04, lr = w * 0.78;

      g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);

      var ir = spadeImg.naturalWidth / spadeImg.naturalHeight, cr = w / h;
      var dw, dh;
      if (ir > cr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
      g.drawImage(spadeImg, (w - dw) / 2, (h - dh) / 2, dw, dh);

      g.globalCompositeOperation = 'multiply';
      var kg = g.createRadialGradient(lx, ly, 0, lx, ly, lr);
      kg.addColorStop(0, '#ffffff');
      kg.addColorStop(0.55, '#8f8f8f');
      kg.addColorStop(1, '#2e2e2e');
      g.fillStyle = kg; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';

      return g.getImageData(0, 0, w, h).data;
    }

    /* Loaded once. Until it arrives the hero is simply the gold field with no
       plate to reveal — render() skips the blend rather than waiting on it. */
    (function () {
      var im = new Image();
      im.onload = function () {
        spadeImg = im;
        spd = spadePlate(W, H);
        if (W && H && prev) render(prev);
      };
      im.src = SPADES_SRC;
    })();

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
      var cw = Math.max(1, r.width), ch = Math.max(1, r.height);
      var nw = Math.max(160, Math.min(300, Math.round(cw / 5)));
      var nh = Math.max(100, Math.round(nw * ch / cw));
      if (nw === W && nh === H) return;

      var ow = W, oh = H;
      W = nw; H = nh;
      canvas.width = W; canvas.height = H;
      cur = resample(cur, ow, oh, W, H);
      prev = resample(prev, ow, oh, W, H);
      src = texture(W, H);
      spd = spadePlate(W, H);    // null until the image lands; render() copes
      img = ctx.createImageData(W, H);
      out = img.data;
      out.set(src);              // borders are never rewritten, so seed them
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
       (and on touch devices, where mousemove never fires). Small and sharp,
       scaled against the 500-weight click — a real drop, not a swell, or the
       surface stops reading as liquid when nobody is touching it. */
    function ambient(now) {
      if (now < nextAmbient) return;
      nextAmbient = now + 1400 + Math.random() * 5000;
      drop(5 + Math.random() * (W - 10) | 0, 5 + Math.random() * (H - 10) | 0, 3, 90);
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

    /* Absorbing border, applied to cur (the state simulate() just wrote) right
       before the swap. Four thin strips rather than a per-cell distance check
       over the whole grid, so this costs proportional to the band, not the
       grid — the interior loop above stays exactly as fast as it was. */
    function dampEdges() {
      var w = W, band = EDGE_BAND;
      for (var y = 1; y <= band && y < H - 1; y++) {
        var f = EDGE_MIN + (1 - EDGE_MIN) * (y - 1) / band;
        var rowT = y * w, rowB = (H - 1 - y) * w;
        for (var x = 1; x < w - 1; x++) {
          cur[rowT + x] = (cur[rowT + x] * f) | 0;
          cur[rowB + x] = (cur[rowB + x] * f) | 0;
        }
      }
      for (var x2 = 1; x2 <= band && x2 < w - 1; x2++) {
        var fx = EDGE_MIN + (1 - EDGE_MIN) * (x2 - 1) / band;
        for (var y2 = band + 1; y2 < H - 1 - band; y2++) {
          cur[y2 * w + x2] = (cur[y2 * w + x2] * fx) | 0;
          cur[y2 * w + (w - 1 - x2)] = (cur[y2 * w + (w - 1 - x2)] * fx) | 0;
        }
      }
    }

    function render(buf) {
      var w = W;
      for (var y = 1; y < H - 1; y++) {
        var row = y * w;
        for (var x = 1; x < w - 1; x++) {
          var i = row + x;
          var xo = (buf[i - 1] - buf[i + 1]) >> 3;   // refraction offset
          var yo = (buf[i - w] - buf[i + w]) >> 3;
          if (xo > MAX_OFF) xo = MAX_OFF; else if (xo < -MAX_OFF) xo = -MAX_OFF;
          if (yo > MAX_OFF) yo = MAX_OFF; else if (yo < -MAX_OFF) yo = -MAX_OFF;
          var sx = x + xo, sy = y + yo;
          if (sx < 0) sx = 0; else if (sx >= w) sx = w - 1;
          if (sy < 0) sy = 0; else if (sy >= H) sy = H - 1;
          var s = (sy * w + sx) << 2, d = i << 2;
          // On a near-black field the wave reads through its highlight, not
          // its displacement, so the slope drives brightness as well. This is
          // a hard, linear term on purpose — it is the crispness.
          var sh = xo * 5;
          // Caustic from the local curvature, warm because the light is gold.
          var cz = -(buf[i - 1] + buf[i + 1] + buf[i - w] + buf[i + w] - 4 * buf[i]) * CAUS;
          if (cz > CAUS_UP) cz = CAUS_UP; else if (cz < -CAUS_DN) cz = -CAUS_DN;

          var r0 = src[s], g0 = src[s + 1], b0 = src[s + 2];
          if (spd) {
            // how bent this cell is; the plate is sampled at the refracted
            // position too, so the spades bend with the water rather than
            // showing through it flat
            var amp = (xo < 0 ? -xo : xo) + (yo < 0 ? -yo : yo);
            var m = amp * SPADE_GAIN;
            if (m > SPADE_MAX) m = SPADE_MAX;
            if (m > 0.002) {
              r0 += (spd[s] - r0) * m;
              g0 += (spd[s + 1] - g0) * m;
              b0 += (spd[s + 2] - b0) * m;
            }
          }
          out[d] = r0 + sh + cz;                     // clamped by Uint8ClampedArray
          out[d + 1] = g0 + sh + cz * 0.93;
          out[d + 2] = b0 + sh + cz * 0.76;
        }
      }
      ctx.putImageData(img, 0, 0);
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
        dampEdges();
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

    /* Resize is bound before the reduced-motion guard: build() regenerates the
       texture for the new grid, and that has to happen even when the water
       doesn't run. */
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

  /* ── 4b. SECONDARY-SERVICE BLOOM ────────────────────────────────
     Still motion #4, not a fifth system — the hover lift already there
     (.alsotile:hover in styles.css) gains a second move: a hidden gold-
     spade pattern revealed through a small radial spotlight that trails
     the pointer, lerped in a rAF loop exactly like the hero's cursor-
     tracked bloom in fluidHero()'s sibling project. Skipped entirely
     under (hover:none) or reduced motion — see the matching CSS guard. */
  function alsoTileBloom() {
    if (reduce.matches || !window.matchMedia('(hover: hover)').matches) return;
    var tiles = [].slice.call(document.querySelectorAll('.alsotile'));
    if (!tiles.length) return;

    tiles.forEach(function (tile) {
      var bloom = tile.querySelector('.alsotile__bloom');
      if (!bloom) return;
      var raw = { x: -999, y: -999 };
      var smooth = { x: -999, y: -999 };
      var running = false;

      function loop() {
        smooth.x += (raw.x - smooth.x) * 0.22;
        smooth.y += (raw.y - smooth.y) * 0.22;
        bloom.style.setProperty('--mx', smooth.x.toFixed(1) + 'px');
        bloom.style.setProperty('--my', smooth.y.toFixed(1) + 'px');
        if (Math.abs(raw.x - smooth.x) > 0.4 || Math.abs(raw.y - smooth.y) > 0.4) {
          requestAnimationFrame(loop);
        } else {
          running = false;
        }
      }
      function kick() {
        if (!running) { running = true; requestAnimationFrame(loop); }
      }

      tile.addEventListener('pointermove', function (e) {
        var r = tile.getBoundingClientRect();
        raw.x = e.clientX - r.left;
        raw.y = e.clientY - r.top;
        kick();
      }, { passive: true });
      tile.addEventListener('pointerleave', function () {
        raw.x = -999; raw.y = -999;
        kick();
      });
    });
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

    /* "Regarding" is a checkbox group: valid when at least one box is ticked.
       No individual input can express that, and validate() above would mark
       every unticked box as a failed required field, so the group is checked
       as a unit and its inputs are skipped by the per-field wiring. */
    var group = form.querySelector('[data-checkgroup]');
    var boxes = group ? [].slice.call(group.querySelectorAll('input[type="checkbox"]')) : [];

    function validateGroup() {
      if (!group) return true;
      var any = boxes.some(function (b) { return b.checked; });
      var e = group.querySelector('[data-err]');
      group.classList.toggle('is-bad', !any);
      if (e) e.textContent = any ? '' : (group.getAttribute('data-msg') || 'Pick at least one.');
      boxes.forEach(function (b) { b.setAttribute('aria-invalid', any ? 'false' : 'true'); });
      return any;
    }

    var fields = [].slice.call(form.querySelectorAll('input, select, textarea'));
    fields.forEach(function (f) {
      if (f.type === 'checkbox') {
        // only ever clears an error already showing — never scolds mid-choice
        f.addEventListener('change', function () {
          if (group && group.classList.contains('is-bad')) validateGroup();
        });
        return;
      }
      f.addEventListener('blur', function () { validate(f); });
      f.addEventListener('input', function () {
        if (fieldOf(f).classList.contains('is-bad')) validate(f);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null, groupChecked = false;
      // walked in DOM order, so focus lands on the first problem down the page
      fields.forEach(function (f) {
        var good;
        if (f.type === 'checkbox') {
          if (groupChecked) return;              // the whole group counts once
          groupChecked = true;
          good = validateGroup();
        } else {
          good = validate(f);
        }
        if (!good) { ok = false; if (!first) first = f; }
      });
      if (!ok) {
        status.textContent = 'Fix the highlighted fields and send again.';
        if (first) first.focus();
        return;
      }

      var d = new FormData(form);
      // getAll, not get — "door" is now multi-valued, and a single-value read
      // would silently drop every selection after the first.
      var doors = d.getAll('door').join(', ');
      var subject = 'Application — ' + (doors || 'Ace Spaders');
      var body = [
        'Name: ' + d.get('name'),
        'Email: ' + d.get('email'),
        'Organization: ' + (d.get('org') || '—'),
        'Door: ' + doors,
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
    alsoTileBloom();
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

/* ═══════════════════════════════════════════════════════════════
   ACE SPADERS — behaviour
   Four motion systems, then chrome. Nothing decorative.
     1. heroChoreography()  pinned, scroll-position-driven hero
        heroSpotlight()     the hero's cursor-trailing light, part of the same idea
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

  /* ── 1b. HERO SPOTLIGHT ─────────────────────────────────────────
     A cursor-trailing mask opens onto the hero clip, with a soft warm
     bloom bleeding past it. --mx/--my/--r are set on .hero__stage and
     inherit down to the two CSS layers that draw it — see styles.css.

     This also owns the video's playback, because the two share a trigger:
     the plate is invisible until the pointer is over the stage, so there
     is no reason to decode a frame before then. */
  var VIDEO_SPEED = 1;      // real time; the clip is ~12s, so a full there-
                            // and-back cycle is ~24s

  function heroSpotlight() {
    if (reduce.matches || !window.matchMedia('(hover: hover)').matches) return;
    var stages = [].slice.call(document.querySelectorAll('.hero__stage'));
    if (!stages.length) return;

    stages.forEach(function (stage) {
      var raw = { x: -999, y: -999 };
      var smooth = { x: -999, y: -999 };
      var running = false;

      var video = stage.querySelector('[data-hero-video]');
      var dir = 1;            // 1 = playing forward, -1 = scrubbing back
      var vRaf = 0, vLast = 0, vOn = false;

      /* Ping-pong. The clip's first and last frames do not match, so plain
         `loop` snaps visibly at the wrap. Forward then backward hides that:
         the seam becomes a turn, and every frame on the way back is one the
         viewer saw a moment earlier.

         The forward leg is native playback, not a scrub. Driving both legs by
         writing currentTime every frame made the clip advance only as fast as
         requestAnimationFrame was served — so anything that starved rAF (a
         busy main thread, a throttled tab, a low-power display) stalled the
         picture, and the motion appeared tied to cursor movement rather than
         to time. play() is driven by the media clock instead and keeps going
         on its own.

         Only the return leg scrubs, because no browser honours a negative
         playbackRate. That is affordable here: the clip is encoded with a
         keyframe every 12 frames, which puts a backward seek at ~0.1ms. */
      function forward() {
        dir = 1;
        video.playbackRate = VIDEO_SPEED;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});   // autoplay refusal is fine
      }
      function reverseStep(ts) {
        vRaf = requestAnimationFrame(reverseStep);
        if (!vLast) vLast = ts;
        var dt = (ts - vLast) / 1000;
        vLast = ts;
        if (dt > 0.25) dt = 0.25;                    // came back from a stall
        var t = video.currentTime - dt * VIDEO_SPEED;
        if (t <= 0) { video.currentTime = 0; reverseStop(); forward(); return; }
        video.currentTime = t;
      }
      function reverseStart() {
        if (vRaf) return;
        dir = -1; vLast = 0;
        video.pause();
        vRaf = requestAnimationFrame(reverseStep);
      }
      function reverseStop() {
        if (vRaf) { cancelAnimationFrame(vRaf); vRaf = 0; }
      }
      if (video) {
        // end of the forward leg — turn around rather than stop
        video.addEventListener('ended', function () {
          if (vOn) reverseStart();
        });
      }
      /* halt() stops the picture without forgetting that the pointer is still
         over the stage; videoStop() is the real exit. Keeping those separate
         matters for the tab-switch case below: pausing on hide and clearing
         vOn at the same time left the clip dead on return, because nothing
         restarts it until the pointer moves again — and a pointer already
         parked on the hero never fires another move. */
      function halt() {
        if (!video) return;
        reverseStop();
        video.pause();
      }
      function resume() {
        if (!video) return;
        if (dir === 1) forward(); else reverseStart();
      }
      function videoStart() {
        if (!video || vOn) return;
        vOn = true;
        resume();
      }
      function videoStop() {
        if (!video) return;
        vOn = false;
        halt();
      }

      function loop() {
        smooth.x += (raw.x - smooth.x) * 0.16;
        smooth.y += (raw.y - smooth.y) * 0.16;
        stage.style.setProperty('--mx', smooth.x.toFixed(1) + 'px');
        stage.style.setProperty('--my', smooth.y.toFixed(1) + 'px');
        if (Math.abs(raw.x - smooth.x) > 0.4 || Math.abs(raw.y - smooth.y) > 0.4) {
          requestAnimationFrame(loop);
        } else {
          running = false;
        }
      }
      function kick() {
        if (!running) { running = true; requestAnimationFrame(loop); }
      }

      stage.addEventListener('pointerenter', videoStart);
      stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        raw.x = e.clientX - r.left;
        raw.y = e.clientY - r.top;
        videoStart();          // pointerenter can be missed after a scroll
        kick();
      }, { passive: true });
      stage.addEventListener('pointerleave', function () {
        raw.x = -999; raw.y = -999;
        videoStop();
        kick();
      });
      // Never decode while the tab is hidden, but come back if the pointer
      // is still on the stage when it returns.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) halt();
        else if (vOn) resume();
      });
    });
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
     tracked bloom in heroSpotlight(), which came first — this is the same
     mechanic at card scale. Skipped entirely
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
    heroSpotlight();
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

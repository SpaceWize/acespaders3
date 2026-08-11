# Ace Spaders

Single-page site for Matthew "Ace Spaders" Ferguson — leadership operator, facilitator, representation.

Hand-built HTML / CSS / vanilla JS. No build step, no framework, no animation library.
Open `index.html` or serve the folder:

```bash
python -m http.server 8123
```

## Files

| File | What's in it |
|---|---|
| `index.html` | All markup and copy |
| `styles.css` | Token system + every section, in page order |
| `main.js` | The four motion systems, header, nav, mobile menu, form |

## The motion budget

Four ideas, deliberately capped. Everything else on the page is static, and that
contrast is what signals the hierarchy.

1. **Pinned hero sequence** (`.hero`, `heroChoreography()` + `fluidHero()`) — the stage
   pins for two viewport heights while the headline beats are driven off scroll position,
   over a live fluid surface. The page scrolls normally; input is never hijacked. The pin
   runs only where `(min-width: 901px) and (pointer: fine) and
   (prefers-reduced-motion: no-preference)`; everywhere else the same markup renders as an
   ordinary static hero, with the fluid still running.
2. **Ordered stagger on the flagship four** (`.four`, `flagshipReveal()`) — one
   IntersectionObserver trigger, then CSS walks the items via `--i` at 620ms apart with a
   720ms settle, and the gold spine draws down beside them. Slow and even, no overshoot.
3. **Proof counters** (`.stats`, `proofCounters()`) — one count-up, once, on scroll-in.
   Reduced motion gets the final numbers with no animation.
4. **Hover lift on the secondary services** (`.alsotile`) — shadow lift plus a thin gold
   edge, inside `@media (hover: hover)` only. No scroll-triggered entrance here on purpose.

## Before launch — replace these

Everything below is scaffolding. Each spot is marked `REPLACE:` in the source.

- **`index.html` head** — canonical URL, OG image (`assets/og.jpg`), theme colour if needed.
- **Proof counters** — `data-count` values and labels (currently 18 / 64+ / 11 / 240+).
  Update the `.sr-only` span next to each so screen readers get the same number.
- **Tier specs** — durations, seat counts, availability, and the investment language.
- **About copy** — the three paragraphs are placeholder biography. Swap in real history.
- **Testimonials** — all three quotes, outcome lines, and attributions are placeholders.
  Do not ship them; they are not real reviews.
- **Contact** — `hello@acespaders.com` appears in the header of the contact block, the
  footer, and `TO` in `main.js`.
- **Address** — placeholder (`000 Example Row, Suite 000 · Placeholder City, ST 00000`)
  in three places: the appointment plaque, the contact block's `Office` row, and the
  footer. Replace all three, or drop the street address and keep a city line if you'd
  rather not publish one.
- **Appointment terms** — the days ("Tuesday to Thursday") and concurrency ("three
  engagements at once") in the `#appointment` section are assumptions, not facts.

## The hero fluid surface

`fluidHero()` in `main.js`. Classic 2D water propagation — the Hugo Elias algorithm —
on two alternating displacement buffers:

```js
cur[i] = ((((prev[i-1] + prev[i+1] + prev[i-w] + prev[i+w]) >> 1) - cur[i]) * DAMP) | 0;
```

Buffers swap every step. Rendering refracts a source texture by the local slope
(`getImageData` once for the texture, `putImageData` each frame), and the same slope
drives a hard linear highlight — on a near-black field the wave reads through its
highlight, not its displacement.

**Every value here is tuned energetic on purpose, and that is the whole design.** This
surface has been softened twice and both times it stopped reading as liquid. A gentler
pass (30Hz, `DAMP` 0.985, `MAX_OFF` 7, `xo * 3`) flattened it into embossed metal, and a
later attempt to fix that with a Blinn-Phong specular made it worse in a different way —
an exponent-16 lobe swings from dark to peak across a tiny change in angle, so
neighbouring cells land far apart and the ~5× CSS upscale turned every one of those jumps
into a visible block. Measured: 0.93 mean cell-to-cell roughness against 0.03 for
refraction alone. **Do not soften this again, and do not replace `sh = xo * 5` with a
sharper lighting model.** The crispness *is* the water.

Measured on the same drop, same 285×180 grid, crisp against the gentle tuning:

| at 1.5s | crisp | gentle |
|---|---|---|
| peak highlight | **45** | 21 |
| distorted cells | **10,570** | 3,414 |
| ring span | **133 cells** | 73 |
| mean bend | **0.61** | 0.16 |

By 3s the crisp ring has crossed 224 of 285 cells and still carries a 30-level highlight;
the gentle one stalls at 105 cells and fades to 9.

**On sharpness:** the canvas backing store *is* the simulation grid, and CSS stretches it,
so the browser's bilinear upscale softens the result — more so the larger the display
(~5× at 1440px, ~8.5× at 2560px). That softness is what keeps the refraction reading as
liquid rather than as pixels. If you ever want it crisper, the single knob is the
grid-width cap in `build()`; raising it sharpens at roughly quadratic cost.

| Knob | Value | Why |
|---|---|---|
| Grid width | `≤300`, `cssWidth / 5` | ~50k cells; the canvas backing store *is* the grid, and CSS stretches it, so the browser's bilinear upscale does the softening for free |
| Timestep | fixed **60Hz** accumulator | the wave front travels exactly one cell per step, so the step rate *is* the wave speed — 60Hz is what makes a drop read as a splash. Fixed rather than per-frame because damping and propagation are both per-step, so raw rAF would run 2.4× faster on a 144Hz display |
| `DAMP` | `0.99` per step | rings persist ~4s and keep expanding. Below ~0.985 they stop reading as water |
| `MAX_OFF` | `9` cells | raw offsets from a 500-weight drop reach ~60 cells, which samples garbage instead of refracting. 9 is the most the texture takes while still bending the lattice hard enough to read as water |
| Highlight | `sh = xo * 5` | hard and linear on purpose. Peaks at ±45 on 0-255 — this is the crispness, and softening it is what flattened the surface twice |
| Trail | radius 2, weight 30 | coalesced to one injection per step and interpolated along the path, so a fast sweep leaves a line not dots |
| Click | radius 6, weight 500 | the heavy drop |
| Ambient | radius 3, weight 90, every 1.4–6.4s | small and sharp, scaled against the click — a real drop, not a swell, or the surface stops reading as liquid when nobody is touching it |

If it ever needs to be calmer, lower `DROP_W` and `TRAIL_W` first and leave everything
else alone — those cost the least character per unit of calm. Reaching for `STEP`,
`DAMP`, `MAX_OFF` or the `xo * 5` multiplier is what kills the liquid read.

The texture is a warm charcoal field with one key light high-right and a lattice of gold
hairlines and points. The lattice is the point: straight lines are what make refraction
legible — you read the wave by how the grid bends.

It pauses on `visibilitychange` and when the hero scrolls out of view, resamples the
buffers on resize so live waves survive it, and under `prefers-reduced-motion` renders
the texture once with no loop and no listeners (flat water, so `xo` is zero everywhere and
what you get is the clean lattice). Pointer events pass through the canvas —
the listeners sit on `.hero__stage`, so the CTAs stay clickable (and still splash).

`.hero__scrim` is two layers: a fixed left-side bed that guarantees the headline a dark
surface no matter what the water is doing, and a `::after` atmosphere that deepens with
scroll.

The scrim ramp is load-bearing with the crisp water underneath. The eyebrow's *text* runs
to ~49% of the width (the element is wider, but the glyphs stop there), and the old ramp
had thinned to `.28` by then — measured against the real glyph boxes with twelve
simultaneous 500-weight drops directly beneath, 12px gold fell to **4.08:1**, under the
4.5 floor. Deepening the mid-left to `.90 / .74 @34% / .22 @62% / 0 @80%` brings it to
**5.48:1**, with the headline at 3.81:1 against a 3:1 requirement. The right side still
drops away fast, so the key light and the ripples stay fully open. Fix legibility here,
not by softening the water.

## Imagery

The portrait is a hand-built CSS plate so the page works offline and never shows a broken
image. Swap it for the real thing in one line:

```css
.portrait__art { --plate-src: url('assets/ace.jpg'); }
```

Use a dark, restrained, professional frame — the grain layer sits on top and expects a
low-key image. Serve WebP/AVIF.

## The form

`applicationForm()` validates in place (error text next to the field, `aria-invalid`,
focus moved to the first problem) and then composes a pre-filled email, so the form works
with no backend. To post to a real endpoint instead, set `action` on the `<form>` and
delete the mailto branch at the end of the submit handler.

## Accessibility notes

- Every motion system has a `prefers-reduced-motion` path, and no scroll-jacking runs on
  touch devices or under 901px.
- All body and label text clears 4.5:1 against its surface.
- Skip link, visible gold focus rings, labelled form fields, `aria-expanded` on the menu.
- Type scale is fluid; the hero is capped against viewport height so it fits short laptops.

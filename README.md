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
   pins for ~3 viewport heights while the headline beats are driven off scroll position,
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

## The hero fluid surface

`fluidHero()` in `main.js`. Classic 2D water propagation — the Hugo Elias algorithm —
on two alternating displacement buffers:

```js
cur[i] = ((((prev[i-1] + prev[i+1] + prev[i-w] + prev[i+w]) >> 1) - cur[i]) * DAMP) | 0;
```

Buffers swap every step. Rendering refracts a source texture by the local slope
(`getImageData` once for the texture, `putImageData` each frame), and the same slope
drives a specular term — on a near-black field the wave reads through its highlight, not
its displacement.

| Knob | Value | Why |
|---|---|---|
| Grid width | `≤300`, `cssWidth / 5` | ~50k cells; the canvas backing store *is* the grid, and CSS stretches it, so the browser's bilinear upscale does the softening for free |
| Timestep | fixed **30Hz** accumulator | the wave front travels exactly one cell per step, so the step rate *is* the wave speed — 30Hz reads as a slow swell. Fixed rather than per-frame because damping and propagation are both per-step, so raw rAF would run 2.4× faster on a 144Hz display |
| `DAMP` | `0.985` per step | ~0.64/sec, so a drop breathes out over several seconds instead of snapping back |
| `MAX_OFF` | `7` cells | raw offsets from a heavy drop run to tens of cells, which samples garbage instead of refracting |
| Specular | `xo * 3` | brightness from slope; higher and the wave shouts |
| Trail | radius 2, weight 18 | coalesced to one injection per step and interpolated along the path, so a fast sweep leaves a line not dots |
| Click | radius 6, weight 180 | the heavy drop |
| Ambient | radius 5, weight 22, every 2.8–6.4s | wide and shallow, not small and sharp — the same energy reads as a swell rather than a plink. Measured >200× quieter than a click |

To make it calmer still, lower `DROP_W` and `TRAIL_W` first; to slow it further, raise the
`STEP` divisor. Don't reach for `DAMP` — below ~0.98 the rings stop reading as water.

The texture is a warm charcoal field with one key light high-right and a lattice of gold
hairlines and points. The lattice is the point: straight lines are what make refraction
legible — you read the wave by how the grid bends.

It pauses on `visibilitychange` and when the hero scrolls out of view, resamples the
buffers on resize so live waves survive it, and under `prefers-reduced-motion` renders
the texture once with no loop and no listeners. Pointer events pass through the canvas —
the listeners sit on `.hero__stage`, so the CTAs stay clickable (and still splash).

`.hero__scrim` is two layers: a fixed left-side bed that guarantees the headline a dark
surface no matter what the water is doing, and a `::after` atmosphere that deepens with
scroll. Worst-case measured contrast for the gold eyebrow, with the surface fully
agitated, is 6.6:1.

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

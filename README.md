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

1. **Pinned hero sequence** (`.hero`, `heroChoreography()` + `heroSpotlight()`) — the stage
   pins across `200vh` — one viewport height of travel — while the beats compose off
   scroll position over a cursor-tracked spotlight, then hold at full strength until
   release.

   **The beat spacing is the whole effect, and it is bounded from below.** A beat needs
   roughly 120px of scroll — two wheel notches — to register as an event. Squeezed to
   `150vh`, each beat got 56–64px, which is *less than one notch*: the entire reveal fired
   inside a single flick and read as if there were no reveal at all. At `200vh` each beat
   gets ~160px on an 800px viewport, then 256px of hold. If you shorten the hero again,
   this is what breaks first — and it breaks silently, because nothing errors.

   **There is no scroll-driven fade-out, and that was a deliberate reversal.** One was
   built (`--fade` on `.hero__content`) and it read as the page breaking rather than as an
   exit — copy dimming while the hero still fills the screen looks like a rendering fault,
   not choreography. The pin scrolling away under the next section is already the exit. The
   variable and its CSS binding are gone rather than pinned to 1, so there is nothing left
   to accidentally re-drive.

   The page scrolls normally; input is never hijacked. The pin
   runs only where `(min-width: 901px) and (pointer: fine) and
   (prefers-reduced-motion: no-preference)`; everywhere else the same markup renders as an
   ordinary static hero, with the spotlight still live — it has its own, wider gate (see
   below), so a narrow-but-mouse-driven window still gets the light without the pin.

   Crossing that breakpoint is a **race**, and it has bitten once. `frame()` is scheduled
   through `requestAnimationFrame`, and a queued frame outlives the listener that scheduled
   it — so a resize past 901px ran `reset()` and *then* let the stale frame rewrite every
   property from the narrow layout, where travel is a couple of dozen pixels, `p` slams to
   1, and `--fade` lands on 0. Result: a static hero with invisible copy. `reset()` now
   cancels the pending frame and `frame()` bails when `cine.matches` is false. Keep both;
   either alone leaves a window open.
2. **Ordered stagger on the flagship four** (`.four`, `flagshipReveal()`) — one
   IntersectionObserver trigger, then CSS walks the items via `--i` at 620ms apart with a
   720ms settle, and the gold spine draws down beside them. Slow and even, no overshoot.
3. **Proof counters** (`.stats`, `proofCounters()`) — one count-up, once, on scroll-in.
   Reduced motion gets the final numbers with no animation.
4. **Hover on the secondary services** (`.alsotile`, `alsoTileBloom()`) — shadow lift and a
   thin gold edge, plus a hidden gold-spade pattern (`assets/images/gold-spades.jpg`)
   revealed through a small radial spotlight that trails the cursor, lerped in a rAF loop —
   the same mechanic as the hero's own cursor-tracked bloom, scaled to card size. Still one
   system: the hover lift gained a second move rather than the budget gaining a fifth entry.
   Inside `@media (hover: hover)` only, and off entirely under reduced motion — both the CSS
   mask and the JS listener drop out, not just the visible result. No scroll-triggered
   entrance here on purpose.

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

## The hero spotlight

`heroSpotlight()` in `main.js`, styled by three layers in `styles.css`
(`.hero__spades`, `.hero__glow`, `.hero__rim`) that all read `--mx` / `--my` / `--r` off
`.hero__stage`, which they inherit as CSS custom properties. Replaced an earlier canvas
water simulation — same idea, cursor-reactive light over the gold field, but a mask and a
couple of gradients instead of a physics loop.

**Split into three elements because a mask and a blend mode each apply to one element's
whole paint.** You cannot give one `background-image` layer of a single element its own
`mask-image` while a second layer on that same element gets its own `mix-blend-mode` — so
each visual idea gets its own element instead:

| Layer | Job | How |
|---|---|---|
| `.hero__spades` | the plate the light opens onto | `assets/images/gold-spades.jpg`, `cover` + no-repeat, cut to a circle by a `mask-image: radial-gradient(...)` centred on `--mx`/`--my` |
| `.hero__glow` | warm bloom | a soft radial gradient ~1.9× the reveal radius, `mix-blend-mode: soft-light` so it washes the field around the circle rather than sitting on top of it as a flat patch |
| `.hero__rim` | the beam edge | a thin bright ring exactly at `--r`, plus a darkened ring just past it — this is what makes it read as a light landing on the field rather than a glow fading in |

All three default to `opacity: 0` and `--mx`/`--my: -999px` on `.hero__stage`, so at rest
the hero is only ever the gold radial gradient already on `.hero__stage` — nothing shows
until a real pointer is present. They fade in together on `.hero__stage:hover`, and the
position is lerped toward the real cursor in a `requestAnimationFrame` loop (same pattern
as `alsoTileBloom()`, just one instance per hero instead of one per tile — `heroSpotlight()`
runs over every `.hero__stage` on the page, so it wires the service pages exactly the same
way).

Gated the same way as the tile bloom: skipped entirely — no listener, no visible layer —
under `(hover: none)` or `prefers-reduced-motion: reduce`. This gate is independent of
`heroChoreography()`'s `(min-width: 901px)` cinematic breakpoint, so a narrow-but-mouse-
driven window still gets the spotlight even with the scroll-pin off.

`.hero__scrim` is unchanged by this rewrite and still does the legibility work: a fixed
left-side bed that guarantees the headline a dark surface no matter what the spotlight is
doing, and a `::after` atmosphere that deepens with scroll. It was tuned against the old
water's brightness range; the spotlight's rim and bloom sit in the same range, so the
existing ramp holds. If the light ever gets more intense than that, re-measure against
real glyph boxes — walk to the text nodes, not the element's bounding box. Both obvious
shortcuts lie: `.hero__eyebrow` is a wide flex row whose text stops at 49% of its width,
and `.hero__line` is `display: block`, so `getClientRects` on the element returns
full-width line boxes. Either one samples background far to the right of any actual
letterform and can report a contrast failure that is not real.

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

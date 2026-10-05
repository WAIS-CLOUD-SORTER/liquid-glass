# Material — deep tuning, refraction, support, performance

Contents:
1. [Tuning knobs](#1-tuning-knobs)
2. [Light and dark](#2-light-and-dark)
3. [Edge light and rim craft](#3-edge-light-and-rim-craft)
4. [Tier B — real refraction with SVG](#4-tier-b--real-refraction-with-svg)
5. [Browser support matrix](#5-browser-support-matrix)
6. [Performance pitfalls](#6-performance-pitfalls)
7. [Failure modes and fixes](#7-failure-modes-and-fixes)

## 1. Tuning knobs

Everything worth adjusting is a token. Change the variable, never the rule.

| Token | Range | Effect | Guidance |
| --- | --- | --- | --- |
| `--glass-blur` | 8–40px | How far behind the content dissolves | 14–24px for controls; 32–40px for sidebars/large sheets. More blur ≠ more premium; past ~40px it becomes flat fog. |
| `--glass-fill` | 0.10–0.95 | Body opacity | 0.40–0.50 default. Over photos/tables raise it (0.55–0.70); over plain backgrounds lower it (0.25–0.35). |
| `--glass-sat` | 100–200% | Saturation of what's behind | ~150–180% keeps colors alive through the glass; 100% looks cheap, >200% looks neon. |
| `--glass-rim` | 0.25–0.75 | Specular rim strength | 0.55 light mode, 0.35 dark. Lower it over bright photography so the rim doesn't disappear, raise it over dark media. |
| `--glass-lift` | shadow | Separation from content | Heavier over busy/text content, lighter over plain. |
| `--glass-radius` | 16–44px | Shape | Follow concentricity; big surfaces track the container, controls get 12–20px or a capsule. |

Two tunings people miss:

- **Blur radius should scale with surface size.** A 40px-tall pill wants ~14px; a full-height sidebar wants ~36px. Using one value everywhere makes small controls look frosted-over and big ones look sharp.
- **Fill must scale with what's behind.** The real variable is *contrast of the backdrop*, not the designer's taste. Busy backdrop → raise fill; plain → lower it.

## 2. Light and dark

Dark glass is not "light glass with the tint flipped":

```css
.dark {
  --glass-tint: 26 26 30;
  --glass-fill: 0.40;         /* slightly lower: dark surfaces read heavier */
  --glass-rim: 0.35;          /* weaker white rim, or it glares */
  --glass-lift: 0 12px 32px rgb(0 0 0 / 0.45);   /* darker theme needs a deeper shadow to lift */
  border-color: rgb(255 255 255 / 0.14);
}
```

- In dark mode the inner white glow (`inset 0 0 24px rgb(255 255 255 / .10)`) should drop to ~0.06 — otherwise the surface looks milky.
- In light mode, add a faint *dark* hairline (`inset 0 0 0 1px rgb(0 0 0 / .05)`): on a white page the rim alone doesn't define the silhouette.
- Adaptive tint: for glass over a known brand color, tint with a small alpha of that color instead of neutral gray — that's the vibrancy idea (color lives on a solid layer, not on the text).

## 3. Edge light and rim craft

The rim is what separates "glass" from "blurred div". Build it from three separate signals, weakest to strongest:

1. **Hairline silhouette** — `inset 0 0 0 1px` in a contrasting color (dark on light, light on dark).
2. **Top catch light** — `inset 0 1px 0` white at `--glass-rim`. This is directional: light comes from above.
3. **Bottom bounce** — `inset 0 -1px 0` white at ~45% of the rim. Real glass reflects the floor back; without this the bottom edge looks cut off.

For a curved/lens edge, add a pseudo-element with an angular gradient masked to the border area:

```css
.glass--lens::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;                       /* rim thickness */
  background: conic-gradient(from 210deg,
    rgb(255 255 255 / .7), rgb(255 255 255 / .1) 30%,
    rgb(255 255 255 / .45) 55%, rgb(255 255 255 / .08) 80%,
    rgb(255 255 255 / .7));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
  pointer-events: none;
}
```

This is the standard gradient-border technique: padding defines the ring, mask XOR keeps only the ring. It reads as light wrapping a curved edge — much closer to Liquid Glass than a uniform `border`.

## 4. Tier B — real refraction with SVG

Tier B warps the backdrop itself. The mechanism: an SVG **displacement map** — an image whose red channel shifts pixels horizontally and green channel shifts them vertically — fed to `feDisplacementMap`, applied as `backdrop-filter`.

Channel semantics: `0x80` (128) = no displacement, `0x00` = full negative shift, `0xFF` = full positive shift; the `scale` attribute multiplies the result. So a map that is neutral `#808080` in the middle and ramps toward the edges bends only the border region — the lens effect.

```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="lg-refract" x="-5%" y="-5%" width="110%" height="110%"
          color-interpolation-filters="sRGB">
    <feImage href="assets/refraction-map.svg" result="map"
             preserveAspectRatio="none" x="-5%" y="-5%" width="110%" height="110%"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="base"/>
    <feDisplacementMap in="base" in2="map" scale="36"
                       xChannelSelector="R" yChannelSelector="G" result="lens"/>
    <feColorMatrix in="lens" type="saturate" values="1.4"/>
  </filter>
</svg>
```

```css
.glass--refract {
  -webkit-backdrop-filter: url(#lg-refract) blur(6px) saturate(var(--glass-sat));
  backdrop-filter: url(#lg-refract) blur(6px) saturate(var(--glass-sat));
}
```

The map (`assets/refraction-map.svg`) is two linear ramps — one horizontal for R, one vertical for G — combined with `mix-blend-mode: lighten` so neither channel clobbers the other, both neutral (`#808080`) through the middle so only the borders bend. It ships as a real file next to the page (`feImage` needs a resolvable URL); inlining it as a `data:` URI also works.

**Get these details right** — they're what makes it work rather than glitch:

- Keep the filter region and the `feImage` box in sync (`x/y/width/height` identical on both). Offset them slightly past the element (−5%/110%) so the extreme end of the ramp falls *outside* the visible box — otherwise the borders clamp to the region edge and show bright bands.
- `color-interpolation-filters="sRGB"` — without it, filters run in linearRGB and the colors come out washed.
- `preserveAspectRatio="none"` on the map so it stretches to any element size.

Honest constraints — state them if you use Tier B:

- **`backdrop-filter: url(#…)` is Chromium-only.** Safari and Firefox ignore the whole declaration, so always keep the Tier A filter in a separate rule that the refraction rule overrides, and feature-detect:
  ```js
  const refracts = CSS.supports('backdrop-filter', 'url(#lg-refract) blur(10px)');
  ```
- **The map must match the element's box.** `preserveAspectRatio="none"` + percentage sizing stretches it; if a component resizes constantly, the filter region (`x/y/width/height`) and the map need to follow, or the lens drifts off the edge.
- **It is expensive.** Displacement + blur over a moving backdrop is a per-frame GPU cost; use it on a handful of hero elements, not on a list of 50 rows.
- **Tuning is visual, not formulaic.** Start at `scale="36"`; 20 is a barely-there rim, 60+ is a heavy magnifier. The ramp stops in the map control *where* the bend happens: neutral band 0.14–0.86 → lensing confined to the outer ~14% (the reference look); widen the neutral band and you get an all-over zoom instead of an edge lens. Rebuild the map when the corner radius changes drastically.
- **Real refraction bends content *outside* the element's bounds**, which `backdrop-filter` cannot do (it only samples the backdrop within the border box). Perfect parity with true lensing would need a shader; Tier B is an approximation inside the box.

## 5. Browser support matrix

| Capability | Chrome/Edge | Safari | Firefox | What to do |
| --- | --- | --- | --- | --- |
| `backdrop-filter: blur()` | ✅ | ✅ (keep `-webkit-backdrop-filter`) | ✅ | Tier A baseline |
| `backdrop-filter: url(#svg)` | ✅ | ❌ | ❌ | Tier B = progressive enhancement only |
| `mask-composite: exclude` gradient rim | ✅ | needs `-webkit-mask-composite: xor` | ✅ | include both declarations |
| `prefers-reduced-transparency` | ✅ | ✅ | ❌ **not implemented** | see the note below — ship `glass--solid` as a real setting |
| `prefers-contrast` | ✅ | ✅ | ✅ | `@media (prefers-contrast: more)` |
| `prefers-reduced-motion` | ✅ | ✅ | ✅ | freeze the sheen, keep short cross-fades |
| `forced-colors` | ✅ | partial | ✅ | Windows High Contrast; protect the silhouette |
| `@property` | ✅ | ✅ | ✅ | without it, custom properties cannot interpolate |
| `corner-shape` | emerging | — | — | optional polish; verify before relying on it |

### The Firefox gap you cannot query your way out of

Firefox does not implement `prefers-reduced-transparency`, and **no web API exposes the OS setting**, so there is nothing to feature-detect and nothing to polyfill. A `@media` block is therefore a partial guarantee: it covers Chrome and Safari and silently does nothing in Firefox.

The honest pattern is to let the automatic path cover who it can, and give everyone else a switch:

```css
/* automatic, where the OS setting is readable */
@media (prefers-reduced-transparency: reduce) {
  .glass { --glass-fill: .95; --glass-blur: 0px; --glass-sheen: 0; /* … */ }
}

/* explicit, everywhere — wire this to a setting in your own UI */
.glass--solid {
  --glass-fill: .95; --glass-blur: 0px; --glass-sheen: 0;
  --glass-border: rgb(0 0 0 / .18); --glass-lift: 0 4px 16px rgb(0 0 0 / .18);
}
.dark .glass--solid { --glass-border: rgb(255 255 255 / .25); }
```

Both paths set the same tokens deliberately, so they cannot drift.

### Windows High Contrast

In forced-colors mode the UA overrides colours and drops `box-shadow`, which removes *every* cue this material is built from — rim, glow, lift. The surface stays legible, but it loses its silhouette and starts bleeding into the page. Give it a real border:

```css
@media (forced-colors: active) {
  .glass { background: Canvas; border: 1px solid CanvasText; box-shadow: none; }
}
```

Do not reach for `forced-color-adjust: none` to keep the translucency — that opts the surface *out* of the palette the user chose, which is the one thing that mode exists to prevent.

Always ship:

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: rgb(var(--glass-tint) / 0.92); }   /* solid, still legible */
}
```

## 6. Performance pitfalls

- **Backdrop reads are not free.** Every frame the backdrop changes (scroll, video, animation), each glass element re-blurs its region. Budget: prefer 1–3 large glass surfaces over 12 small ones in the same viewport.
- **Never animate `backdrop-filter` or `box-shadow` blur.** Animate `transform` and `opacity`; let the material "arrive" by scaling and fading.
- **Nested glass double-blurs.** An inner glass samples the outer glass's *already filtered* output — cost doubles and the look goes milky. Flatten: one glass layer, plain children inside.
- **Backdrop roots cut the effect off.** An ancestor with `filter`, `opacity < 1`, `mask`, or `will-change: filter/opacity/mask` starts a new backdrop root; glass inside it blurs only what's behind *that* ancestor (often nothing). Symptom: a glass panel that looks like a plain semi-transparent box. Fix: hoist the glass, or remove the ancestor's property.
- **Fixed-position glass over scrolling content** is the classic mobile jank source. Keep the blur modest, avoid `backdrop-filter` on elements that also have expensive `box-shadow` spread, and test on a real device or with CPU throttling in DevTools.
- **`overflow: hidden` is necessary and it bites.** It clips children to the radius, but it also clips any absolutely-positioned descendant — a dropdown, a tooltip, a context menu rendered inside a glass panel will be cut off at the panel edge with no visible cause. Portal menus to the surface element instead of nesting them, or move the menu outside the panel in the DOM.
- **Fixed glass over scrolling content** is the classic mobile jank source. Keep the blur modest and test on a real device or with CPU throttling.

## 7. Failure modes and fixes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Looks like a plain translucent box | No rim/light; ancestor created a backdrop root | Add the three rim signals; check ancestors for `filter`/`opacity`/`will-change` |
| Text unreadable over glass | Fill too low, mid-gray text | Raise `--glass-fill` to ≥ 0.85, weight ≥ 500, real contrast |
| Milky / washed out | Blur too high + fill too high + nested glass | Lower blur, lower fill, flatten nesting |
| Rim glares in dark mode | `--glass-rim` copied from light | Drop rim and inner glow in `.dark` |
| Corners don't nest | Child radius not concentric, **or the radius tokens are never declared** | `child = container − inset`; check `--radius-window`/`--inset` resolve — an undeclared var makes the `calc()` invalid and the radius collapses to 0 |
| Effect vanishes in Safari/Firefox | Tier B used as baseline | Ship Tier A first, refraction behind `@supports` |
| No effect for reduced-transparency users | Missing media query, or a hardcoded `background` overriding it | Add the block; make the fallback set tokens, not raw colours |
| Same, in Firefox only | `prefers-reduced-transparency` is unimplemented there | Ship `glass--solid` as a user-facing setting |
| Surface merges into the page in High Contrast | `forced-colors` drops every rim/glow cue | `@media (forced-colors: active)` with a real `CanvasText` border |
| Jank on scroll | Many/large blurs, animated filter | Fewer surfaces, ≤24px blur, animate transform/opacity only |
| Dropdown clipped by its panel | `overflow: hidden` on `.glass` | Portal the menu out of the surface |
| OS is dark but the page is light | Only a `.dark` class, no `prefers-color-scheme` | Add the media query with `.light` as the escape hatch; set `color-scheme` |
| Glass looks flat over photos | No scrim, no separation | `glass--clear` + dim scrim behind, heavier rim |

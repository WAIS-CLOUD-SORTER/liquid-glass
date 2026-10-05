---
name: liquid-glass
description: >-
  Build Apple's Liquid Glass (iOS 26 / macOS Tahoe 26, WWDC25) on the web — translucent,
  refractive, light-reactive floating UI in CSS, Tailwind v4 and React — and natively in
  SwiftUI/UIKit/AppKit. Use whenever creating or styling any glassmorphism / frosted-glass /
  translucent surface: toolbars, tab bars, sidebars, nav bars, floating buttons, toggles,
  sliders, sheets, popovers, menus, cards, badges, search fields, app icons, hero overlays.
  Trigger on "Liquid Glass", "liquid glass effect", "glassEffect", "glassEffect()", "iOS 26
  design", "Apple's new design language", "WWDC25 look", "concentric corners", "edge refraction",
  "specular highlight", "adaptive glass", or a request to make UI look like "Apple's new OS",
  "glassy" or "Apple-futuristic". Also use to review or fix existing glassmorphism that looks
  cheap, milky or unreadable — for hierarchy, legibility, contrast, accessibility or performance
  — even when the user never says "Liquid Glass" and only says "this looks generic" or "this
  looks washed out".
---

# Liquid Glass

When invoked without a specific task, reply with exactly one line and wait:

> Liquid Glass ready — name the surface (toolbar, tab bar, card, button, popover…) and the stack, and I'll build it.

Apple's Liquid Glass is a **material, not a skin**: it refracts the content below it, reflects light from around it, and lenses along its edges, so controls read as physical objects floating above the content instead of panels pasted on it. Three principles from Apple's WWDC25 guidance govern every decision below — **hierarchy** (glass is a functional layer floating *above* content), **harmony** (the glass adapts to what is underneath), **consistency** (the same material everywhere, at every size).

Motion feel, springs and typography live in the `apple-design` skill — this skill owns the material. When both matter, read both.

## The one rule that decides most builds

Before anything else, sort every surface into **floating** or **reading**:

| | Floating chrome | Reading surface |
| --- | --- | --- |
| Examples | toolbar, tab bar, sidebar, FAB, popover, toast, search field, slider | cards in flow, article body, tables, forms, dashboards, charts, long text |
| Fill | 0.35–0.55 (whatever looks best over the media) | **≥ 0.85, or no glass at all** |
| Why | nobody reads through it; translucency is the whole point | the reader is decoding text through a blur on a moving backdrop |

A surface at fill 0.5 that holds the words someone came to read is the single most common way a "Liquid Glass" build fails — and it looks fine in a screenshot over a calm background, which is why it survives to review. **When in doubt, make it opaque.** Glass earns its place on the chrome around the content, never on the content.

Also never: stack light glass on light glass (the inner layer blurs an already-blurred backdrop and legibility collapses), or put a mid-alpha surface inside a mid-alpha one. Inside glass, an element is either near-opaque (≥ 0.85) or a low-alpha wash (≤ 0.15).

## Step 0 — pick the fidelity tier

| Tier | What you get | Support | Use when |
| --- | --- | --- | --- |
| **A — Layered glass** (default) | Blur + saturation + tinted fill + specular rim + lift shadow | All modern browsers | Almost every case. Ship this first. |
| **B — Add refraction** | Tier A + real edge lensing via an SVG displacement filter | **Chromium only** (`backdrop-filter: url(#…)`) | The user explicitly wants true lensing/refraction, and cross-browser is not required |
| **C — WebGL / shader glass** | Physically-based refraction | Everywhere (custom canvas) | Never by default. Only for a hero/showcase piece worth the code |

Tier A is not a consolation prize — Apple's own controls read mostly as *frosted, tinted, edge-lit glass*. Get hierarchy, rim light and concentricity right in Tier A before even thinking about refraction. If you go Tier B, ship Tier A as the fallback behind `@supports`/`CSS.supports`, because Safari and Firefox drop the effect entirely otherwise.

## Where glass belongs

Use it for nav/toolbars, tab bars, sidebars, status bars, floating palettes; controls that hover over content (buttons, toggles, sliders, segmented controls, FABs); ephemeral surfaces (popovers, menus, sheets, toasts, tooltips, scrims); and badges, pills, capsules, app-icon-like objects.

Do **not** use it for page/body backgrounds or long reading surfaces; content cards that sit in the document flow; dense data read for minutes at a time; light glass stacked on light glass; or custom chrome painted on top of controls that should recede (Apple asks you to *remove* custom backgrounds from controls, not multiply them).

Glass must have **clear separation from the content beneath** — a defined rim plus a lift shadow. Without it the edge dissolves and text under the glass fights text over it.

## Concentricity — the rule that makes it look Apple

Every nested rounded rectangle must be concentric with its container: the child's corner radius = **container radius − inset padding**, so the two corners share a centre. The tokens are declared in `assets/liquid-glass.css`, so this works the moment you import the sheet:

```css
--radius-window: 44px;   /* the container   */
--inset: 12px;           /* the padding     */

.toolbar     { border-radius: var(--radius-window); }
.toolbar .btn{ border-radius: calc(var(--radius-window) - var(--inset)); }
```

- Insetting a child on both sides shrinks the radius by the inset **once**, because both edges move.
- A glass surface nested in another glass surface can just take `glass glass--concentric`.
- Standalone, unnested controls use their own token (`--radius-control: 16px`) rather than the formula.
- Large containers hug the hardware/window corners (big radius); **big controls become capsules** (`999px`), small ones keep a modest radius.
- Apple's shapes are continuous (squircle). `border-radius` gives circular corners — acceptable parity. Use `corner-shape`/clip-path only if you are chasing pixel parity and have verified support.

## The material — Tier A core recipe

The canonical stylesheet is `assets/liquid-glass.css`; `@import` it and you are done. Paste this only when you cannot ship a file (a single self-contained HTML page, an inline `<style>`, a Tailwind `@utility`). **These values must match the stylesheet** — `scripts/check-glass.mjs` compares them, so drift gets caught rather than shipped.

```css
@property --glass-fill   { syntax: "<number>";     inherits: true; initial-value: 0.46; }
@property --glass-sheen  { syntax: "<number>";     inherits: true; initial-value: 0.28; }
@property --glass-mx     { syntax: "<percentage>"; inherits: true; initial-value: 50%;  }
@property --glass-my     { syntax: "<percentage>"; inherits: true; initial-value: 0%;   }
@property --glass-radius { syntax: "<length>";     inherits: true; initial-value: 28px; }
@property --glass-blur   { syntax: "<length>";     inherits: true; initial-value: 22px; }

:root {
  color-scheme: light dark;
  --glass-radius: 28px;  --glass-blur: 22px;  --glass-sat: 180%;
  --glass-fill: 0.46;  --glass-tint: 255 255 255;
  --glass-rim: 0.55;  --glass-glow: 0.10;
  --glass-lift: 0 12px 32px rgb(0 0 0 / 0.18);
  --glass-hairline: rgb(0 0 0 / 0.05);
  --glass-border: rgb(255 255 255 / 0.22);
  --glass-mx: 50%;  --glass-my: 0%;  --glass-sheen: 0.28;
}

.glass {
  position: relative;
  border-radius: var(--glass-radius);
  /* sheen first, so it sits *under* the text rather than over it */
  background:
    radial-gradient(60% 80% at var(--glass-mx) var(--glass-my),
      rgb(255 255 255 / var(--glass-sheen)), transparent 62%),
    linear-gradient(to bottom,
      rgb(var(--glass-tint) / calc(var(--glass-fill) + 0.10)),
      rgb(var(--glass-tint) / var(--glass-fill)));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid var(--glass-border);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / var(--glass-rim)),                /* top catch light */
    inset 0 -1px 0 rgb(255 255 255 / calc(var(--glass-rim) * 0.45)), /* bounce off the floor */
    inset 0 0 24px rgb(255 255 255 / var(--glass-glow)),              /* thickness */
    inset 0 0 0 1px var(--glass-hairline),                            /* silhouette */
    var(--glass-lift);                                                 /* separation */
  overflow: hidden;
}
```

Dark theme is a variable swap, not a second material. Declare the dark palette once and assign it from whichever trigger is active:

```css
:root { --dark-tint: 26 26 30; --dark-fill: 0.40; --dark-rim: 0.35; --dark-glow: 0.06;
        --dark-lift: 0 12px 32px rgb(0 0 0 / 0.45);
        --dark-hairline: rgb(255 255 255 / 0.10); --dark-border: rgb(255 255 255 / 0.14); }

.dark { --glass-tint: var(--dark-tint); --glass-fill: var(--dark-fill); /* …all seven */ }

@media (prefers-color-scheme: dark) {
  :root:not(.light) { color-scheme: dark; --glass-tint: var(--dark-tint); /* …all seven */ }
}
```

Anatomy, weakest cue to strongest — this is what to reason with when tuning:

1. **Backdrop** — `blur` + `saturate` is what makes the content behind read as *through glass*. 16–24px for controls, 32–40px for large surfaces.
2. **Tinted fill** — a vertical gradient brighter at the top gives the body volume. Never pure `transparent`; tint with the surface colour so both themes hold.
3. **Specular rim** — the top edge highlight is the single strongest "this is glass" signal. Kill it and the element is a blurred div.
4. **Inner glow** — sells thickness. Bigger surfaces get more.
5. **Lift shadow** — separates glass from content; heavier over busy or textual backdrops.
6. **Sheen** — reactive light, driven by CSS variables so it costs no JS layout work.

### Variants

| Class | Fill | Blur | Use for |
| --- | --- | --- | --- |
| *(none)* | .46 | 22 | the default floating surface |
| `glass--clear` | .16 | 10 | over photos/video, where content must dominate (add a dimming scrim) |
| `glass--heavy` | .62 | 36 | structural: sidebars, sheets, modals |
| `glass--prominent` | .55 | — | primary actions and badges; tints to Apple blue `0 122 255` |
| `glass--sm` | .46 | 14 | chips and small controls (radius 16px) |
| `glass--capsule` | — | — | large controls (`border-radius: 999px`) |
| `glass--concentric` | — | — | nested in another glass surface (radius − `--inset`) |
| `glass--solid` | .95 | 0 | explicit opaque surface; also the reduce-transparency opt-in |

Pick the variant from the *content behind*, not from taste, and never mix two variants inside one surface.

## Motion — the glass must feel reactive

- **Sheen follows the interaction.** Move `--glass-mx/--glass-my` from pointer position or scroll offset, rAF-throttled. One property write, compositor-friendly.
- **Materialize, don't fade.** Enter/exit animate `transform` + `opacity` **together** with the surface: `scale(0.96)` + `opacity 0` → rest. Never animate `blur()` radius or `backdrop-filter` — that forces a repaint every frame and drops frames.
- **Register the tokens you intend to ease.** An unregistered custom property is a string: `transition: --glass-fill 200ms` silently does nothing, and a gradient reading it snaps instead of interpolating. The `@property` block above declares the six that are worth easing; `--glass-tint` and `--glass-lift` stay unregistered because their values are composites, not scalars.
- **Press = spring up.** On `:active`, `scale(0.97)` immediately, plus a small sheen lift. Release springs back.
- **Morph between states.** Collapsing a toolbar into a pill, or a control receding when the user scrolls to focus content, is a `border-radius`/`transform` transition — Apple's controls "recede when content matters, expand the moment they're needed".
- **Anchor to the source.** Popovers and menus grow from the trigger (`transform-origin` at the button).

## Accessibility — non-negotiable, and design it in from the start

Glass degrades legibility, so the fallback is part of the component, not an afterthought. `assets/liquid-glass.css` ships all of these; paste them if you are inlining:

```css
@media (prefers-reduced-transparency: reduce) {          /* Apple's "Reduce Transparency" */
  .glass { --glass-fill: 0.95; --glass-blur: 0px; --glass-sheen: 0;
           --glass-border: rgb(0 0 0 / 0.18); --glass-lift: 0 4px 16px rgb(0 0 0 / 0.18); }
  .dark .glass { --glass-border: rgb(255 255 255 / 0.25); }
}
@media (prefers-contrast: more) {
  .glass { --glass-fill: 0.96; --glass-blur: 0px; --glass-rim: 0; --glass-glow: 0;
           --glass-border: rgb(0 0 0 / 0.75); }
  .dark .glass { --glass-border: rgb(255 255 255 / 0.9); }
}
@media (prefers-reduced-motion: reduce) {
  .glass { --glass-mx: 50%; --glass-my: 0%; --glass-sheen: 0.18;
           transition: none !important; animation: none !important; }
}
@media (forced-colors: active) {        /* Windows High Contrast */
  .glass { background: Canvas; border: 1px solid CanvasText; box-shadow: none; }
}
@media print { .glass { background: none; border: 1px solid #999; box-shadow: none; } }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: rgb(var(--glass-tint) / 0.92); }   /* solid, still legible */
}
```

- **Firefox does not implement `prefers-reduced-transparency`**, and no web API can read the OS setting there. So that media query is a partial guarantee. If it matters to your users, expose `glass--solid` as a real toggle in your own settings UI and let the query be the automatic half.
- Text over glass needs real contrast: weight ≥ 500, letter-spacing near 0, dark text on light glass and light text on dark glass. **Never mid-gray on translucent white.** If you cannot hit contrast, the surface is too transparent — raise `--glass-fill` rather than darkening the text.
- Every interactive glass element keeps a visible focus ring — a bright ring reads well on glass (`outline: 2px solid rgb(255 255 255 / .9); outline-offset: 2px` in dark contexts).
- `forced-colors` needs protecting because it removes exactly the cues this material is built from: every rim and glow inset disappears, so the surface needs a real 1px border to keep its silhouette.

## Performance — glass is not free

Each `backdrop-filter` reads and blurs the pixels behind it, every frame that backdrop changes.

- Count live glass surfaces over **scrolling** content. Prefer one large glass region over many small ones, and fewer bigger blurs over a grid of chips.
- Keep blur ≤ 24px for controls, ≤ 40px for big surfaces; past that the cost climbs and the look turns to fog.
- Animate only `transform`/`opacity`; move the sheen with CSS variables, never with layout reads.
- Nested glass double-blurs — the inner element samples the outer one's already-filtered output. Flatten the hierarchy.
- If a glass element blurs *nothing*, an ancestor with `filter`, `opacity < 1`, `mask` or `will-change: filter` created a new backdrop root. Move the glass up the tree or drop that property.
- `overflow: hidden` on `.glass` clips children to the radius — necessary, but it also clips an absolutely-positioned dropdown rendered inside. Portal menus out of the glass instead of nesting them.

## Workflow

1. **Route by stack, then by surface.** Both, in this order:

   | If the task is… | Load | Skip |
   | --- | --- | --- |
   | plain CSS / HTML | *nothing extra — the recipe above is enough* | all 7 refs |
   | Tailwind v4 / React / shadcn | `references/react-tailwind.md` | material, swiftui |
   | Vue, Svelte, Astro, Solid, Tailwind v3, CSS-in-JS | `references/frameworks.md` | swiftui |
   | iOS / macOS / Catalyst | `references/swiftui.md` | all web refs |
   | true edge refraction / Tier B | `references/material.md` §4, then `references/refraction-advanced.md` | components* |
   | a specific surface (toolbar, sheet, toast, form, chart…) | `references/components.md`, then `references/components-advanced.md` if it is one of the hard ones | the other refs |
   | **reviewing or fixing existing glass** | `references/review.md` | components* |
   | auditing against the rules mechanically | `node scripts/check-glass.mjs <file>` | — |

2. **Sort every surface floating vs reading** (see the top of this file) before writing any CSS. This is the decision everything else hangs off.
3. **Drop in the tokens** before styling: set `--glass-*` once at `:root`/theme level so light, dark and the variants stay a variable swap.
4. **Place the material by role**, then apply concentricity to every nested rounded child.
5. **Add the reactive layer** (sheen + press) and the accessibility fallbacks.
6. **Verify** — run the checker, then look at it:

   ```bash
   node scripts/check-glass.mjs your-file.css     # add --strict in CI
   ```

   It catches dangling tokens, glass nested in glass, reading surfaces under 0.85 fill, animated filters, hardcoded token literals, and missing fallback blocks. Then screenshot the result over a **busy** background *and* a **plain** one — glass that only works on one of them is not finished.

## Checklist

- [ ] Every surface sorted floating or reading; reading surfaces ≥ 0.85 fill or opaque
- [ ] No glass nested inside glass; no mid-alpha surface inside a mid-alpha one
- [ ] Top-edge specular rim present; silhouette defined (not just a blurred rectangle)
- [ ] Tinted vertical fill, light *and* dark legible; `color-scheme` set
- [ ] Child radii concentric with their container; capsules for large controls
- [ ] Glass only on floating/functional surfaces — no full-screen or reading glass
- [ ] Rim + lift shadow give separation from the content beneath
- [ ] Sheen reacts to pointer/scroll; enter animates transform+opacity, never blur
- [ ] `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion`, `forced-colors` handled
- [ ] Text on glass hits contrast (weight ≥ 500, no mid-gray)
- [ ] `@supports not (backdrop-filter)` fallback present
- [ ] Glass surface count and blur radii within budget
- [ ] `node scripts/check-glass.mjs <file> --strict` is clean

## Where to go next

- `references/material.md` — deep material tuning, Tier B refraction, browser support matrix, perf pitfalls, failure modes
- `references/components.md` — toolbar, tab bar, sidebar, button, card, sheet, popover, slider, search field recipes
- `references/components-advanced.md` — tooltips, toasts, drag sheets, forms/inputs, dashboards, app-icon launcher
- `references/react-tailwind.md` — Tailwind v4 `@utility`, React `<Glass>` wrapper with pointer sheen, shadcn/ui
- `references/frameworks.md` — Vue, Svelte, Astro, Solid, Tailwind v3 plugin, CSS-in-JS, SSR
- `references/swiftui.md` — native `.glassEffect()`, `GlassEffectContainer`, `UIGlassEffect`, AppKit bezel
- `references/refraction-advanced.md` — pointer-tracking lens, `make-refraction-map.mjs`, Tier C WebGL/three.js
- `references/review.md` — **auditing glass that already exists**: the failure catalogue, the order to fix it in, the report format
- `assets/liquid-glass.css` — the complete drop-in stylesheet (tokens, variants, states, fallbacks, dark mode, print)
- `assets/refraction-map.svg` + `assets/make-refraction-map.mjs` — the Tier B displacement map and the Node script that regenerates it
- `scripts/check-glass.mjs` — static checker for the rules above; `--json` for a machine-readable report

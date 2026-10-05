---
name: liquid-glass
description: >-
  Build Apple's Liquid Glass (iOS 26 / macOS Tahoe 26, WWDC25) on the web — translucent,
  refractive, light-reactive floating UI in CSS, Tailwind v4 and React — and natively in
  SwiftUI/UIKit/AppKit. Use whenever creating or styling any glassmorphism / frosted-glass /
  translucent surface: toolbars, tab bars, sidebars, nav bars, floating buttons, toggles,
  sliders, sheets, popovers, menus, cards, badges, search fields, app icons, hero overlays.
  Trigger on "Liquid Glass", "liquid glass effect", "glassEffect", "glassEffect()", "iOS 26
  design", "Apple's new design language", "WWDC25 look", "concentric corners", "edge
  refraction", "specular highlight", "adaptive glass", or a request to make UI look "like
  Apple's new OS", "glassy" or "Apple-futuristic". Also use to review existing glassmorphism
  for hierarchy, legibility, accessibility or performance — even when the user never says
  "Liquid Glass".
---

# Liquid Glass

When invoked without a specific task, reply with exactly one line and wait:

> Liquid Glass ready — name the surface (toolbar, tab bar, card, button, popover…) and the stack, and I'll build it.

Apple's Liquid Glass is a **material, not a skin**: it refracts the content below it, reflects light from around it, and lenses along its edges, so controls read as physical objects floating above the content instead of panels pasted on it. Three principles from Apple's WWDC25 guidance govern every decision below — **hierarchy** (glass is a functional layer floating *above* content), **harmony** (the glass adapts to what is underneath), **consistency** (the same material everywhere, at every size).

Motion feel, springs and typography live in the `apple-design` skill — this skill owns the material. When both matter, read both.

## Step 0 — pick the fidelity tier

| Tier | What you get | Support | Use when |
| --- | --- | --- | --- |
| **A — Layered glass** (default) | Blur + saturation + tinted fill + specular rim + lift shadow | All modern browsers | Almost every case. Ship this first. |
| **B — Add refraction** | Tier A + real edge lensing via an SVG displacement filter | **Chromium only** (`backdrop-filter: url(#…)`) | The user explicitly wants true lensing/refraction, and cross-browser is not required |
| **C — WebGL / shader glass** | Physically-based refraction | Everywhere (custom canvas) | Never by default. Only for a hero/showcase piece worth the code |

Tier A is not a consolation prize — Apple's own controls read mostly as *frosted, tinted, edge-lit glass*. Get hierarchy, rim light and concentricity right in Tier A before even thinking about refraction. If you go Tier B, ship Tier A as the fallback behind `@supports`/`CSS.supports`, because Safari and Firefox drop the effect entirely otherwise.

## Where glass belongs — and where it never does

Glass is a **floating functional layer**. Use it for:

- Nav/toolbars, tab bars, sidebars, status bars, floating palettes
- Controls that hover over content: buttons, toggles, sliders, segmented controls, FABs
- Ephemeral surfaces: popovers, menus, sheets, toasts, tooltips, scrims under modals
- Badges, pills, capsules, chips, app-icon-like objects

Do **not** use it for:

- Page/body backgrounds or long reading surfaces — glass is for things that *float*, and a full-screen frosted layer is both illegible and expensive
- **Content cards that sit in the document flow.** A card is only glass if it genuinely floats over media; if it holds the text people came to read, give it an opaque/near-opaque surface (`--glass-fill` ≥ 0.85) or plain background. A reading surface at 0.5 fill is the single most common way a "Liquid Glass" build ends up unreadable.
- Dense data (tables, code, forms) that must be read for minutes at a time — give those an opaque or near-opaque surface
- Stacking light glass on light glass — the inner layer blurs an already-blurred backdrop and legibility collapses. The same applies *inside* a surface: a lens/row highlight within glass must be either near-opaque (≥ 0.85) or a low-alpha color wash (≤ 0.15) — never a second mid-alpha layer floating on the first.
- Custom chrome on top of controls that should recede (Apple asks you to *remove* custom backgrounds from controls, not multiply them)

Glass must have **clear separation from the content beneath** — a defined rim plus a lift shadow. Without it the edge dissolves and text under the glass fights text over it.

## Concentricity — the rule that makes it look Apple

Every nested rounded rectangle must be concentric with its container: the child's corner radius = **container radius − inset padding**, so the two corners share a center.

```css
--radius-window: 44px;
--inset: 12px;
.toolbar        { border-radius: var(--radius-window); }
.toolbar .btn   { border-radius: calc(var(--radius-window) - var(--inset)); }
.toolbar .btn:hover { border-radius: calc(var(--radius-window) - var(--inset)); }
```

Rules of thumb:

- Inset a child twice (padding on both sides) and the radius shrinks by the inset once, because both edges move.
- Standalone components need a **fallback radius** — apply the concentric formula only when the component is actually nested; otherwise use its own token (`--radius-control: 16px`).
- Large containers hug the hardware/window corners (big radius); **big controls become capsules** (`border-radius: 999px`), small ones keep a modest radius.
- Apple's shapes are continuous (squircle). `border-radius` gives circular corners — acceptable parity. Use `corner-shape`/clip-path only if you are chasing pixel parity and have verified support.

## The material — Tier A core recipe

Copy from `assets/liquid-glass.css`, or paste this. Everything is tokenized so variants and dark mode are variable swaps, not new rules.

```css
:root {
  --glass-radius: 28px;
  --glass-blur: 22px;
  --glass-sat: 180%;
  --glass-fill: 0.46;          /* body opacity — lower = more transparent */
  --glass-tint: 255 255 255;   /* rgb triplet; light mode = white */
  --glass-rim: 0.55;           /* specular rim strength */
  --glass-lift: 0 12px 32px rgb(0 0 0 / 0.18);
  --glass-mx: 50%;             /* sheen origin, driven by pointer/scroll */
  --glass-my: 0%;
}
.dark {
  --glass-tint: 26 26 30;
  --glass-fill: 0.40;
  --glass-rim: 0.35;
  --glass-lift: 0 12px 32px rgb(0 0 0 / 0.45);
}

.glass {
  position: relative;
  border-radius: var(--glass-radius);
  background: linear-gradient(to bottom,
    rgb(var(--glass-tint) / calc(var(--glass-fill) + 0.10)),
    rgb(var(--glass-tint) / var(--glass-fill)));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid rgb(255 255 255 / 0.22);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / var(--glass-rim)),        /* light catching the top edge */
    inset 0 -1px 0 rgb(255 255 255 / calc(var(--glass-rim) * 0.45)), /* bounce light off the bottom */
    inset 0 0 24px rgb(255 255 255 / 0.10),                   /* thickness / inner glow */
    inset 0 0 0 1px rgb(0 0 0 / 0.05),                        /* hairline that defines the silhouette */
    var(--glass-lift);
  overflow: hidden;
}
.glass::after {  /* specular sheen that tracks the pointer or scroll */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(55% 75% at var(--glass-mx) var(--glass-my),
    rgb(255 255 255 / 0.30), transparent 65%);
}
```

What each layer does — this is the anatomy to reason with when tuning:

1. **Backdrop** — `blur` + `saturate` is what makes the content behind read as *through glass*. Blur 16–24px for controls, 32–40px for large surfaces.
2. **Tinted fill** — a vertical gradient (brighter at top) gives the body volume. Never pure `transparent`; always tint with the surface color so light and dark themes both hold.
3. **Specular rim** — the top edge highlight is the single strongest "this is glass" signal. Kill it and the element looks like a blurred div.
4. **Inner glow** — sells thickness. Bigger surfaces get more.
5. **Lift shadow** — separates glass from content; heavier over busy/textual backgrounds, lighter over plain ones.
6. **Sheen** — reactive light. Driven by CSS variables so it costs no JS layout work.

### Variants (Apple's regular / clear / prominent)

```css
.glass--clear   { --glass-fill: 0.16; --glass-blur: 10px; }   /* over media: add a scrim behind, content must dominate */
.glass--prominent { --glass-tint: 0 122 255; --glass-fill: 0.55; } /* tinted, primary actions, badges */
.glass--heavy   { --glass-fill: 0.62; --glass-blur: 36px; }    /* sidebars, structural regions */
.glass--capsule { border-radius: 999px; }                      /* large controls */
.glass--sm      { --glass-radius: 16px; --glass-blur: 14px; }  /* chips, small controls */
```

Pick the variant from the *content behind*, not from taste: busy/photographic → clear (+ dimming scrim); plain background → regular; structural separation → heavy; a single primary action → prominent. Never mix two variants inside one surface.

## Motion — the glass must feel reactive

- **Sheen follows the interaction.** Move `--glass-mx/--glass-my` from pointer position (`pointermove`) or scroll offset (rAF-throttled). One property update, compositor-friendly.
- **Materialize, don't fade.** Enter/exit animate `transform` + `opacity` **together** with the surface: `scale(0.96)` + `opacity 0` → rest. Never animate `blur()` radius — animating `backdrop-filter` forces repaints and drops frames.
- **Register the tokens you intend to ease.** An unregistered custom property is a string: `transition: --glass-fill 200ms` silently does nothing (and a gradient reading it snaps). Declare `@property --glass-fill { syntax: "<number>"; inherits: true; … }` (same for `--glass-sheen`, `--glass-mx/my`, `--glass-radius`, `--glass-blur`) — then the fill, the sheen and the scroll-edge fade all interpolate for real. `assets/liquid-glass.css` ships with these declared.
- **Press = spring up.** On `:active`, `scale(0.97)` instantly (see `apple-design`), plus a small sheen brightening. Release springs back.
- **Morph between states.** Collapsing a toolbar into a pill, or a control receding when the user scrolls to focus content, is a layout/`border-radius`/`transform` transition — Apple's controls "recede when content matters, expand the moment they're needed."
- **Anchor to the source.** Popovers/menus/sheets grow from the trigger (`transform-origin` at the button), with the glass becoming visible as it expands.

## Accessibility — non-negotiable

Glass degrades legibility; design the fallback as part of the component, not as an afterthought.

- **`prefers-reduced-transparency: reduce`** → raise `--glass-fill` to ~0.95, drop `backdrop-filter`, keep a solid tinted background and the border. This is Apple's "Reduce Transparency".
- **`prefers-contrast: more`** → near-solid background, opaque 1–2px contrasting border, drop the hairline rim in favor of a real border.
- **`prefers-reduced-motion: reduce`** → freeze the sheen and parallax; keep state changes as short cross-fades.
- **Text over glass** needs real contrast: weight ≥ 500, letter-spacing near 0, and prefer dark text on light glass / light text on dark glass. Never mid-gray on translucent white. If you can't hit contrast, the surface is too transparent — raise `--glass-fill`.
- Every interactive glass element keeps a visible focus ring (a bright ring reads well on glass: `outline: 2px solid rgb(255 255 255 / .9); outline-offset: 2px` in dark contexts).

## Performance — glass is not free

Each `backdrop-filter` reads and blurs the pixels behind it, every frame that backdrop changes.

- Count live glass surfaces over *scrolling* content; prefer **one large glass region over many small ones**, and prefer fewer, bigger blurs over a grid of chips.
- Keep blur ≤ 24px for controls, ≤ 40px for big surfaces; above that the cost climbs and the look turns to fog.
- Animate only `transform`/`opacity`; move the sheen via CSS variables, not layout reads.
- Nested glass double-blurs (the inner element samples the already-filtered outer one) — flatten the hierarchy.
- If a glass element blurs *nothing*, an ancestor with `filter`, `opacity < 1`, `mask` or `will-change: filter` created a new backdrop root — move the glass up the tree or drop that property.
- Ship the `@supports not (backdrop-filter: blur(1px))` fallback (solid tinted surface) so unsupported browsers stay legible instead of transparent-on-transparent.

## Workflow

1. **Read the stack first.** Tailwind v4 → `references/react-tailwind.md`. Vue/Svelte/Astro/Solid or Tailwind v3/CSS-in-JS → `references/frameworks.md`. Plain CSS/HTML → the recipe above plus `assets/liquid-glass.css`. React/shadcn → `references/react-tailwind.md` for a `<Glass>` wrapper. iOS/macOS target → `references/swiftui.md`.
2. **Drop in tokens** before styling anything: set `--glass-*` once at `:root`/theme level so light, dark and variants stay a variable swap.
3. **Place the material by role** — floating chrome gets glass, reading surfaces don't (use the hierarchy rules above).
4. **Apply concentricity** to every nested rounded child.
5. **Add the reactive layer** (sheen + press) and the three accessibility fallbacks.
6. **Verify visually** — screenshot the result over a *busy* background and over a *plain* one; glass that only works on one of them is not finished. Check text contrast at the actual size it renders.

## Checklist

- [ ] Top-edge specular rim present; silhouette defined (not just a blurred rectangle)
- [ ] Tinted vertical fill, light *and* dark theme both legible
- [ ] Child radii concentric with their container; capsules for large controls
- [ ] Glass only on floating/functional surfaces — no full-screen or reading glass
- [ ] No light-on-light stacking; separation from content via rim + shadow
- [ ] Sheen reacts to pointer/scroll; enter animates transform+opacity, never blur
- [ ] `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion` handled
- [ ] Text on glass hits contrast (weight ≥ 500, no mid-gray)
- [ ] Fallback for browsers without `backdrop-filter`
- [ ] Glass surface count and blur radii within budget

## Where to go next

- `references/material.md` — deep material tuning, Tier B refraction (SVG displacement), browser support matrix, perf pitfalls
- `references/components.md` — toolbar, tab bar, sidebar, button, card, sheet, popover, slider, search field recipes
- `references/components-advanced.md` — tooltips, toasts, drag sheets, forms/inputs, dashboards, app-icon launcher
- `references/react-tailwind.md` — Tailwind v4 `@utility`, React `<Glass>` component with pointer sheen, shadcn/ui integration
- `references/frameworks.md` — Vue, Svelte, Astro, Solid, Tailwind v3 plugin, styled-components, SSR fallbacks
- `references/swiftui.md` — native SwiftUI `.glassEffect()`, `GlassEffectContainer`, UIKit `UIGlassEffect`, AppKit glass bezel
- `references/refraction-advanced.md` — pointer-tracking lens, `make-refraction-map.mjs` map generator, Tier C WebGL/three.js
- `assets/liquid-glass.css` — the complete drop-in stylesheet (tokens, variants, fallbacks, dark mode)
- `assets/refraction-map.svg` + `assets/make-refraction-map.mjs` — the Tier B displacement map and the Node script that regenerates it (`node assets/make-refraction-map.mjs --help`)

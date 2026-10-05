# Components

Recipes assume the tokens and `.glass` base from `../assets/liquid-glass.css` or the core recipe in SKILL.md. Each entry lists **placement**, **shape**, and the one detail that makes it read as Liquid Glass.

> **Before you pick a variant, sort the surface.** Floating chrome (toolbar, tab bar, sidebar, popover) is where glass belongs. A surface holding text people came to read — a card in flow, a table, a form, a chart — is **not**: give it fill ≥ 0.85 or drop the material. Every "this looks cheap" report traces back to a reading surface left translucent. SKILL.md has the full rule; this file assumes you have applied it.

## Floating toolbar / nav bar

Floats over scrolling content, hugs the top edge, corners follow the window.

```css
.toolbar {
  position: fixed;
  top: 12px; left: 12px; right: 12px;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  --glass-radius: calc(var(--radius-window) - 12px);  /* concentric with the window */
  z-index: 20;
}
.toolbar .btn { --glass-radius: calc(var(--radius-window) - 12px - 8px); }
```

- Content must scroll *under* it, not stop at it — no opaque header strip in the document flow.
- Add the scroll-edge effect instead of a hard border: the material stays invisible until content scrolls beneath. `liquid-glass.css` already implements this — set `data-scrolled="false"` in the markup, then flip it on the first scroll:

  ```html
  <header class="glass toolbar" data-scrolled="false">
  ```
  ```js
  const bar = document.querySelector('.toolbar');
  addEventListener('scroll', () => { bar.dataset.scrolled = 'true'; },
                   { once: true, passive: true });
  ```

  Do **not** hand-roll this with `background: none` until scrolled. `background` carries the tint *and* the sheen, so clearing it removes the material, and restoring it with a plain gradient loses the reactive layer. Use the attribute.

## Tab bar / bottom pill

Large controls become **capsules**; keep the group small so it reads as one object.

```css
.tabbar {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 4px; padding: 6px;
  --glass-radius: 999px;
}
.tabbar button {
  border: 0; background: transparent; color: inherit;
  padding: 8px 16px; border-radius: 999px;   /* concentric: capsule inside capsule */
  transition: background 200ms ease, transform 120ms ease;
}
.tabbar button[aria-selected="true"] {
  background: rgb(var(--glass-tint) / 0.85);  /* selection is a solid lens inside the glass */
  box-shadow: 0 2px 8px rgb(0 0 0 / .18), inset 0 1px 0 rgb(255 255 255 / .6);
}
```

The **selection lens** (a solid pill behind the active item) is the signature of iOS 26 tab bars: the glass group stays translucent, the selected item becomes a brighter, denser lens. Animate the lens with a shared-element/spring move rather than cross-fading two backgrounds. Keep the lens **near-opaque (≥ 0.85)** or a low-alpha wash (≤ 0.15) — a mid-alpha lens on mid-alpha glass is two translucent layers stacked, which is exactly the illegibility Apple avoids.

## Sidebar

Structural → `--heavy` variant. Rounded on the inner edge only, matching the window.

```css
.sidebar {
  width: 280px;
  --glass-fill: 0.62; --glass-blur: 36px;
  border-radius: 0 var(--radius-window) var(--radius-window) 0;
  padding: 12px;
}
.sidebar .row { border-radius: calc(var(--radius-window) - 12px); }  /* concentric */
```

Sidebar rows over a sidebar are **not** another glass layer — use a flat translucent highlight (`rgb(0 0 0 / .06)` light / `rgb(255 255 255 / .10)` dark).

## Button

```css
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  min-height: 44px; padding: 0 20px;         /* taller, softer — iOS 26 controls grew */
  --glass-radius: var(--radius-control);    /* standalone: its own token, not a parent calc */
  --glass-blur: 16px;
  transition: transform 120ms ease, background 200ms ease;
}
.btn:active { transform: scale(0.97); }       /* feedback on press, not on release */
.btn--primary { --glass-tint: 0 122 255; --glass-fill: .55; color: #fff; }  /* prominent */
```

- **One primary action per view** gets `prominent`; everything else stays regular glass.
- A button nested in a toolbar or sheet takes `glass--concentric` instead of setting a radius, so it stays concentric when the container's radius is retuned. Writing `--glass-radius: calc(var(--glass-radius) - 8px)` on the child reads its own inherited value — it happens to work and silently stops working the moment the parent changes.
- Icons: SF-Symbols-style weight (≈1.5–2px stroke at 20px), `currentColor`, no filled cartoon icons on glass.
- Remove custom backgrounds Apple wouldn't have: if the system control already gives you glass, don't paint over it.

## Card

Cards are content containers — usually **not** glass. Use glass only when the card floats over media or other content; otherwise give it an opaque surface and let the glass be the chrome around it. If the card genuinely must stay glass (it floats, it holds a glanceable metric), raise the fill:

```css
.card--glass {
  --glass-fill: .85; --glass-blur: 24px;   /* ≥ .85 when people read text in it */
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .5), 0 16px 40px rgb(0 0 0 / .22);
}
```

Text inside a glass card: title ≥ 600 weight, body ≥ 450, never gray-on-translucent-white.

## Sheet / popover / menu

Ephemeral surfaces that **originate from the trigger**. Set the origin from the trigger's position, and declare the variables you read — an undeclared one makes the whole `transform-origin` invalid and the popover grows from the wrong corner:

```css
.popover {
  --glass-fill: .55; --glass-blur: 28px;
  --trigger-x: 50%; --trigger-y: 0%;   /* overwritten per-open with the trigger's centre */
  transform-origin: var(--trigger-x) var(--trigger-y);   /* grows out of the button */
  animation: materialize 260ms cubic-bezier(.2, .9, .3, 1);
}
@keyframes materialize {
  from { opacity: 0; transform: scale(.94); }
  to   { opacity: 1; transform: scale(1); }
}
```

```js
// Anchor to the trigger: write the two variables once per open, not per frame.
function anchorOrigin(popover, trigger) {
  const t = trigger.getBoundingClientRect();
  const p = popover.getBoundingClientRect();
  popover.style.setProperty('--trigger-x', `${t.left + t.width / 2 - p.left}px`);
  popover.style.setProperty('--trigger-y', `${t.top - p.top}px`);
}
```

- `.glass` sets `overflow: hidden` to clip children to its radius, which also clips an absolutely-positioned menu rendered inside it. **Portal the menu** to the surface element (`DialogContent`, not its rows) instead of nesting it.
- Pair with a dimming scrim **only** when the task is modal; a parallel non-blocking panel gets glass + offset, no scrim.
- Menu rows: hover/selected row is a flat translucent highlight, not nested glass.
- Sheets should be `heavy` (they sit over dense content) and carry a real drop shadow.

## Slider / toggle / stepper

Small controls, small radius, strong rim — they must feel like machined parts.

```css
.slider-track {
  height: 28px; border-radius: 999px;
  --glass-fill: .38; --glass-blur: 12px;
}
.slider-thumb {
  width: 28px; height: 28px; border-radius: 999px;
  background: rgb(255 255 255 / .92);
  box-shadow: 0 2px 6px rgb(0 0 0 / .3), inset 0 1px 0 rgb(255 255 255 / 1);
}
```

The **thumb is brighter and denser than the track** — the value is the solid object, the range is the glass. Same principle as the tab-bar lens.

## Search field

```css
.search {
  display: flex; align-items: center; gap: 8px;
  min-height: 40px; padding: 0 14px;
  --glass-radius: 999px;              /* capsule */
  --glass-fill: .35; --glass-blur: 16px;
}
.search input { background: none; border: 0; outline: none; font: inherit; }
```

- Icon + placeholder in the same tone as the input text; placeholder at ≥ 45% opacity of the *text* color, not a gray from another palette.
- Focus state: brighten the fill and add a focus ring — never a blue 1px border painted on top of glass.

## Badge / pill / app-icon object

```css
.badge {
  min-width: 20px; height: 20px; padding: 0 6px;
  border-radius: 999px; --glass-fill: .7; --glass-blur: 8px;
  font-size: 11px; font-weight: 700;
}
```

Tiny surfaces need *less* blur and *more* fill — otherwise they disappear. Badges over colorful icons usually want `prominent` with an opaque tint so the number stays legible.

## App-icon / logo treatment

Icons get layered glass: a soft light-to-dark gradient base, a translucent glass plate on top, and a subtle inner lens. Keep the gradient gentle; monochrome and dark-tint variants should stay recognizable at 40px.

## Quick map

| Surface | Variant | Radius | Fill | Blur |
| --- | --- | --- | --- | --- |
| Toolbar / tab bar | regular | concentric or capsule | .45 | 20–24 |
| Sidebar | heavy | window radius (one side) | .62 | 36 |
| Button / toggle | regular · prominent for primary | concentric − inset | .45–.55 | 14–20 |
| Popover / menu | regular | 20–24px | .55 | 28 |
| Sheet | heavy | window radius top | .60 | 32 |
| Search field | regular | capsule | .35 | 16 |
| Card over media | clear + scrim | 24–28px | .16 | 10–12 |
| Badge | prominent | capsule | .70 | 8 |

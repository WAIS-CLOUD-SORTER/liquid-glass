# Advanced components

Same contract as `components.md`: assume the tokens and `.glass` base, state **placement**, **shape**, and the one detail that sells it. These are the surfaces that usually go wrong, because each one has a content type that fights translucency.

## Tooltip

Ephemeral, tiny, always over *something* — the case where `clear` earns its place.

```css
.tooltip {
  position: fixed;
  max-width: 240px;
  padding: 6px 10px;
  --glass-fill: .88;            /* text must be read instantly → nearly opaque */
  --glass-blur: 14px;
  --glass-radius: 10px;
  font-size: 12px; font-weight: 500;
  box-shadow: 0 6px 20px rgb(0 0 0 / .25), inset 0 1px 0 rgb(255 255 255 / .5);
  animation: tooltip-in 140ms cubic-bezier(.2,.9,.3,1);
}
@keyframes tooltip-in { from { opacity: 0; transform: translateY(3px) scale(.97); } }
```

- **Fill ≥ 0.85** — a tooltip is read for 1.5 seconds; there is no time to decode text through a blur.
- Anchor `transform-origin` to the trigger; it must appear to slide out of the control, not fade in from nowhere.
- Never a second tooltip on top of a glass popover — anchor it to the trigger instead (light-on-light stacking).

## Toast / notification

Top-right (desktop) or top-center (mobile), over scrolling content, auto-dismissing.

```css
.toast {
  position: fixed; top: 16px; right: 16px;
  display: flex; gap: 10px; align-items: center;
  min-width: 300px; padding: 12px 14px;
  --glass-fill: .72; --glass-blur: 24px;
  --glass-radius: 18px;
  z-index: 60;
  animation: toast-in 320ms cubic-bezier(.2,.9,.3,1);
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(16px) scale(.96); }
}
.toast__progress {                        /* dismiss timer: solid, not glass */
  position: absolute; left: 0; bottom: 0; height: 3px;
  background: rgb(var(--glass-tint) / .95); border-radius: 0 0 inherit;
}
```

- The progress bar and status dot are **solid** — the only non-translucent thing on the surface, so the eye finds state at a glance.
- Stack toasts as one group: incoming toast lifts the stack (`transform: translateY`), rather than every toast carrying its own independent blur.
- Interactive toasts (with an action button): raise fill to ≥ 0.85 when the action is text you must read.

## Drag sheet / bottom sheet with grab

Mobile sheet that follows the finger and settles into two detents.

```css
.sheet {
  position: fixed; left: 0; right: 0; bottom: 0;
  --glass-fill: .60; --glass-blur: 32px;
  --glass-radius: 28px 28px 0 0;         /* hugs the screen corners */
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom));
  transform: translateY(var(--drag, 0px));
  transition: transform 380ms cubic-bezier(.2,.9,.3,1);
  will-change: transform;                /* only transform moves during drag */
}
.sheet[data-dragging="true"] { transition: none; }   /* finger owns the frame */
.sheet__grab {
  width: 36px; height: 5px; margin: 6px auto 12px;
  border-radius: 999px;
  background: rgb(var(--glass-tint) / .55);          /* solid lens, not glass */
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .5);
}
```

- Drag reads `pointerdown` on the grab handle only, writes `--drag` each frame, then releases to a **spring** on `pointerup` (see `apple-design`) — never animate `backdrop-filter` while dragging.
- The scrim behind the sheet is the only place a dimming layer belongs; drop it to ~0.2 opacity so content stays recognizable as it slides under.
- The grab handle is a solid lens: it's the affordance, and affordances on glass must be denser than the glass.

## Forms / inputs over glass

Inputs are where glass usually fails. Default answer: **the field is a lens inside a glass panel, not more glass**.

```css
.glass-form { --glass-fill: .78; --glass-blur: 26px; padding: 20px; }   /* panel: near-opaque */

.field {
  min-height: 44px; padding: 0 14px;
  border-radius: 12px;
  background: rgb(0 0 0 / .06);           /* flat inset well, light mode */
  border: 1px solid rgb(0 0 0 / .10);
  transition: background 180ms ease, box-shadow 180ms ease;
}
.dark .field { background: rgb(255 255 255 / .10); border-color: rgb(255 255 255 / .12); }

.field:focus-visible {
  outline: 2px solid rgb(0 122 255 / .9); outline-offset: 1px;
  background: rgb(255 255 255 / .55);      /* focus fills the well */
}
.field::placeholder { color: rgb(var(--glass-tint) / .55); }
```

- **Never blur inside a field.** A blurred text input is unreadable at caret time; the panel gets the blur, the field gets an inset well.
- Labels ≥ 500 weight; error text solid red at full opacity (an error at 70% on translucent white is invisible to the people who need it most).
- Selects/menus opened from the glass form are a **separate** surface with its own fill ≥ 0.9 — they float over the panel.
- Validation summary, helper text and `aria-describedby` are unaffected by glass; keep them DOM-solid.

## Charts / dashboard over glass

Dashboards are the "content cards in flow" trap. Split the surface:

```css
.dashboard {                      /* the glass is the *chrome*, not the data */
  display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;
  --glass-fill: .70; --glass-blur: 28px;
}
.metric-card {                    /* data card: opaque enough to read numbers */
  --glass-fill: .88; --glass-blur: 20px;
  padding: 16px;
}
.metric-card canvas, .metric-card svg { position: relative; z-index: 1; }
.metric-card::before {            /* plot-area scrim so gridlines survive */
  content: ""; position: absolute; inset: 0;
  background: rgb(var(--glass-tint) / .18);
}
```

- **Numbers and axis labels sit on ≥ 0.85 fill.** Nobody should do arithmetic through a blur.
- Chart series use solid, saturated colors — a 60%-alpha line on translucent white has no contrast anywhere.
- Prefer **one** glass shell around the dashboard plus opaque inner cards, over a grid of 12 independent `backdrop-filter` surfaces (see the performance budget: one large region beats many small ones).
- The metric that decides: take a screenshot, squint. If two numbers are hard to separate, the fill is too low.

## App-icon grid / launcher

```css
.launcher {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 18px; padding: 24px;
  --glass-fill: .55; --glass-blur: 30px;
}
.launcher__icon {
  aspect-ratio: 1; border-radius: 24%;          /* squircle-ish, concentric to the tile */
  background:
    radial-gradient(120% 120% at 30% 20%, rgb(255 255 255 / .45), transparent 55%),
    linear-gradient(160deg, rgb(var(--glass-tint) / .75), rgb(var(--glass-tint) / .35));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .6), 0 6px 16px rgb(0 0 0 / .22);
  display: grid; place-items: center;
}
.launcher__icon[data-pressed] { transform: scale(.94); }
```

- Icons are **their own plate**, not windows into the panel: each icon gets a defined edge (inner highlight + drop shadow) or the grid turns to soup.
- Keep each icon's art solid and monochrome-friendly; the glass plate is a frame, not a filter over the artwork.
- Launch animation: the icon springs to its destination (`transform-origin` at the icon) while the launcher fades — never animate blur radius on 30 icons at once.
- Concentricity: tile radius = grid padding formula; icon radius = tile radius − inset.

## Choosing between them

| Surface | Variant | Fill | Blur | Solid lens? |
| --- | --- | --- | --- | --- |
| Tooltip | regular | .88 | 14 | — |
| Toast | regular | .72 (.85 with action) | 24 | progress + status dot |
| Drag sheet | heavy | .60 | 32 | grab handle |
| Form panel | heavy | .78 | 26 | the input wells |
| Metric card | regular | .88 | 20 | chart lines (opaque) |
| Launcher shell | regular | .55 | 30 | each icon plate |

The pattern: **the glass is the container; every piece of information inside it is solid.** When a component needs the reader to act on a specific element, that element stops being translucent.

## Checklist for advanced components

- [ ] Any surface holding read-for-content text is ≥ 0.85 fill
- [ ] Inputs are inset wells, never blurred; focus state fills and rings
- [ ] Drag/scroll animation touches only `transform`/`opacity`
- [ ] Interactive state (progress, errors, chart series) rendered solid
- [ ] Grouped surfaces share one blur region instead of stacking
- [ ] Tooltips anchor to the trigger, not to another glass surface
- [ ] Each plate has a defined edge (rim + shadow), including icon tiles

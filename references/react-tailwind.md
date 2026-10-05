# React + Tailwind recipes

## Tailwind v4 (recommended)

Declare the **full** token set here. A partial set is how a Tailwind port drifts from the stylesheet: the values that are missing silently fall back to whatever the utility hardcodes, and dark mode stops being a variable swap.

```css
@import "tailwindcss";

/* class-based dark mode (v4 defaults to prefers-color-scheme) */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --radius-glass: 28px;
  --color-glass-tint: rgb(255 255 255 / 0.46);
}

:root {
  color-scheme: light dark;
  --radius-window: 44px;  --inset: 12px;  --radius-control: 16px;
  --glass-radius: 28px;  --glass-blur: 22px;  --glass-sat: 180%;
  --glass-fill: 0.46;  --glass-tint: 255 255 255;
  --glass-rim: 0.55;  --glass-glow: 0.10;
  --glass-lift: 0 12px 32px rgb(0 0 0 / 0.18);
  --glass-hairline: rgb(0 0 0 / 0.05);
  --glass-border: rgb(255 255 255 / 0.22);
  --glass-mx: 50%;  --glass-my: 0%;  --glass-sheen: 0.28;
}
.dark {
  --glass-tint: 26 26 30;  --glass-fill: 0.40;  --glass-rim: 0.35;  --glass-glow: 0.06;
  --glass-lift: 0 12px 32px rgb(0 0 0 / 0.45);
  --glass-hairline: rgb(255 255 255 / 0.10);  --glass-border: rgb(255 255 255 / 0.14);
}

/* Without these, a transition on --glass-fill does nothing and the gradient snaps. */
@property --glass-fill  { syntax: "<number>";     inherits: true; initial-value: 0.46; }
@property --glass-sheen { syntax: "<number>";     inherits: true; initial-value: 0.28; }
@property --glass-mx    { syntax: "<percentage>"; inherits: true; initial-value: 50%;  }
@property --glass-my    { syntax: "<percentage>"; inherits: true; initial-value: 0%;   }
@property --glass-radius{ syntax: "<length>";     inherits: true; initial-value: 28px; }
@property --glass-blur  { syntax: "<length>";     inherits: true; initial-value: 22px; }

@utility glass {
  position: relative;
  border-radius: var(--glass-radius);
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
    inset 0 1px 0 rgb(255 255 255 / var(--glass-rim)),
    inset 0 -1px 0 rgb(255 255 255 / calc(var(--glass-rim) * .45)),
    inset 0 0 24px rgb(255 255 255 / var(--glass-glow)),
    inset 0 0 0 1px var(--glass-hairline),
    var(--glass-lift);
  overflow: hidden;
}

/* Every variant, not just the popular three — a missing one becomes an
   arbitrary value at the call site, which is how the drift starts. */
@utility glass-clear     { --glass-fill: .16; --glass-blur: 10px; --glass-rim: .45; }
@utility glass-heavy     { --glass-fill: .62; --glass-blur: 36px; }
@utility glass-prominent { --glass-tint: 0 122 255; --glass-fill: .55; --glass-rim: .50; }
@utility glass-solid     { --glass-fill: .95; --glass-blur: 0px; --glass-sheen: 0; }
@utility glass-sm        { --glass-radius: 16px; --glass-blur: 14px; }
@utility glass-capsule   { border-radius: 999px; }
@utility glass-concentric{ border-radius: calc(var(--glass-radius) - var(--inset)); }

/* The a11y and compatibility fallbacks belong in this file too — they are part
   of the material, not an app-level concern. Keep them byte-identical to
   assets/liquid-glass.css; check-glass.mjs will tell you when they diverge. */
@media (prefers-reduced-transparency: reduce) { … }
@media (prefers-contrast: more) { … }
@media (prefers-reduced-motion: reduce) { … }
@media (forced-colors: active) { … }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { … }
```

If you would rather not maintain a second copy at all: `@import` the stylesheet and add only the `@utility` wrappers that map existing classes to utilities. One definition beats two.

Usage — plain utilities for the rest of the layout, `glass` only for the material:

```tsx
<div className="glass fixed top-3 inset-x-3 z-20 flex items-center gap-2 p-2
                [--glass-radius:calc(44px-12px)]">
  <button className="glass glass-capsule h-11 px-5 font-medium active:scale-[.97]
                     transition-transform duration-100">Play</button>
</div>
```

**Prefer `@utility glass` over scattering arbitrary values** like `backdrop-blur-[22px] bg-white/[.46] shadow-[inset_0_1px_0_#ffffff8c]` across markup: the material must be tunable in one place, and arbitrary values guarantee that light mode, dark mode and the fallback drift apart.

Without v4 (v3 or plain utility CSS), the same block lives in `@layer utilities { .glass { … } }` or a plugin — content unchanged.

## React `<Glass>` component

Handles the reactive sheen (pointer/scroll) plus a `reduced-transparency` fallback in one place.

```tsx
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "header" | "nav" | "aside" | "button";
  variant?: "regular" | "clear" | "heavy" | "prominent";
  radius?: number | string;
  children?: ReactNode;
};

export function Glass({ as: Tag = "div", variant, radius, className = "", children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // reactive sheen: one CSS variable write per frame, no layout reads in the hot path
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--glass-mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--glass-my", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const variantClass =
    variant === "clear" ? "glass-clear"
    : variant === "heavy" ? "glass-heavy"
    : variant === "prominent" ? "bg-blue-500/55 [--glass-tint:0_122_255]"
    : "";

  return (
    <Tag
      ref={ref}
      className={`glass ${variantClass} ${className}`}
      style={radius != null ? ({ ["--glass-radius" as string]: typeof radius === "number" ? `${radius}px` : radius }) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

Rules for the wrapper:

- **Don't add animation inside it.** Motion (press springs, materialize enter/exit) belongs to the call site or a motion library — see the `apple-design` skill.
- **Don't render a scrim unless the surface is modal** — the component shouldn't decide hierarchy for the page.
- If the app ships without JS, the sheen is decorative: `--glass-mx/--glass-my` have sane defaults, so the static render is already correct.

## shadcn/ui and component libraries

Don't fork the library's primitives — layer the material on top:

```tsx
// dialog.tsx / popover.tsx — add glass to the existing content wrapper
<DialogContent className="glass border-white/20 data-[state=open]:animate-in …">
```

- Put `glass` on the **surface element** (`DialogContent`, `PopoverContent`, `SheetContent`, the sidebar), never on every row inside it.
- Override the library's own background/shadow utilities (`bg-background shadow-lg`) or they will win over the glass by specificity/order — use `!` sparingly, better to remove the conflicting class.
- Keep the library's focus/keyboard behavior untouched; glass is presentation only.
- Radix portals render outside your theme scope — make sure `.dark`/theme classes are applied to `body` (or use `forced-colors`-safe tokens), otherwise the portal content gets light-mode glass on a dark page.

## Next.js / RSC notes

- `Glass` uses `useEffect` + refs → mark it `"use client"` or wrap it; keep page shells server-rendered and mount the client wrapper where the sheen matters.
- `backdrop-filter` over content that streams in causes re-blurs during hydration; keep the above-the-fold glass count low.

## Checklist for React/Tailwind

- [ ] One `@utility glass` definition; no per-component arbitrary blur/shadow values
- [ ] Dark mode handled through `.dark` variables, not duplicated utilities
- [ ] `prefers-reduced-transparency` / `prefers-contrast` / `prefers-reduced-motion` blocks present in the stylesheet
- [ ] Sheen writes only CSS variables, rAF-throttled, listeners cleaned up
- [ ] Portals (dialogs, popovers, tooltips) inherit the theme

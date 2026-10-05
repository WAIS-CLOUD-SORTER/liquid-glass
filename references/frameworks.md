# More frameworks — Vue, Svelte, Astro, Solid, Tailwind v3, CSS-in-JS

The material is unchanged; only the delivery mechanism differs. Rule of thumb: **one definition of the material per project**, tokens at the theme level, no per-component blur/shadow values.

## Vue 3 (SFC)

```vue
<script setup lang="ts">
const props = defineProps<{ variant?: "regular" | "clear" | "heavy" | "prominent" }>();
const el = ref<HTMLElement>();
// reactive sheen — one CSS variable write per frame
onPointerMove((e) => {
  const r = el.value!.getBoundingClientRect();
  el.value!.style.setProperty("--glass-mx", `${((e.clientX - r.left) / r.width) * 100}%`);
  el.value!.style.setProperty("--glass-my", `${((e.clientY - r.top) / r.height) * 100}%`);
});
</script>

<template>
  <div ref="el" class="glass" :class="variant && `glass--${variant}`" @pointermove="onPointerMove">
    <slot />
  </div>
</template>
```

- For a whole project, ship the material as a **plugin** (`app.use(glassPlugin)`) that injects `assets/liquid-glass.css` once, rather than `@import` in every SFC `<style>`.
- Vue's `<Transition>` handles materialize-enter: animate `transform` + `opacity`, never `blur()`.
- Nuxt: put the stylesheet in `nuxt.config` `css: []` so SSR renders the fallback surface before hydration.

## Svelte 5 / SvelteKit

```svelte
<script lang="ts">
  let { variant = "regular", children } = $props();
  let el: HTMLElement;

  function sheen(e: PointerEvent) {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--glass-mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--glass-my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }
</script>

<div class="glass" class:glass--clear={variant === "clear"} bind:this={el} onpointermove={sheen}>
  {@render children()}
</div>
```

- Put the tokens in `app.css` (imported by `+layout.svelte`) so SSR and client share one surface.
- Svelte transitions: `in:scale={{ start: 0.96, duration: 180 }}` + `in:fade` together — same "materialize" feel.

## Astro

- Islands stay hydrated where the sheen matters; static islands get the CSS-only glass (`--glass-mx/my` defaults are already correct).
- Ship `liquid-glass.css` via a `<style is:global>` import or `src/styles/glass.css` in the base layout.
- Content-heavy pages: Astro is where you most want to *not* use glass on the reading column — glass goes on the sticky header and floating TOC only.

## SolidJS

Same shape as Vue: a `<Glass>` component with `onPointerMove` writing the two variables. Solid's fine-grained updates mean no virtual-DOM cost per frame; still rAF-throttle the writes.

## Tailwind v3 (and v2) — plugin

Tailwind v4 uses `@utility`; v3 and older use a plugin or `@layer utilities`:

```js
// tailwind.config.js — v3/v2 have no @utility, so the material goes in a plugin.
// Do NOT re-type the recipe here: @import assets/liquid-glass.css and add only
// the utility classes. Two copies of the material is how they drift apart.
module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx,vue,svelte}"],
  plugins: [require("./plugins/glass")],
};

// plugins/glass.js — maps the stylesheet's existing classes to utilities and
// injects the stylesheet once.
const plugin = require("tailwindcss/plugin");
module.exports = plugin(({ addUtilities, addVariant }) => {
  addUtilities({
    ".glass":         { position: "relative", borderRadius: "var(--glass-radius)" },
    ".glass-clear":   { "--glass-fill": ".16", "--glass-blur": "10px" },
    ".glass-heavy":   { "--glass-fill": ".62", "--glass-blur": "36px" },
    ".glass-sm":      { "--glass-radius": "16px", "--glass-blur": "14px" },
    ".glass-capsule": { borderRadius: "999px" },
    ".glass-concentric": { borderRadius: "calc(var(--glass-radius) - var(--inset))" },
  });
  addVariant("prominent", ["&.glass--prominent"]);
});
```

- v3 needs the `-webkit-backdrop-filter` prefix explicitly (v4 handles it); the imported stylesheet already carries both.
- If you must inline the recipe instead of importing, copy it verbatim from `assets/liquid-glass.css` and keep every value tokenized — then run `node scripts/check-glass.mjs` over it. A partial copy loses `@property`, and without `@property` the sheen snaps instead of easing.
- Do **not** express the material as `bg-white/40 backdrop-blur-[22px]` in markup: light mode, dark mode and the fallback then drift apart, and the concentric radius math becomes unreadable.

## styled-components / emotion

Import the stylesheet once for the tokens and the fallbacks, then keep a **single shared `css` block** for the rule itself:

```js
import "liquid-glass/assets/liquid-glass.css";

export const glass = css`
  position: relative;
  border-radius: var(--glass-radius);
  background:
    radial-gradient(60% 80% at var(--glass-mx) var(--glass-my),
      rgb(255 255 255 / var(--glass-sheen)), transparent 62%),
    linear-gradient(to bottom,
      rgb(var(--glass-tint) / calc(var(--glass-fill) + .1)),
      rgb(var(--glass-tint) / var(--glass-fill)));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid var(--glass-border);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / var(--glass-rim)),
              inset 0 -1px 0 rgb(255 255 255 / calc(var(--glass-rim) * .45)),
              inset 0 0 24px rgb(255 255 255 / var(--glass-glow)),
              inset 0 0 0 1px var(--glass-hairline),
              var(--glass-lift);
  overflow: hidden;
`;
export const Glass = styled.div`${glass}; ${variantStyles};`;
```

- Tokens and the accessibility blocks live in the imported stylesheet, so themes swap variables and no component has to restate a fallback.
- CSS-in-JS injects at runtime → SSR flashes unstyled glass. The imported `@supports not (backdrop-filter)` block is what makes the server-rendered markup legible before hydration; don't strip it.
- A `ThemeProvider` that re-declares the tokens will shadow the imported ones. Either theme the custom properties on `body` or drop the redeclaration.

## Framework-agnostic rules

| Concern | Answer |
| --- | --- |
| Where do tokens live? | One global stylesheet / theme entry — never inside a component |
| Where does the sheen live? | One component per surface; rAF-throttled CSS variable writes |
| SSR / first paint | The non-`backdrop-filter` fallback must already look correct |
| Animating | `transform` + `opacity` only; register `@property` for interpolating tokens |
| Portal content (dialogs, tooltips, popovers) | Theme classes on `body` — portals render outside component scope |
| Framework component library | Put glass on the **surface element**, never on its rows |

## Checklist for extra frameworks

- [ ] Material defined exactly once (plugin / global CSS / shared `css` block)
- [ ] `-webkit-` prefix present where the bundler doesn't add it
- [ ] Tokens at theme level; variants are variable swaps
- [ ] SSR output is legible without `backdrop-filter`
- [ ] Sheen listener cleaned up on unmount (`onUnmounted` / `onDestroy` / effect teardown)
- [ ] Portals inherit dark/theme classes

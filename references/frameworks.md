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
// tailwind.config.js
module.exports = {
  theme: { extend: { boxShadow: { glass: "inset 0 1px 0 rgb(255 255 255 / .55), 0 12px 32px rgb(0 0 0 / .18)" } } },
  plugin: require("./plugins/glass"),
};

// plugins/glass.js
const plugin = require("tailwindcss/plugin");
module.exports = plugin(({ addUtilities, theme }) => {
  addUtilities({
    ".glass": {
      position: "relative",
      borderRadius: theme("borderRadius.glass", "28px"),
      background: "linear-gradient(to bottom, rgb(var(--glass-tint) / calc(var(--glass-fill) + .1)), rgb(var(--glass-tint) / var(--glass-fill)))",
      backdropFilter: "blur(var(--glass-blur)) saturate(180%)",
      WebkitBackdropFilter: "blur(var(--glass-blur)) saturate(180%)",
      border: "1px solid rgb(255 255 255 / .22)",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / var(--glass-rim)), inset 0 -1px 0 rgb(255 255 255 / calc(var(--glass-rim) * .45)), inset 0 0 24px rgb(255 255 255 / .1), inset 0 0 0 1px rgb(0 0 0 / .05), 0 12px 32px rgb(0 0 0 / .18)",
      overflow: "hidden",
    },
    ".glass-clear":   { "--glass-fill": "0.16", "--glass-blur": "10px" },
    ".glass-heavy":   { "--glass-fill": "0.62", "--glass-blur": "36px" },
    ".glass-capsule": { borderRadius: "999px" },
  });
});
```

- v3 needs the `-webkit-backdrop-filter` prefix explicitly (v4 handles it); keep both in the plugin.
- `prefers-reduced-transparency` blocks live in `@layer utilities` too, after the `.glass` rule so they win by order.
- Do **not** express the material as `bg-white/40 backdrop-blur-[22px]` in markup: light mode, dark mode and the fallback then drift apart, and the concentric radius math becomes unreadable.

## styled-components / emotion

Put the material in a **single shared `css` block**, not per-component:

```js
export const glass = css`
  position: relative;
  border-radius: var(--glass-radius);
  background: linear-gradient(to bottom,
    rgb(var(--glass-tint) / calc(var(--glass-fill) + .1)),
    rgb(var(--glass-tint) / var(--glass-fill)));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  border: 1px solid rgb(255 255 255 / .22);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / var(--glass-rim)),
              inset 0 -1px 0 rgb(255 255 255 / calc(var(--glass-rim) * .45)),
              inset 0 0 24px rgb(255 255 255 / .1),
              inset 0 0 0 1px rgb(0 0 0 / .05),
              var(--glass-lift);
  overflow: hidden;
`;
export const Glass = styled.div`${glass}; ${variantStyles};`
```

- Tokens still live in `:root` (a `createGlobalStyle`), so themes swap variables.
- CSS-in-JS injects at runtime → SSR flashes unstyled glass. Render the fallback surface server-side (the `@supports not (backdrop-filter)` block) and let hydration upgrade it.

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

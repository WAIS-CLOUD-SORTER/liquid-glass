# Liquid Glass — an OpenCode skill

Build Liquid Glass as an agent skill. Give any coding agent a surface and a stack, and it produces translucent, refractive, light-reactive floating UI instead of generic glassmorphism.

> **Not just a blur.** Liquid Glass is a material: it refracts what is under it, reflects light from around it, and lenses along its edges. The skill encodes Apple's three governing principles — **hierarchy**, **harmony**, **consistency** — as rules an agent can actually follow.

## Install

### OpenCode (global)

```bash
git clone https://github.com/WAIS-CLOUD-SORTER/liquid-glass.git \
  ~/.config/opencode/skills/liquid-glass
```

OpenCode discovers it on next start. Verify by asking for any glass UI — or by asking "what skills are available?".

### OpenCode (per project)

```bash
git clone https://github.com/WAIS-CLOUD-SORTER/liquid-glass.git .agents/skills/liquid-glass
```

### Claude Code

```bash
git clone https://github.com/WAIS-CLOUD-SORTER/liquid-glass.git ~/.claude/skills/liquid-glass
```

### Manual

Copy this repository's directory into any skills folder your agent scans (`~/.config/opencode/skills/`,
`~/.claude/skills/`, `.agents/skills/`). The unit of distribution is plain Markdown + CSS — there is no
build step, no bundler and no packaged binary.

There are no releases and no `.skill` archive: **this repository is the artifact.** Clone it and pin the
commit SHA you audited, so the content you reviewed is exactly the content your agent loads:

```bash
git clone https://github.com/WAIS-CLOUD-SORTER/liquid-glass.git ~/.config/opencode/skills/liquid-glass
git -C ~/.config/opencode/skills/liquid-glass checkout <commit-sha>
```

**Requirements:** none. `assets/liquid-glass.css` is a drop-in stylesheet with zero dependencies. Node is only needed if you want to regenerate the Tier B displacement map.

## Use

Ask naturally. The skill's description triggers on the concept, not the keyword:

> "Give this toolbar the Liquid Glass treatment"
> "Build a ⌘K palette with Apple's new design language"

When invoked without a specific task it replies with exactly one line and waits:

> `Liquid Glass ready — name the surface (toolbar, tab bar, card, button, popover…) and the stack, and I'll build it.`

## The three tiers

| Tier | What you get | Support |
| --- | --- | --- |
| **A — Layered glass** (default) | Blur + saturation + tinted fill + specular rim + lift shadow | All modern browsers |
| **B — Add refraction** | Tier A + real edge lensing via an SVG `feDisplacementMap` | Chromium only (`backdrop-filter: url()`) |
| **C — WebGL / shader glass** | Physically-based refraction | Custom canvas |

Tier A is not a consolation prize — Apple's own controls read mostly as *frosted, tinted, edge-lit glass*. Get hierarchy, rim light and concentricity right in Tier A before thinking about refraction. Tier B always ships behind `@supports`, so Safari and Firefox stay legible.

## What's inside

```
liquid-glass/
├── SKILL.md                       # tiers, placement rules, core recipe, a11y, perf, checklist
├── references/
│   ├── material.md                # deep tuning, Tier B, browser support matrix, perf pitfalls
│   ├── components.md              # toolbar, tab bar, sidebar, button, card, sheet, slider, search
│   ├── components-advanced.md     # tooltips, toasts, drag sheets, forms, dashboards, launcher
│   ├── react-tailwind.md          # Tailwind v4 @utility, <Glass> component, shadcn/ui
│   ├── frameworks.md              # Vue, Svelte, Astro, Solid, Tailwind v3 plugin, CSS-in-JS
│   ├── swiftui.md                 # native .glassEffect(), GlassEffectContainer, UIGlassEffect
│   └── refraction-advanced.md     # pointer-tracking lens, map authoring, Tier C shaders
├── assets/
│   ├── liquid-glass.css           # complete drop-in stylesheet (tokens, variants, fallbacks)
│   ├── refraction-map.svg         # Tier B displacement map
│   └── make-refraction-map.mjs    # Node script that regenerates the map
└── evals/                         # benchmark prompts and inputs
```

### The rule that makes it look Apple

Every nested rounded rectangle is **concentric** with its container — the child's radius equals the container's radius minus the inset padding:

```css
--radius-window: 44px;
--inset: 12px;
.toolbar      { border-radius: var(--radius-window); }
.toolbar .btn { border-radius: calc(var(--radius-window) - var(--inset)); }
```

It is one line, and it is the difference between "Apple" and "a rounded div".

### Where glass never goes

Glass is a **floating functional layer**. It does not go behind long-form reading, dense data, page backgrounds, or stacked on top of other glass. A reading surface at `--glass-fill: 0.5` is the single most common way a "Liquid Glass" build ends up unreadable — so the skill forces `≥ 0.85` wherever people actually read.

## Quick start

```css
@import "assets/liquid-glass.css";

.toolbar {
  position: fixed;
  top: 12px; left: 12px; right: 12px;
  padding: 8px 12px;
  --glass-radius: calc(var(--radius-window) - 12px);  /* concentric */
}
```

Everything is tokenized — light mode, dark mode and the regular / clear / prominent / heavy variants are variable swaps, not new rules.

## Benchmark

Measured with `skill-creator`'s eval harness: 3 eval prompts × with-skill / without-skill, graded by a rubric-driven LLM judge

**Delta: +0.38.** See [BENCHMARK.md](BENCHMARK.md) for methodology and the open gaps.

## License

[MIT](LICENSE)

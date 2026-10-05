# Liquid Glass — an OpenCode skill

Build **Liquid Glass** as an agent skill. Give any coding agent a surface and a stack, and it produces translucent, refractive, light-reactive floating UI instead of generic frosted blur.

> **Not just a blur.** Liquid Glass is a material: it refracts what is under it, reflects light from around it, and lenses along its edges. The skill encodes three governing principles — **hierarchy**, **harmony**, **consistency** — as rules an agent can actually follow.

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

Download `liquid-glass.skill` from the releases, or copy this repo's directory into any skills folder your agent scans. The unit of distribution is plain Markdown + CSS — there is no build step.

**Requirements:** none. `assets/liquid-glass.css` is a drop-in stylesheet with zero dependencies. Node is only needed if you want to regenerate the Tier B displacement map.

## Use

Ask naturally. The skill's description triggers on the concept, not the keyword:

> "Give this toolbar the Liquid Glass treatment"
> "This frosted panel looks cheap — make it a proper material"
> "Build a ⌘K palette with the Liquid Glass material"

When invoked without a specific task it replies with exactly one line and waits:

> `Liquid Glass ready — name the surface (toolbar, tab bar, card, button, popover…) and the stack, and I'll build it.`

## The three tiers

| Tier | What you get | Support |
| --- | --- | --- |
| **A — Layered glass** (default) | Blur + saturation + tinted fill + specular rim + lift shadow | All modern browsers |
| **B — Add refraction** | Tier A + real edge lensing via an SVG `feDisplacementMap` | Chromium only (`backdrop-filter: url()`) |
| **C — WebGL / shader glass** | Physically-based refraction | Custom canvas |

Tier A is not a consolation prize — the reference controls read mostly as *frosted, tinted, edge-lit glass*. Get hierarchy, rim light and concentricity right in Tier A before thinking about refraction. Tier B always ships behind `@supports`, so Safari and Firefox stay legible.

## What's inside

```
liquid-glass/
├── SKILL.md                       # tiers, the floating-vs-reading rule, recipe, a11y, perf, checklist
├── references/
│   ├── material.md                # deep tuning, Tier B, browser support matrix, perf pitfalls, failure modes
│   ├── components.md              # toolbar, tab bar, sidebar, button, card, sheet, slider, search
│   ├── components-advanced.md     # tooltips, toasts, drag sheets, forms, dashboards, launcher
│   ├── react-tailwind.md          # Tailwind v4 @utility, <Glass> component, shadcn/ui
│   ├── frameworks.md              # Vue, Svelte, Astro, Solid, Tailwind v3 plugin, CSS-in-JS
│   ├── swiftui.md                 # native .glassEffect(), GlassEffectContainer, UIGlassEffect
│   ├── refraction-advanced.md     # pointer-tracking lens, map authoring, Tier C shaders
│   └── review.md                  # auditing glass that already exists: severity model, report format
├── assets/
│   ├── liquid-glass.css           # complete drop-in stylesheet (tokens, variants, states, fallbacks)
│   ├── refraction-map.svg         # Tier B displacement map (generated)
│   └── make-refraction-map.mjs    # Node script that regenerates and verifies the map
├── scripts/
│   └── check-glass.mjs            # static checker for the rules this skill teaches
└── evals/                         # benchmark prompts, expectations and inputs
```

### The rule that decides most builds

Sort every surface into **floating** or **reading** before writing any CSS. Floating chrome — toolbar, tab bar, sidebar, popover — is where glass belongs, at whatever fill looks best over the media. A surface holding text people came to read: a card in flow, a table, a form, a chart — needs fill ≥ 0.85, or no glass at all.

A reading surface left at fill 0.5 looks fine in a screenshot over a calm background, which is exactly why it survives to review and then gets called "cheap". It is the most common way a Liquid Glass build fails.

### Where glass never goes

Glass is a **floating functional layer**. It does not go behind long-form reading, dense data, page backgrounds, or stacked on top of other glass. The same rule applies *inside* a surface: a lens or row highlight within glass must be either near-opaque (≥ 0.85) or a low-alpha wash (≤ 0.15) — never a second mid-alpha layer floating on the first.

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

Everything is tokenized — light mode, dark mode, `prefers-color-scheme`, and the regular / clear / prominent / heavy variants are all variable swaps, not new rules.

## Verify

```bash
node scripts/check-glass.mjs your-file.css --strict
node scripts/check-glass.mjs --tokens        # census of what the stylesheet declares
```

Eight rules, zero dependencies: dangling custom properties, glass nested in glass, reading surfaces under 0.85 fill, animated filters, hardcoded token literals, and missing accessibility or `backdrop-filter` fallbacks. `--json` gives a machine-readable report with the rationale for each rule. CI runs it on every push, plus a meta-test asserting that the deliberately-broken `evals/inputs/bad-glass.html` still fails — so the guard cannot quietly rot into a no-op.

## Benchmark

Measured with `skill-creator`'s eval harness, graded by a rubric-driven LLM judge.

| Eval | With skill | Without skill |
| --- | --- | --- |
| iOS music player (Spanish prompt) | 7 / 7 | 5 / 7 |
| React + Tailwind v4 command palette | 6 / 6 | 3 / 6 |
| Fix bad glass (repair task) | 4 / 6 | 2 / 6 |
| **Aggregate** | **89.0 %** | **51.3 %** |

**Delta: +0.38.** These are **v1** numbers — `n = 6`, single seed. The skill has changed substantially since; see [BENCHMARK.md](BENCHMARK.md) for what iteration 2 fixed, what it added, and the four things still unmeasured. The eval set is now 6 evals / 66 expectations, covering the review route, Tier B and native SwiftUI, which previously had no coverage at all.

## License

[MIT](LICENSE)

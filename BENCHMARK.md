# Benchmark

How the skill was measured, what it won, and — more usefully — **where it did not**.

## Methodology

- **Harness:** `skill-creator`'s eval loop (subagent generates, LLM judge grades against a fixed rubric).
- **Design:** each eval prompt executed twice — once with the `liquid-glass` skill loaded, once without.
- **Scoring:** each eval carries a set of atomic expectations. A run's score is `passed / total`; the headline figure is the **mean of the per-eval pass rates** (not a pooled total, so a 15-expectation eval and a 9-expectation eval weigh equally).
- **Evidence:** graders cite line numbers and pixel samples, so every pass/fail below is traceable to a specific rule in the output.

## Results — v1 (3 evals, the numbers below are from the previous skill version)

| Eval | Prompt | With skill | Without |
| --- | --- | ---: | ---: |
| `ios-music-player` | Single-file iOS 26 music player, floating glass toolbar + capsule tab bar (Spanish prompt) | **7 / 7** | 5 / 7 |
| `react-command-palette` | React + Tailwind v4 ⌘K palette with pointer sheen | **6 / 6** | 3 / 6 |
| `fix-bad-glass` | Repair a glass UI two people called cheap and unreadable | **4 / 6** | 2 / 6 |
| | **Mean pass rate** | **89.0 %** | **51.3 %** |

**Delta: +0.38** (0.89 vs 0.5133), with a standard deviation of 0.19 in both arms — the gap is consistent, not one lucky run.

**These numbers describe v1.** The skill has since changed substantially (see *Iteration 2*), so they are a baseline, not a current claim. No re-run has been performed — `n = 6` remains the honest sample size.

### Where the points came from

The three assertions the no-skill runs failed and the skill runs passed, over and over:

1. **Accessibility fallback.** Without the skill, *none* of the three outputs contained `prefers-reduced-transparency` or `prefers-contrast`. All three with-skill outputs did.
2. **Tokenization.** Without the skill, fills were hardcoded per component (`rgba(255,255,255,.10)`, `bg-white/10`) even when a `--fill` token existed and was never referenced. With the skill, the material is declared exactly once.
3. **rAF-throttled sheen.** Without the skill, `getBoundingClientRect()` ran synchronously on every `pointermove` — and in one run the sheen was silently broken (`@property … inherits: false` with the value set on the parent).

## What the skill did *not* fix (v1 findings, and what happened to each)

Published because the second number is the interesting one.

- **`fix-bad-glass` scored 4/6 with the skill.** Two expectations failed:
  - *"Reading surfaces get an opaque or near-opaque background"* — **a genuine gap.** The rule was stated in prose but did not survive contact with a repair workflow: the agent applied glass at `0.58` to in-flow metric cards. **Addressed in iteration 2:** the floating-vs-reading classification was promoted to the top of `SKILL.md`, above the tiers, as the first decision in the file; it is repeated as a gate at the top of `components.md` and as the first checklist item; and `check-glass.mjs` now flags any reading-shaped selector below `0.85` fill mechanically. Prose alone demonstrably did not hold — a lint does.
  - *"No translucent panel inside another translucent panel"* — **a badly worded assertion.** The output correctly removed the inner `backdrop-filter` (the actual double-blur) but kept a low-alpha lens inside the card, which is precisely what the skill prescribes. **Addressed:** reworded to test what is actually wrong — *"no element that carries its own backdrop-filter sits inside another element that also has one; a low-alpha lens inside a glass surface is acceptable and is not a defect."* The `nested-glass` check in `check-glass.mjs` implements exactly that distinction.
- **Concentricity and the `@supports` fallback were not asserted at all.** Both are now expectations, and both are checker rules.
- **Assertions checked presence, not behaviour.** Partly addressed: the seven rules in `scripts/check-glass.mjs` decide things by reading source (`dangling-var`, `hardcoded-token`, `animated-filter`, `animated-shadow`, `nested-glass`, `reading-surface`, `missing-a11y-fallback`, `missing-color-scheme`) and run in CI. What remains unmeasured is still runtime behaviour — a rule that parses but never applies.
- **`n = 6`**, one run per configuration. Variance across seeds has still not been measured.

## Iteration 2 — what changed

Motivated by the findings above and by a `graphify` pass over the skill's own dependency graph.

### Correctness defects fixed in the skill itself

The v1 skill had bugs that made its own headline rules unusable. All were found by grepping the real files, not by inference:

| Defect | Impact | Fix |
| --- | --- | --- |
| `--radius-window` and `--inset` were used in 6 files and **declared nowhere** | The concentricity formula — the rule the skill sells as its signature — was invalid at computed-value time; `border-radius` silently collapsed to `0` | Declared in `liquid-glass.css`, plus `--radius-control` and a `.glass--concentric` class |
| `SKILL.md`'s inline recipe hardcoded 5 values the stylesheet tokenizes | The copy-paste path lost the dark-mode border/hairline/glow tuning and the sheen easing — in a file that also *explains* the sheen easing | Recipe re-tokenized; `check-glass.mjs` compares docs against the stylesheet so this cannot regress |
| The stylesheet had only a `.dark` class, no `prefers-color-scheme` | OS-dark users got light glass | `@media (prefers-color-scheme: dark)` with `.light` as the escape hatch, driven from one dark-palette declaration |
| No `color-scheme` | Scrollbars, form controls and the canvas stayed light under a dark theme | `color-scheme: light dark` on `:root` |
| `prefers-reduced-transparency` block hardcoded `background` and replaced the whole `box-shadow` stack | Overrode any user token override, and discarded the silhouette cues | Sets tokens only; keeps the rim/glow/lift stack |
| `components.md` scroll-edge recipe set `background: none` then restored a plain gradient | Removed the material (the sheen lives in `background`), then restored it without the reactive layer | Documents the `data-scrolled` attribute the stylesheet already implements |
| `components.md` button recipe set `--glass-radius: calc(var(--glass-radius) - 8px)` on the child | Read the child's own inherited value — worked by accident, broke silently when the parent changed | Standalone controls use `--radius-control`; nested glass uses `.glass--concentric` |
| `components.md` popover read `var(--trigger-x)` / `--trigger-y`, undeclared | `transform-origin` invalid → popover grew from the wrong corner | Declared, with the anchoring snippet that writes them |
| `refraction-map.svg` was a committed artifact with no stamp and no check | Retuning the generator left the shipped map stale with nothing to notice | `GENERATED FILE` header recording the flags, plus `--check` in CI |
| `SKILL.md`'s Workflow routed by **stack only** | `components.md`, `components-advanced.md`, `material.md` and `refraction-advanced.md` were unreachable by following the workflow | Routing table now covers stack *and* task, including review |

### New coverage

- **`references/review.md`** — the description has always advertised "review existing glassmorphism", but no file backed it. Now there is an audit playbook: an order of operations, a three-tier severity model (blocking / wrong material / polish), a failure catalogue, a fixed report format, and an explicit list of what *not* to change.
- **`forced-colors` and `print`** handled. Windows High Contrast removes every rim and glow cue the material is built from, so the surface now gets a real `CanvasText` border.
- **An honest Firefox note.** Firefox does not implement `prefers-reduced-transparency` and no web API exposes the OS setting, so the media query is a partial guarantee. The documented pattern is the automatic path plus `glass--solid` as a real user-facing switch — and both set the same tokens so they cannot drift.
- **Eval set: 3 → 6 evals, 19 → 66 expectations.** New: `audit-existing-glass` (the review route), `tier-b-refraction` (Tier B was entirely unmeasured), `native-swiftui-toolbar` (the native route was unmeasured). Every existing eval gained the concentricity, `@supports`, `forced-colors` and `color-scheme` expectations that were missing.

### New tooling

**`scripts/check-glass.mjs`** — zero-dependency, Node ≥ 18. Eight rules; `--json`, `--strict`, `--tokens`, `--base`. Per-line suppression via `/* check-glass: ignore */` with a reason.

**`.github/workflows/check.yml`** runs four things: the stylesheet must satisfy every rule it teaches; every documented token must exist and no documented example may hardcode a value that has a token; the committed SVG must match the generator; and — the one that keeps the guard honest — **the deliberately-broken `bad-glass.html` fixture must still fail the checker**, so a change that breaks the checker cannot turn the rest of the job into a green no-op.

### Still open

- **No re-run.** Every number above is v1. The iteration-2 changes are unmeasured; treat the eval set as the specification of what to measure next, not as a result.
- **`n = 6`, single seed, single run per configuration.** Variance is still unmeasured.
- **Presence, not behaviour.** The checker reads source. It cannot tell you a rule that parses but never applies. Runtime and screenshot assertions remain the largest methodological gap.
- **No visual regression baseline.** `check-glass.mjs` proves the CSS is well-formed; nothing proves it still *looks* right after a token change.

## Reproduce

```bash
# from your skill-creator checkout
python -m scripts.aggregate_benchmark <workspace> \
  --skill-name liquid-glass \
  --skill-path <path-to-this-skill>
```

Requires `PYTHONUTF8=1` on Windows. The raw workspace (per-run outputs, graders' evidence, `benchmark.json`) is intentionally **not** committed here — it embeds machine-local paths. Regenerating it takes minutes.

To re-check the skill's own invariants without the LLM harness:

```bash
node scripts/check-glass.mjs assets/liquid-glass.css --strict
node assets/make-refraction-map.mjs --check assets/refraction-map.svg
```
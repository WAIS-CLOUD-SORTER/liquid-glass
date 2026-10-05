# Benchmark

How the skill was measured, what it won, and — more usefully — **where it did not**.

## Methodology

- **Harness:** `skill-creator`'s eval loop (subagent generates, LLM judge grades against a fixed rubric).
- **Design:** 3 eval prompts, each executed twice — once with the `liquid-glass` skill loaded, once without. 6 runs total.
- **Scoring:** each eval carries 4–7 atomic assertions. A run's score is `passed / total`; the headline figure is the **mean of the three per-eval pass rates** (not a pooled total, so a 7-assertion eval and a 6-assertion eval weigh equally).
- **Evidence:** graders cite line numbers and pixel samples, so every pass/fail below is traceable to a specific rule in the output.

## Results

| Eval | Prompt | With skill | Without |
| --- | --- | ---: | ---: |
| `ios-music-player` | Single-file iOS 26 music player, floating glass toolbar + capsule tab bar (Spanish prompt) | **7 / 7** | 5 / 7 |
| `react-command-palette` | React + Tailwind v4 ⌘K palette with pointer sheen | **6 / 6** | 3 / 6 |
| `fix-bad-glass` | Repair a glass UI two people called cheap and unreadable | **4 / 6** | 2 / 6 |
| | **Mean pass rate** | **89.0 %** | **51.3 %** |

**Delta: +0.38** (0.89 vs 0.5133), with a standard deviation of 0.19 in both arms — the gap is consistent, not one lucky run.

### Where the points came from

The three assertions the no-skill runs failed and the skill runs passed, over and over:

1. **Accessibility fallback.** Without the skill, *none* of the three outputs contained `prefers-reduced-transparency` or `prefers-contrast`. All three with-skill outputs did.
2. **Tokenization.** Without the skill, fills were hardcoded per component (`rgba(255,255,255,.10)`, `bg-white/10`) even when a `--fill` token existed and was never referenced. With the skill, the material is declared exactly once.
3. **rAF-throttled sheen.** Without the skill, `getBoundingClientRect()` ran synchronously on every `pointermove` — and in one run the sheen was silently broken (`@property … inherits: false` with the value set on the parent).

## What the skill did *not* fix

Published because the second number is the interesting one.

- **`fix-bad-glass` scored 4/6 with the skill.** Two assertions failed:
  - *"Reading surfaces get an opaque or near-opaque background"* — **a genuine gap.** The skill states this rule explicitly (fill ≥ 0.85 for surfaces people read), yet the agent applied glass at `0.58` to in-flow metric cards during a repair task. The rule exists but did not survive contact with a repair workflow. This is the top item for iteration 2: move the reading-surface rule from prose into the checklist gating and into `components.md`'s first line.
  - *"No translucent panel inside another translucent panel"* — **a badly worded assertion.** The output correctly removed the inner `backdrop-filter` (the actual double-blur) but kept a low-alpha lens inside the card, which is precisely what the skill prescribes. The assertion's parenthetical contradicts the skill's own remedy. Rewording is queued for iteration 2.
- **Assertions check presence, not behavior.** Most are "does this CSS rule exist", verified by grep plus screenshot. They do not execute the page, so a rule that parses but never applies can pass. Runtime/behavioral checks are the biggest methodological upgrade available.
- **Two coverage holes:** concentricity (the skill's signature rule) and the `@supports not (backdrop-filter)` fallback are not asserted at all.
- **n = 6.** One run per configuration. `skill-creator` supports multiple runs per configuration; variance across seeds has not been measured.

## Reproduce

```bash
# from your skill-creator checkout
python -m scripts.aggregate_benchmark <workspace> \
  --skill-name liquid-glass \
  --skill-path <path-to-this-skill>
```

Requires `PYTHONUTF8=1` on Windows. The raw workspace (per-run outputs, graders' evidence, `benchmark.json`) is intentionally **not** committed here — it embeds machine-local paths. Regenerating it takes minutes.

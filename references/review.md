# Reviewing glass that already exists

Use this when the task is to **judge or repair** a UI that already has glass — "this looks cheap", "the text is hard to read", "does this follow the iOS 26 style". Building new surfaces is `components.md`; this file is about reading someone else's code and deciding what is wrong.

Two things make a review good: knowing **what order to fix things in**, and being able to tell a real defect from taste. Fixing the blur radius before the reading surface wastes the whole pass.

## Order of operations

Work in this order. Each step depends on the one before it, and skipping ahead means redoing work.

1. **Find the material.** Where is it defined — one place or scattered? Run the checker first; it answers most of this in a second:
   ```bash
   node scripts/check-glass.mjs their-file.css --json
   ```
2. **Inventory every surface.** List each element that carries `backdrop-filter` or a translucent background, and sort it into **floating** or **reading**. This single classification produces most of the findings below.
3. **Check the blocking failures first** — legibility, missing fallbacks, cost. These affect users.
4. **Then the craft failures** — rim, concentricity, variant discipline, motion. These affect whether it reads as Apple.
5. **Re-verify visually** over a busy *and* a plain backdrop, light and dark, before you claim anything.

## Severity model

Use these three tiers. They are not interchangeable: a P1 makes the UI unusable for someone, a P3 is a polish note.

| Tier | Meaning | Examples |
| --- | --- | --- |
| **P1 — blocks someone** | A user cannot read the content, or is excluded by an accessibility setting, or the page janks | reading surface under 0.85 fill; text at mid-gray on translucent white; no `prefers-reduced-transparency` path; 40+ live glass surfaces over scrolling content; glass nested in glass over a video |
| **P2 — wrong material** | Usable, but it is not Liquid Glass — it is generic glassmorphism | no specular rim so it reads as a blurred div; fill/blur that ignore the backdrop; light glass on light glass; a variant chosen by taste rather than by what is behind |
| **P3 — polish** | Reads correctly; a detail is off | radius not concentric; blur radius disproportionate to surface size; rim too strong in dark mode; no `color-scheme`; no print styles |

Report P1 findings even when they are invisible in a screenshot. That is the point of them — they only show up on a busy background, in dark mode, or with an accessibility setting on, which is exactly what nobody checked.

## Failure catalogue

| Symptom | Tier | Cause | Fix |
| --- | --- | --- | --- |
| "Looks cheap" | P2 | Blur with no rim, no tint, no lift — a translucent box, not a material | Add the three rim cues (silhouette hairline, top catch light, bottom bounce) and a lift shadow |
| "Looks washed out / milky" | P2 | Blur too high, fill too high, or glass inside glass | Lower blur and fill; flatten the nesting |
| Text hard to read | P1 | Fill below 0.85 on a surface that holds prose or data | Raise to ≥ 0.85, or drop the material on that surface entirely |
| Text hard to read *only* over photos | P1 | `glass--clear` (0.16 fill) applied to something people read | `clear` is for media *behind*, not content. Raise the fill, or add a scrim and keep content on solid |
| Blur has no effect at all | P1 | An ancestor with `filter`, `opacity < 1`, `mask` or `will-change` created a backdrop root | Hoist the glass above that ancestor, or remove the property |
| Effect vanishes in Safari/Firefox | P1 | Tier B used as the baseline instead of behind `@supports` | Ship Tier A first; refraction is progressive enhancement |
| Nothing changes for reduced-transparency users | P1 | Missing media query, or a hardcoded `background` that overrides it | Add the block; make the fallback set tokens, not raw colours |
| Nothing changes on Windows High Contrast | P1 | Missing `forced-colors` block; the UA drops every rim and glow cue | Give the surface a real 1px `CanvasText` border |
| Jank on scroll | P1 | Many/large blurs, animated `backdrop-filter`, or `will-change` left on | Fewer surfaces, blur ≤ 24px, animate transform/opacity only |
| Corners don't nest | P3 | Child radius not concentric | `child = container − inset`; check the tokens are actually declared |
| Dark mode looks wrong | P2 | The light palette was copied and the tint flipped, but rim/glow/border were not | Drive all seven tokens from one dark palette declaration |
| OS is dark, page is light | P2 | Only a `.dark` class exists, with no `prefers-color-scheme` fallback | Add the media query with `.light` as the escape hatch |
| Fills differ per component | P3 | The material was re-typed per component instead of tokenized | One definition at the theme level; variants are variable swaps |
| Scrollbar/inputs stay light in dark mode | P3 | `color-scheme` never set | `color-scheme: light dark` on `:root` |
| Selection state invisible | P2 | A mid-alpha lens floating on mid-alpha glass | Selection is a near-opaque lens (≥ 0.85) or a low-alpha wash (≤ 0.15), never in between |
| Menu clipped by its panel | P2 | `overflow: hidden` on `.glass` clips an absolutely-positioned child | Portal the menu out of the glass surface |

## What not to do

- **Do not rewrite what works.** A review that replaces every surface produces a diff nobody can review and usually regresses something that was fine. Fix P1 and P2; leave P3 as notes.
- **Do not add glass to a surface that did not have it** unless it is floating chrome. The most common "improvement" that makes a product worse is putting a material on a reading column.
- **Do not treat a screenshot over a calm background as evidence.** Ask for, or capture, a busy backdrop and a dark-mode pass.
- **Do not retune a working surface just because another number also works.** If a surface passes the rules, its exact fill is a preference, and preferences are not findings.

## Report format

Lead with what is actually broken. Use this structure so the reader can triage without reading prose:

```markdown
## Verdict
<Two sentences: does this read as Apple's Liquid Glass, and does it work for everyone?>

## Blocking (P1)
- `path/to/file.css:42` — reading surface at fill 0.58
  Holds the quarterly numbers. Raise to ≥ 0.85 or make it opaque.
  Fix: `--glass-fill: .85` (the panel keeps the blur; only the body firms up)

## Wrong material (P2)
- `path/to/file.css:88` — no specular rim
  The surface is a blurred box. Add the top catch light and lift shadow
  (values in `assets/liquid-glass.css`, `.glass`).

## Polish (P3)
- `path/to/file.css:120` — `.card` radius not concentric with `.toolbar`

## Verified
- Screenshot over busy + plain backdrop, light and dark
- `node scripts/check-glass.mjs <file> --strict`
```

Keep each finding to three lines: **where**, **what it costs**, **the fix**. A finding without a fix is a complaint; a finding without a location is not actionable.

## Repairing, not just reporting

When the ask is to fix rather than review, work P1 → P2 → P3 and keep the material in one place:

1. Consolidate every `backdrop-filter` and translucent fill into the tokens. If the code hardcodes `rgba(255,255,255,.1)` in six places, that is the first bug — it is why light mode, dark mode and the fallbacks have drifted apart.
2. Re-sort every surface floating vs reading, then set the fill from that classification.
3. Add the fallback blocks once, at the theme level.
4. Only then adjust radii, blur values and motion.

Do not delete a translucent surface to make a warning go away without checking whether it is floating chrome — a toolbar that stops floating is a regression even though no tool flags it.
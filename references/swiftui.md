# Native Apple platforms — SwiftUI / UIKit / AppKit

The system already ships Liquid Glass. Your job on native is **placement and restraint**, not material authoring: don't recreate the blur, take the one the OS gives you. API names below are from the Xcode 26 / iOS 26 / macOS 26 SDK — if the compiler disagrees, the canonical list is Apple's *Adopting Liquid Glass* page.

The material rules in SKILL.md still govern: glass is the topmost floating layer, never content; one variant per surface; concentric radii; separation from the content beneath.

## SwiftUI

```swift
// Material (custom surfaces)
.glassEffect()                       // regular — the default, use for most cases
.glassEffect(.regular, in: .capsule) // shaped to the control
.glassEffect(.clear, in: Circle())    // over media: content must dominate
.glassEffect(.regular.tint(.blue))    // stained-glass tint — primary actions only
.glassEffect(.regular.interactive()) // expands + highlights on tap (buttons)

// Button styles (the system gives you the material for free)
.buttonStyle(.glass)          // secondary
.buttonStyle(.glassProminent) // primary

// Grouping — several glass controls blend into one surface like droplets
GlassEffectContainer(spacing: 8) { … }

// Morphing between states
@Namespace private var ns
.glassEffectID("camera", in: ns)
```

`GlassEffectContainer(spacing:)` is not decoration: glass elements closer than `spacing` points **merge into a single surface**. Put a toolbar's controls in one container or you get several separate plates that read as a bar of chips.

### Morphing requirements (`glassEffectID`)

1. All morphing views inside the **same** `GlassEffectContainer`.
2. Each carries `glassEffectID(_:in:)` with the **same `@Namespace`**.
3. Views are conditionally shown/hidden, and the state change is animated (`withAnimation(.bouncy)` / `.easeInOut`).
4. Same glass style and tint on every element in the morph — a regular→clear morph breaks the illusion.

### Native pitfalls worth knowing

| Gotcha | Fix |
| --- | --- |
| `Menu` nested in `GlassEffectContainer` breaks morphing (iOS 26.1) | Keep `Menu` out of the container |
| Morph circle ↔ rectangle glitches | Don't morph between drastically different shapes |
| `glassEffectID` inconsistent in a complex tree | Fall back to `.matchedGeometryEffect` |
| `.clipShape()` on a glass view | Remove it — shape the effect with `in:` instead |
| `.glassProminent` + `.circle` rendering artifacts | Use `.buttonStyle(.glassProminent)` and `buttonShape` |
| `UIHostingController` in bar items causes side effects | Use the bar item's `titleView` |

### Placement, native edition

- **Toolbars, tab bars, sidebars, sheets, search fields get glass automatically** when compiled against the iOS 26 SDK. Delete the custom backgrounds you added for iOS 18 — extra paint on top of system glass is exactly what Apple asks you to remove.
- `.confirmationAction` toolbar items automatically render as `.glassProminent` — don't restyle them.
- Tab bars: `tabBarMinimizeBehavior(.onScrollDown)` makes chrome recede when content matters; `search` tab role gives the floating search button; `tabViewBottomAccessory` hosts a persistent glass view.
- Sheets: system provides the inset glass background. Control it with `presentationBackground` only when you must.
- Prefer symbols over text in toolbars; `ToolbarSpacer` for grouping.

### Accessibility — mostly automatic, still verify

The OS adapts glass for **Reduce Transparency**, **Tinted glass instead of clear**, **Increase Contrast** and **Dynamic Type** without code. What you must do:

```swift
#Preview("Reduce Transparency") {
    ContentView().environment(\.accessibilityReduceTransparency, true)
}
```

- Test light mode, dark mode, and Reduce Transparency before calling it done.
- Tint only primary actions — `tint()` on everything destroys the hierarchy signal.
- Long-form text never sits on `.clear`; use a solid or `.regular` surface with fill ≥ 0.85 (same rule as the web).

## UIKit

```swift
// Cheapest path — the configuration carries the material
button.configuration = .glass()                 // regular
button.configuration = .prominentGlass()        // primary
button.configuration = .clearGlass()            // over media
button.configuration = .prominentClearGlass()
button.configuration?.symbolContentTransition = UISymbolContentTransition(.replace)

// Any other view
let effect = UIGlassEffect(style: .regular)     // or .clear
effect.tintColor = .tintColor
effect.isInteractive = true                     // tap expansion + highlights
let glassView = UIVisualEffectView(effect: effect)
```

- `UIGlassEffect.Style` has only `.regular` and `.clear`. Prominence comes from the *configuration* (`.prominentGlass()`), not the effect style.
- `isInteractive = true` is for controls the user taps; static chrome stays non-interactive so it doesn't squirm under hover/tap noise.
- Tint gives a stained-glass cast — it does **not** reliably apply a solid brand color to `.glass()` configurations. For brand color, set the background yourself and keep glass as the overlay.
- Toolbars: `UIBarButtonItemGroup` gets the glass treatment; `hidesSharedBackground = true` removes glass from specific items when you need one control to sit directly on content.

## AppKit (macOS 26)

```swift
button.bezelStyle = .glass          // NSButton — Liquid Glass bezel
```

- Sidebar and toolbar glass is automatic in macOS 26 (`NSToolbar`, `NSSplitViewItem`); remove custom vibrancy materials you added for older macOS or you stack two blurs.
- Same rule as everywhere: sidebar rows over sidebar are a flat highlight, not a second glass layer.

## When *not* to take the native path

The web recipes in this skill target browsers. Use this file when the deliverable is an iOS/macOS app or a Catalyst target. If a project ships both, keep the design tokens shared (radius, inset, variant choice) and let each platform supply its own material: `assets/liquid-glass.css` in the browser, `.glassEffect()` on device.

## Checklist for native

- [ ] System-provided glass used as-is; no custom blur stacked on toolbars/tab bars/sheets
- [ ] One variant per surface; regular or clear, never mixed
- [ ] Controls grouped in a single `GlassEffectContainer`
- [ ] Morphing: shared `@Namespace` + same container + animated state
- [ ] No `.clipShape()` on glass views; shape via `in:`
- [ ] Tested with Reduce Transparency, Increase Contrast, Dynamic Type, light and dark
- [ ] Reading surfaces ≥ 0.85 fill; `.clear` only over media
- [ ] One primary (`prominent`) action per view

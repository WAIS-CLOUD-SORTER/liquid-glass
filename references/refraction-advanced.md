# Advanced refraction — lens tracking, map authoring, Tier C

Read after `material.md` §4 (Tier B basics). Everything here is **progressive enhancement over Tier A**: if the tier fails, the page still ships as layered glass.

## 1. A lens that follows the pointer

Tier B's displacement is static. Making the *bend* track the pointer means moving the lens band inside the element, not moving the element.

**Move the map, not the filter.** The displacement map is sampled across the border box; shifting `feImage`'s `x`/`y` (or the map's `objectBoundingBox` offsets) slides where the ramp sits, so the bright bend rides toward the cursor:

```html
<svg class="glass-refraction" width="0" height="0" aria-hidden="true">
  <filter id="lens" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feImage href="assets/refraction-map.svg" result="map" x="0" y="0"
             preserveAspectRatio="none" width="100%" height="100%"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="base"/>
    <feDisplacementMap in="base" in2="map" scale="36"
                       xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```

```js
// Track the pointer; write one attribute per frame — never per event.
let frame = 0, tx = 0, ty = 0;
el.addEventListener("pointermove", (e) => {
  const r = el.getBoundingClientRect();
  tx = (e.clientX - r.left) / r.width  - 0.5;   // −0.5 … 0.5
  ty = (e.clientY - r.top)  / r.height - 0.5;
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    const amp = 0.10;                           // how far the lens wanders (fraction of the box)
    map.setAttribute("x", (tx * amp * 100).toFixed(2) + "%");
    map.setAttribute("y", (ty * amp * 100).toFixed(2) + "%");
  });
});
```

Rules that keep this cheap:

- **rAF-throttle to one write per frame.** Attribute changes on a filter node re-run the filter; two writes (x and y) is fine, twenty is not.
- Keep the amplitude small (≤ 10% of the box). Past that the lens visibly detaches from the edge and reads as a rendering bug, not refraction.
- **Disable it under `prefers-reduced-motion`** — a wandering lens is exactly the kind of decorative motion that setting exists for. The static Tier B lens stays.
- On `pointerleave`, spring the offsets back to `0` rather than cutting — the bend should relax, not snap.
- The pointer sheen (`--glass-mx/my`) and the lens offsets are **two different reactions**: sheen = light, lens = geometry. Drive both from the same handler, but never the same variable.

### Scaling the bend with interaction

`feDisplacementMap`'s `scale` is the strength knob and it is animatable from script:

```js
// press → lens deepens; release → relaxes
btn.addEventListener("pointerdown", () => mapEl.style.setProperty("--lens", "56"));
btn.addEventListener("pointerup",   () => mapEl.style.setProperty("--lens", "36"));
```

```css
/* transition the attribute indirectly via a CSS custom property is not supported
   for SVG filter attributes — drive it from JS with the same rAF loop instead. */
.glass[data-pressed] { --lens: 56; }
```

Honest note: SVG filter attributes are **not** CSS-transitionable. Either set them imperatively in the rAF loop (tween `scale` yourself over ~180ms) or accept an instant change. Do not add a CSS `transition` and assume it works.

## 2. Authoring the displacement map

`assets/make-refraction-map.mjs` generates the map. Zero dependencies, Node ≥ 18:

```bash
# regenerate the shipped default (edge=0.14 strength=0.63, eased shoulders)
node assets/make-refraction-map.mjs --out assets/refraction-map.svg

# verify the committed map still matches the generator (this is what CI runs)
node assets/make-refraction-map.mjs --check assets/refraction-map.svg

# harder, wider lens for a big hero surface
node assets/make-refraction-map.mjs --edge 0.25 --strength 0.9 --steps 8 --out map.svg

# horizontal-only bend (letterbox bars, a rail that lens left/right only)
node assets/make-refraction-map.mjs --axis x --edge 0.3 --hard
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--edge` | `0.14` | Half-width of the lens band. Smaller = bend confined to the rim (reference look); larger = all-over zoom. Must be 0–0.5. |
| `--strength` | `0.63` | 0–1. How far the borders deviate from neutral (`0x80`). Pair with the filter's `scale`. |
| `--steps` | `2` | Stops per side. More stops = a smoother, shoulder-shaped bend. |
| `--axis` | `both` | `x`, `y`, or `both`. |
| `--hard` | off | Linear ramp instead of eased shoulders (a crease rather than a soft lip). |
| `--invert` | off | Flip the direction of the bend (lens → groove). |
| `--mid` | `0.5` | Neutral value. Shift it if you want an all-over drift plus edge lensing. |
| `--size` | `100` | `width`/`height`/`viewBox` of the output. |
| `--out` | — | Write to this path. Without it, the SVG goes to stdout. |
| `--check` | — | Compare against this path and exit 1 if it differs. The committed map is a build artifact; this is how you prove it isn't stale. |

The committed `refraction-map.svg` carries a `GENERATED FILE` header recording the flags it was built with, and its body embeds those values as a comment. So a hand-edit is visible on sight, and `--check` catches it in CI even if someone ignores the header.

Tuning loop: **change one flag, screenshot over a busy background *and* a plain one, compare.** The ramp decides *where* the bend happens; the filter's `scale` decides *how much*. Adjust them separately — changing both at once tells you nothing.

Why an SVG with two linear gradients rather than a PNG: it scales losslessly with `preserveAspectRatio="none"`, stays one file, and needs no binary asset in the repo. The cost is that `mix-blend-mode` inside the SVG must be honored by the renderer — Chromium does; that's already the Tier B constraint.

## 3. Tier C — WebGL / shader glass

Tier C replaces `backdrop-filter` with a real shader that can sample **outside** the element's bounds — the one thing Tier B cannot do. Use it only for a hero/showcase piece where the code is justified.

### Choose the architecture deliberately

| Approach | When | Cost |
| --- | --- | --- |
| **Canvas behind, DOM glass on top** | Background is already a canvas/scene | Low — glass stays Tier A |
| **Glass quad inside the same scene** | The whole hero is WebGL | Correct refraction; content and glass share one coordinate space |
| **Video/image → texture → quad** | Glass over recorded media | Low; texture is static per frame |

Do **not** try to pipe arbitrary DOM content into a shader every frame (`html2canvas`-style capture) — it is orders of magnitude too slow to be a UI material.

### The glass quad (raw WebGL2 / three.js)

```glsl
// fragment: refract the scene texture through a perturbed normal
uniform sampler2D uScene;   // what's behind the glass
uniform vec2  uResolution;
uniform float uTime;
uniform float uRefraction;  // 0.02–0.06
uniform float uChromatic;   // 0.0–1.5
in vec2 vUv;

void main() {
  // edge lens: the surface is flat in the middle, steep at the border
  vec2  c   = vUv - 0.5;
  float d   = length(c) * 2.0;
  float lip = smoothstep(0.55, 1.0, d);          // ramp = where the bend happens
  vec2  n   = normalize(c + 1e-5) * lip * uRefraction;

  // chromatic aberration: split R/G/B so the rim shows colour like real glass
  vec3  col;
  col.r = texture(uScene, vUv + n * (1.0 + uChromatic * 0.15)).r;
  col.g = texture(uScene, vUv + n).g;
  col.b = texture(uScene, vUv + n * (1.0 - uChromatic * 0.15)).b;

  float rim = pow(lip, 2.0) * 0.35;               // specular lip, Tier A's job in 2D
  gl_FragColor = vec4(col + rim, 1.0);
}
```

Practical rules for Tier C:

- **Port Tier A's decisions, not its implementation.** Same variants (regular/clear/prominent), same concentricity, same "glass is a floating layer" rules. A shader that bends text you then can't read has failed the same checklist.
- **Refraction amplitude stays small** (2–6% of UV). True lensing is a lip, not a funhouse mirror.
- **Bend edges, not centers** — `smoothstep` over the border band, exactly like the map's neutral band.
- Blend the fill/tint/rim **in the shader or as a DOM overlay**, but pick one: a CSS `background` over a canvas double-composites the specular.
- Cost: a fullscreen fragment pass per glass surface. Budget **one**, and pause the loop (`cancelAnimationFrame`) when off-screen via `IntersectionObserver`.
- Ship the fallback: if WebGL context creation fails, `webgl2` is unsupported, or `prefers-reduced-rendering`/`reduced-transparency` is set → **Tier A**. Detect once at init, not per frame.

### three.js specifics

- Use a render target for "what's behind": render the scene to `WebGLRenderTarget`, then bind it as `uScene` for the glass pass (`renderer.setRenderTarget` twice per frame).
- `MeshPhysicalMaterial` with `transmission: 1`, `thickness`, `ior: 1.5` gives you physically-plausible glass for free — good for 3D objects, wrong for a flat UI overlay (it also renders the *whole* scene into a transmission pass).
- Prefer `frameloop="demand"` for UI-only scenes; you rarely need 60fps for a static panel.

## Choosing the tier, once more

| Need | Tier |
| --- | --- |
| Toolbar, sidebar, tabs, cards, anything shippable | **A** |
| Visible edge lensing, Chromium-only surface | **B** (Tier A behind `@supports`) |
| Lens must bend content *outside* the box, or hero showcase over media | **C** |
| Reading surface, dense data, reduced-transparency user | **A at ≥0.85 fill** — no refraction at all |

## Checklist for advanced refraction

- [ ] Tier A still ships; the advanced tier is gated behind a feature test
- [ ] Pointer-driven lens is rAF-throttled, amplitude ≤ 10%, springs back on leave
- [ ] Lens/animation disabled under `prefers-reduced-motion`
- [ ] Map regenerated with explicit flags; ramp and `scale` tuned separately
- [ ] Tier C has a context-failure and reduced-transparency path back to Tier A
- [ ] Tier C loop pauses when off-screen; one fullscreen pass per frame at most
- [ ] Text over any refraction still hits contrast (bending does not excuse illegibility)

# Design system (M1 foundation)

Direction: premium, bright, organic, editorial, calm. **Not** a blue-purple AI dashboard. Tokens live in `src/app/globals.css` (`@theme`). Components live in `src/components/ui/primitives.tsx`.

## Colour

| Token | Hex | Role |
| --- | --- | --- |
| `canvas` | #F5F7F6 | App background |
| `surface` / `white` | #FFFFFF | Cards |
| `line` | #E3EAE8 | Hairlines, rings |
| `ink` / `ink-soft` / `ink-faint` | #1D1D1F / #4B5558 / #6B7679 | Text hierarchy |
| `mist` / `mist-soft` | #D4E8E8 / #EAF4F3 | Palette A — calm surfaces |
| `aqua` | #86BFCB | Palette A — orb base, illustration |
| `teal` / `teal-ink` | #32BEB3 / #11756E | Palette A — accent fill / accessible accent text |
| `mint` / `mint-soft` / `sage` | #C2E8CC / #E6F5EA / #A9C4B2 | Palette B — positive surfaces |
| `lime` / `lime-ink` | #AAD253 / #4D6B12 | Palette B — goals, highlights |
| `coral` / `coral-soft` / `coral-ink` | #EA7C6A / #FBE6E1 / #A9412F | Palette C (accent only) — attention, SAMPLE/synthetic labels |
| `peach`, `stone` / `stone-ink` | #F6C9B4, #ECE6DF / #6A5F55 | Palette C — warm neutrals, "unknown" states |

Rules:
- Palettes A and B dominate. Coral is reserved for things that need attention: out-of-range results, professional flags, synthetic/simulated labels.
- Bright accents (teal, lime, coral) are **fills only**. For text, use the `-ink` variants, which are designed for WCAG AA on white. Contrast is to be measured formally in M3.10.
- **Unknown or missing data uses stone (neutral), never mint or teal**, so absence is never shown as normal.
- "Above or below lab range" uses coral, not red. It is a prompt to check, not an alarm.

## Typography

- Display: **Fraunces** (soft optical axis), used for page titles, card headlines and the wordmark.
- UI and body: **Manrope**.
- Eyebrows: 12px, semibold, 0.14em tracking, uppercase, `teal-ink`.

## Shape, depth, motion

- Cards: radius 1.25rem, 1px `line` ring, `shadow-soft` (a faint teal-tinted lift). No heavy glassmorphism.
- Pills: buttons and badges are fully rounded.
- Motion: only the orb "breathes" (7s). `prefers-reduced-motion` disables all animation. GSAP, Framer Motion and R3F arrive in M3.

## Components (M1)

`Button`/`ButtonLink` (primary, secondary, soft, danger) · `Card` · `SectionHeading` · `PageHeader` · `Badge` (neutral, teal, lime, coral, mist) · `RangeBadge` (vs lab range) · `ProvenanceTag` (you told us / extracted / calculated / AI interpretation / professional review / simulated review / synthetic) · `SyntheticBadge` · `Disclaimer` · `EmptyState` · `Orb` (CSS fallback).

## Layout

- Mobile (<1024px): sticky header, bottom tab bar with Home, Insights, Body, Plan and Discover. Timeline and Profile are reachable from the sidebar on desktop and the header on mobile (M3).
- Desktop: 248px sidebar plus content up to 72rem wide.
- Verified at 390px with no horizontal scroll.

## Reference mapping (for M3)

Home → original orb identity · Insights → Core Medicine + Lably (hierarchy, attention indicators) · Biomarkers and Organs → BioTrack · Plan → Healthy + Oura · Wearables → Oura + Orbix · Doctor → Core Medicine + Lably · Landing → original editorial gradient identity. These are inspiration only: no copied layouts or assets.

## M3 — what changed and why

Principles applied (from a review against the brief):
- **One bold element: the orb.** Everything around it stays quiet. Hierarchy comes from Fraunces at display sizes and from layout, not from boxes.
- **Removed template tells:** uppercase tracked eyebrow labels, `A · B · C` metadata strings, and identical cards with identical shadows on everything.
- **Tide panel** (`.tide`, `.tide-alert`): an organic layered gradient reserved for the next move. It turns coral-tinted when the move is "see a professional".
- **Cards are for discrete objects** (a biomarker, an event). `raised` is used sparingly; lists use hairlines (`.hairline`).
- **Range rail:** the lab's own range as a mint band, the value as a marker (coral-ink only when outside), with the status also given in text. It answers "where am I relative to my lab's range" without relying on colour alone.

### Chart tokens (validated with the dataviz palette validator, light surface)

| Token | Hex | Use |
| --- | --- | --- |
| `chart-mark` | #0A8F84 | Single-series marks (bars, lines, markers) |
| `chart-alert` | #C24E3A | Out-of-range marker |
| `chart-band` | #DCF0E2 | Lab reference band |
| `chart-grid` | #E3EAE8 | Grid and tracks |

Validator result: lightness band, chroma floor, CVD ΔE 10.9 and contrast ≥ 3:1 all pass. Charts are single-series (title names the series, so no legend). Each has hover/focus tooltips with hit targets larger than the marks, and a table view.

### Motion

- **Orb:** shader uniforms ease towards per-state targets. With reduced motion (OS setting or the Profile toggle) it becomes the static CSS orb.
- **Landing intro (CSS only):** headline lines rise out of masks, then the copy and actions fade up, and the orb settles in (scale + blur). Content never depends on JavaScript to become visible; reduced motion zeroes durations **and delays**.
- **Landing scroll (GSAP, desktop only):** the hero orb recedes as you scroll; a lightweight CSS hand-off orb grows in beside the pinned "How it works" steps, and its state follows the active step (listening → thinking → answering), reversible.
- **Results reveal:** after a report upload, the companion shows a "Report read" summary: counts tween up, flagged results fade in staggered, and each range-rail marker glides from the band's start to its value (CSS `rail-in`, reduced motion = instant).
- **Framer Motion (`motion`)** is used only for expanding detail and new messages.

### 3D and fallbacks

| Feature | 3D | Fallback | Triggers fallback |
| --- | --- | --- | --- |
| Orb | R3F shader sphere | CSS gradient orb (same 5 states) | No WebGL, 3D off, reduced motion |
| Body map | Stylised primitive figure, drag to rotate | 2D SVG silhouette, same markers | Same |

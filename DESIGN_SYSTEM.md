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

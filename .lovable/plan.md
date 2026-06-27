# Hero Redesign + Payment Process Modal

## Scope
Single file: `src/pages/Index.tsx` (hero block, ~lines 58-168). No other files, no token/theme changes, no new deps.

## 1. Hero restructure (San Beda-inspired)

Replace the current two-column hero with a **layered hero**:

- **Background layers** (absolute, behind content):
  - Top half: existing light `bg-muted/30`.
  - Bottom-right diagonal zone: `bg-primary` block with `style={{ clipPath: "polygon(15% 100%, 100% 35%, 100% 100%)" }}` (tuned for desktop; collapses gracefully on mobile).
  - Giant faded crest watermark: existing `logo` import, `absolute`, `opacity-5`, scaled ~`w-[640px]`, positioned behind the headline.

- **Left column** (z-10):
  - Eyebrow: small uppercase tracked text in `text-primary` — "Welcome to the ASCI Payment Portal".
  - Headline: large `font-bold` "Pay your school fees **online**" with the highlighted word in `text-accent`.
  - Supporting paragraph (reuse current copy, trimmed).
  - CTA row:
    - Filled pill `Button` → "Sign In" (links to `/auth`, primary).
    - Plain text link "Learn more" (anchor to `#features`, underline on hover).
    - **New**: `Payment Process` button (outline/ghost variant) that opens the modal (see §2).

- **Right column** (z-10, asymmetric collage):
  - Front-left floating crest: `logo` image, rounded, soft shadow, overlaps the diagonal edge.
  - Two stacked rounded "photo cards" reskinned from existing content:
    - Card A (top, offset right): the ₦5.2M wallet mockup, restyled as a rounded `bg-gradient-primary` frame with `rounded-3xl`, `shadow-elegant`.
    - Card B (bottom, offset left, overlapping): Active Parents + Collection Rate stats, same rounded frame treatment.
  - Subtle `animate-fade-in` with staggered delays.

- **Info strip** (bridges hero into next section, `bg-primary text-primary-foreground rounded-2xl`, two columns):
  - Col 1: `Calendar` icon + bold "410+ Active Students" + one-line description + underlined "Learn more" link.
  - Col 2: `Clock` icon + bold "₦50M+ Transactions Processed" + one-line description + underlined "Learn more" link.

All colors via existing tokens only: `bg-primary`, `text-primary-foreground`, `text-accent`, `bg-muted`, `border`, `bg-gradient-primary`, `shadow-elegant`. Keep `animate-fade-in` entrances.

## 2. Payment Process modal

- Add a new **"Payment Process"** button in the hero CTA row (outline variant, `text-primary`).
- Wire it to a shadcn `Dialog` (`@/components/ui/dialog`) with local `useState` open flag.
- Modal content (titled **"How Parents & Students Pay"**) renders the 6-step summary previously confirmed:
  1. Virtual Account Assignment (Wema NUBAN per student).
  2. Payment Methods (bank transfer / Paystack card top-up).
  3. Automatic Wallet Credit (real-time reconciliation).
  4. Fee Settlement & Tracking (balance, history, notifications, audit trail).
  5. Payment Confirmation (digital receipts + admin sync).
  6. Security (PCI-DSS, bank-grade encryption).
- Each step rendered as a numbered list item with a small lucide icon (`Wallet`, `CreditCard`, `Zap`, `ListChecks`, `Receipt`, `ShieldCheck`) and one-line description. Scrollable on small screens (`max-h-[80vh] overflow-y-auto`).
- Footer of dialog: a `Sign In` button + `Close` button.

## Technical notes

- Imports to add in `Index.tsx`: `Calendar`, `Clock`, `Wallet`, `CreditCard`, `Zap`, `ListChecks`, `Receipt`, `ShieldCheck` from `lucide-react`; `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` from `@/components/ui/dialog`; `useState` from `react`.
- Diagonal zone uses inline `clipPath` polygon; on `<md` breakpoints render as a simple `bg-primary` bottom band instead (conditional classes).
- All existing sections (header, features, why-choose, testimonials, footer) untouched.
- No new assets, no new tokens, no new dependencies.

## Files changed
- `src/pages/Index.tsx` — hero section only + modal state/JSX.

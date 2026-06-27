## Objective
Strip the hero section down to a clean, professional headline + CTA layout.

## Changes

### `src/pages/Index.tsx` — Hero simplification

1. **Remove diagonal primary zone & mobile bottom band**
   - Delete the `clipPath` polygon div and the mobile `h-40` bottom band.

2. **Remove right collage column**
   - Delete the entire `<div className="relative h-[420px]...">` block containing:
     - Floating crest card
     - Wallet balance card (₦5.2M / ₦45,000)
     - Stats card (Active Parents / Collection Rate)
   - Keep only the left content column.

3. **Remove info strip**
   - Delete the entire `bg-primary text-primary-foreground` rounded-2xl block with:
     - "410+ Active Students"
     - "₦50M+ Transactions Processed"

4. **Reduce hero height**
   - Tighten vertical padding: `pt-8 md:pt-12 pb-16 md:pb-20` (or similar moderate spacing).
   - Remove `overflow-hidden` if no longer needed.
   - Keep the background as `bg-muted/30` (no diagonal shapes).

5. **Left content cleanup**
   - Keep eyebrow, headline, sub-headline, CTA row (Sign In, Payment Process, Learn more).
   - Keep faded watermark logo behind the text.

## What stays
- Header navigation
- Payment Process modal + button
- All sections below the hero (features, why-choose, testimonials, footer)
- All existing colors and tokens

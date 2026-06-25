Update the sidebar header in `src/components/dashboard/Sidebar.tsx`:

1. **Accessibility**
   - Set descriptive alt text: `alt="Ahmadiyya Science College Ilaro — Payment Portal (ASCI)"` on both expanded and collapsed logo images.
   - Wrap the logo in a `<NavLink to="/">` with `aria-label="ASCI Payment Portal — Home"` so screen readers announce it as a link to home.
   - Add `role="banner"` to the header container so it's announced as a landmark.

2. **Responsive, left-aligned header layout**
   - Replace the centered collapsed logo with a single left-aligned container used in both states.
   - Expanded: `flex items-center justify-start` with logo at `h-10 sm:h-12 md:h-14 w-auto max-w-full object-contain object-left`.
   - Collapsed (icon rail): `h-8 w-auto object-contain object-left mx-0`.
   - Header padding tightened to `px-3 py-3` so the logo can fill edge-to-edge without stretching.
   - Use `object-contain` (never `w-full` on the img) to guarantee no stretching and crisp scaling at all breakpoints.

3. **No other files change.** Behavior, routing, and the user profile block below the header remain unchanged.
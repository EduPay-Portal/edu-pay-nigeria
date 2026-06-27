## Hero: add right-column photo

### Asset
- Register the uploaded image (`user-uploads://imgi_2_carousel-1.jpg`) as a Lovable Asset:
  - `lovable-assets create --file /mnt/user-uploads/imgi_2_carousel-1.jpg --filename asci-students.jpg > src/assets/asci-students.jpg.asset.json`
- Import the pointer in `src/pages/Index.tsx`:
  - `import heroPhoto from "@/assets/asci-students.jpg.asset.json";`

### Layout change (`src/pages/Index.tsx`, hero section ~125–180)

Convert the current single-column hero into a responsive 2-column grid inside the existing `container`:

```text
grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center
```

- **Left column** — keep the existing eyebrow, headline, paragraph, and CTA row exactly as-is (Sign In, Payment Process, Learn more). Drop `max-w-2xl` since the column constrains width.
- **Right column** — new image block:
  ```tsx
  <div className="relative w-full animate-fade-in">
    <img
      src={heroPhoto.url}
      alt="ASCI students gathered on the school field"
      loading="eager"
      className="w-full h-56 sm:h-72 md:h-80 lg:h-[420px] object-cover rounded-[5px] shadow-xl"
    />
  </div>
  ```

### Responsive behavior
- **Mobile (<1024px)**: photo stacks **below** the text, full width, height `h-56` (sm) → `h-72`. Border radius 5px.
- **Tablet (md)**: same stacked layout, `h-80`.
- **Desktop (lg+)**: 2-column side-by-side, image `h-[420px]`, `object-cover` keeps it cropped cleanly.
- Faded crest watermark stays untouched.

### What stays
- Header, modal, payment steps, all sections below hero, all colors/tokens, animations.
- No new dependencies.

### Preview
After implementation, the preview updates live so you can confirm the look on desktop/tablet/mobile via the device switcher before considering it final.

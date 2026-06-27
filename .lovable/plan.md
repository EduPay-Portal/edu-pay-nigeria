## Fix: Hero image broken on Vercel deployment

### Root cause
The hero image uses a Lovable Assets pointer (`src/assets/asci-students.jpg.asset.json`) whose `url` is a **relative path**: `/__l5e/assets-v1/<id>/asci-students.jpg`. That path is only served by Lovable's preview/published hosting — Vercel has no such route, so the `<img>` 404s and shows the broken-image alt text.

### Fix
Move the image into the repo as a real bundled asset so Vite hashes and ships it with the Vercel build.

1. Download the binary from the Lovable CDN to `src/assets/asci-students.jpg` (using the `url` in the existing `.asset.json`).
2. Delete `src/assets/asci-students.jpg.asset.json` (no longer needed).
3. In `src/pages/Index.tsx`:
   - Replace `import heroPhoto from "@/assets/asci-students.jpg.asset.json"` with `import heroPhoto from "@/assets/asci-students.jpg"`.
   - Change the `<img>` `src={heroPhoto.url}` to `src={heroPhoto}`.

### Result
Vite emits the JPG to `/assets/asci-students-[hash].jpg` at build, so it works identically on Lovable preview, the Lovable published site, and your Vercel deployment. No CDN dependency, no config change.

Replace the existing EduPay logo (`src/assets/logo_edupay.png`) with the uploaded `asc-logo.png` across all references.

1. **Asset setup**: Copy the uploaded `asc-logo.png` into the project assets directory.
2. **Update references**:
   - `src/components/dashboard/Sidebar.tsx` — update the `logo` import and adjust display size if needed for the new image's aspect ratio.
   - `src/pages/Index.tsx` — update the `logo` import in the landing page header.
   - `src/pages/Auth.tsx` — update the `logo` import in the auth page left panel.
3. **Cleanup**: Remove the old `logo_edupay.png` file if no longer referenced.
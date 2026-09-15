# Student Bulk Upload: CSV Review and NIN/BVN Support

## Review of your uploaded file

`student_recordtest.csv` uses these columns:
First Name, Last Name, Email, Password, Admission Number, Class, Registration Number

The bulk upload screen expects a completely different set of columns:
SN, SURNAME, NAMES, CLASS, REG NO, MEMBER/NMEMBER, DAY/BOARDER, SCHOOL FEES, DEBTS

Result: the file will be rejected on upload with a "Missing required columns" message. It cannot be used as-is.

Other points:
- There is no NIN or BVN column in your file, and the bulk upload does not currently accept one either.
- Student records in the system do have places to store NIN, BVN and phone — they are just never filled during a bulk upload. Wema currently uses sandbox fallback identity values, which must be replaced with real ones before going live.
- Passwords in the file are ignored: the system creates the login email from the registration number and generates a password automatically.
- Rows with "Not Assigned" class and empty registration numbers will fail or create bad logins.

## What I'll build

1. **Sample CSV template** saved into the app (downloadable from the Bulk Import screen) with the exact required columns plus the new identity columns, and a few filled example rows.
2. **Add NIN / BVN / PHONE to bulk upload** end to end:
   - new columns on the import staging area
   - upload screen accepts and previews them (optional columns — upload still works without them)
   - student creation writes them onto the student record so Wema lookups return the student's real identity instead of the sandbox fallback
3. **Basic validation** on upload: NIN must be 11 digits, BVN must be 11 digits, phone in Nigerian format — invalid values are flagged in the preview rather than silently imported.
4. **Download template button** on the Bulk Import page so you always get the current correct format.

## Sample format (final)

```text
SN,SURNAME,NAMES,CLASS,REG NO,MEMBER/NMEMBER,DAY/BOARDER,SCHOOL FEES,DEBTS,NIN,BVN,PHONE
1,OPAYEMI,TOYEEBAT,SS 3,695,MEMBER,DAY,150000,0,12345678901,22345678901,08012345678
2,ODUNLAMI,ISLAMIYYAT,JSS 2,ADM-001409,NMEMBER,BOARDER,180000,25000,12345678902,22345678902,08012345679
```

Rules:
- SN: row number, must be unique.
- REG NO: required and unique — the student's login email is built from it.
- MEMBER/NMEMBER and DAY/BOARDER: exactly those words.
- SCHOOL FEES / DEBTS: numbers only, no currency symbol (commas tolerated).
- NIN / BVN: 11 digits each, optional but required before going live with real payments.
- PHONE: 080... or +234... format, optional.

## Technical notes

- Migration: add `NIN`, `BVN`, `PHONE` text columns to `students_import_staging` (nullable, no data loss; existing GRANT/RLS untouched).
- `src/components/admin/CSVUploadCard.tsx`: treat the three new columns as optional, map them into the staging insert, validate with a small zod schema, add a "Download template" button serving a static CSV from `public/`.
- `supabase/functions/bulk-create-students/index.ts`: read the new fields and include `nin`, `bvn`, `phone` in the `student_profiles` insert/update payload; skip empty values.
- `src/pages/dashboard/admin/BulkImportPage.tsx`: show an Identity column (NIN/BVN present or missing) in the staging table.
- No change to virtual account provisioning logic; it will simply find real identity values when present.

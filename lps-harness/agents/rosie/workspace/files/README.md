# files/

Stored assets — plant photos, source price-list PDFs, spec sheets, anything Chris sends.

- Save with a descriptive name (`agave-americana-15g.jpg`, `aps-pricing-2026.pdf`).
- Reference files by relative path from the record that uses them — an inventory entry's `attachments` array, or a job/customer file.
- Don't read large files into context wholesale; read on demand (convert PDFs via markitdown/pdftoppm, see the base prompt).

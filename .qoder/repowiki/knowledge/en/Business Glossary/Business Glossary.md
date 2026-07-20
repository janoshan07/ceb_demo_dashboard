---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### Master Data
- Definition：The authoritative customer profile dataset (Step 1) that defines the canonical Customer Directory entries. It is uploaded, validated, previewed, and approved independently of all other files; cross-file comparison against it occurs only in Step 6.

### CEB Assist
- Definition：One of the three source billing datasets (Step 2) originating from CEB's internal assist system. Uploaded, validated, previewed, and approved independently; later merged with NGEN and NPAY in Step 5.
- Aliases：CebAssist

### NGEN
- Definition：One of the three source billing datasets (Step 3) from the NGEN system. Uploaded, validated, previewed, and approved independently; includes internal kWh calculation checks during preview.

### NPAY
- Definition：One of the three source billing datasets (Step 4) from the NPAY system. Uploaded, validated, previewed, and approved independently; its Net Type and Name are later compared against Master Data in Step 6.

### Main Data Set
- Definition：The merged result of CEB Assist, NGEN, and NPAY produced in Step 5 by joining on Account No. It carries Errors, Warnings, Duplicates, and Valid records and supports Edit/Delete/Revalidate/Approve operations.
- Aliases：main dataset

### Customer Directory
- Definition：The final authoritative customer master table updated only after Step 6 approval (Master Data Comparison). It is not written until the full six-step workflow completes successfully.

### Account No.
- Definition：The join key used to merge CEB Assist, NGEN, and NPAY into the Main Data Set (Step 5) and to compare against Master Data profiles (Step 6).
- Aliases：account number

### Net Type
- Definition：A field in NGEN/NPAY billing records whose value is validated against the corresponding Master Data profile during Step 6 comparison.

### kWh calculations
- Definition：Internal energy-consumption computations performed during NGEN preview (Step 3) where Excel-provided values are checked against calculated ones.

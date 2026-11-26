# Curated evidence library (M2.1)

Source of truth: [`src/data/evidence/catalogue.ts`](../src/data/evidence/catalogue.ts). It holds 22 sources and 41 evidence notes.

## Rules

- **Verified before use.** Every source was fetched on 2026-11-27. The URL loaded, and the title, publisher and dates were recorded exactly as the page showed them. Uncertain dates carry a `dateNote`.
- **Own words.** Notes are Clarity's paraphrased summaries, not copied text. Each note links to its source URL.
- **No thresholds, no doses.** Notes leave out numeric diagnostic cut-offs and supplement doses. Clarity only compares results with the lab's own printed range. A test enforces the no-dose rule.
- **Never fabricated.** The AI may cite only the IDs of chunks it was given in that request. The safety layer drops anything else.
- **Stale embeddings fail tests.** After editing the catalogue, run `npm run evidence:embed`; a test fails if the embeddings are out of date.

## Sources

| Publisher | Topic | Date shown | Class |
| --- | --- | --- | --- |
| MedlinePlus (NLM/NIH) | How to understand lab results | updated 2025-09-04 | government patient information |
| MedlinePlus | Ferritin blood test | updated 2025-03-18 | government patient information |
| MedlinePlus | Liver function tests | updated 2023-12-05 | government patient information |
| MedlinePlus | Cholesterol levels | updated 2024-10-15 | government patient information |
| MedlinePlus | TSH test | updated 2024-10-30 | government patient information |
| MedlinePlus | HbA1c test | updated 2025-05-20 | government patient information |
| MedlinePlus | Creatinine test | updated 2023-12-05 | government patient information |
| MedlinePlus | Complete blood count | updated 2024-10-15 | government patient information |
| MedlinePlus | Vitamin D test | updated 2024-12-04 | government patient information |
| MedlinePlus | CRP test | updated 2025-06-11 | government patient information |
| MedlinePlus | Vitamin D | updated 2024-05-10 | government patient information |
| MedlinePlus | Iron | updated 2024-06-24 | government patient information |
| MedlinePlus | B vitamins | updated 2021-09-23 (oldest) | government patient information |
| MedlinePlus | Healthy sleep | updated 2025-12-09 | government patient information |
| National Kidney Foundation | eGFR | updated 2026-02-05 (unverified, see `dateNote`) | professional body patient information |
| NCCIH (NIH) | Omega-3 supplements | not verified | government patient information |
| NHLBI (NIH) | How much sleep is enough | updated 2022-03-24 | government patient information |
| NHS England | High cholesterol | reviewed 2026-03-13 | NHS guidance |
| NHS England | How to lower cholesterol | reviewed 2026-03-13 | NHS guidance |
| NHS England | Vitamin D | reviewed 2020-08-03; **review overdue since 2023-08-03** | NHS guidance |
| WHO | Physical activity | 2026-11-04 | international public health |
| WHO | Healthy diet | 2026-01-26 | international public health |

## Candidates from the brief that could not be used

| Source | Result | Replacement |
| --- | --- | --- |
| NIH Office of Dietary Supplements | HTTP 403 / bot verification (not bypassed) | MedlinePlus nutrient pages, NCCIH, NHS |
| NICE NG238 | HTTP 403 | NHS cholesterol pages |

Both can be added later through a manual review, by someone reading the pages in a browser, without changing any code.

## Known gaps

- There is no source specific to thyroid lifestyle advice, by design: thyroid results are routed to a professional.
- B12 coverage is thin (only the general MedlinePlus B-vitamins page).
- The NHS vitamin D page is past its review date. It is flagged in its source limitations.

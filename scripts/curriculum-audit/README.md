# Independent Course Tree curriculum audit

This is a read-only verification tool, not an importer or a data repair. It reads the runtime JSON that Course Tree actually uses. It imports no application filtering, importer, normalization or old coverage-validation code.

Evidence has three independent layers:

1. The original 2025–2026 PDF is freshly read with **pdfplumber 0.11.9 / pdfminer.six 20251230**, a different extraction engine from the importer. It records raw printed IDs, coordinates and page text. Geometry/identifier occurrence is not evidence of a mandatory/elective role.
2. Separate AI-assisted source reviews transcribe bounded course lists, mandatory/optional distinctions and logical conditions from the original PDF. Their source quotes and original-PDF SHA-256 are recorded. Visual review means the assistant inspected the source image, not university approval. Syntactically different logic is unresolved unless equivalence or an independently reviewed counterexample is established. These review oracles can themselves contain mistakes; review-scope corrections are explicitly recorded.
3. Direct official Technion OData responses independently supply names, credits, offering-unit labels and structured strong prerequisites. Each runtime course is compared only with its own stored source term. No third-party export is used as source truth, no other term is substituted, and no prerequisite is inferred from semester order.

## Run

Use the updated pinned environment. The earlier pdfminer.six 20250506 pin has known CMap deserialization advisories. Historical audit reports retain their original engine versions and hashes. New extraction outputs need a separate output directory and input lock.

Python 3.11+ and Node 22+ are sufficient. The comparison core uses the Python standard library. PDF extraction and PDF security regressions need the pinned packages.

```sh
python3 -m venv .cache/independent-audit-venv
.cache/independent-audit-venv/bin/python -m pip install -r scripts/curriculum-audit/requirements.txt
.cache/independent-audit-venv/bin/python scripts/curriculum-audit/extract_source.py \
  --pdf /absolute/path/catalog2025-26.pdf \
  --output .cache/curriculum-audit/source.json

# Read-only official term evidence; cached original responses are checksum-pinned.
node scripts/curriculum-audit/fetch_official.mjs

# Generate the initial assessment; never changes application/curriculum data.
python3 scripts/curriculum-audit/run_audit.py --pdf /absolute/path/catalog2025-26.pdf

# Test the audit mechanism in four explicitly separated categories.
python3 -m unittest discover -s scripts/curriculum-audit/tests -v

# Actual academic source comparison: exits 2 if confirmed published errors remain.
python3 scripts/curriculum-audit/run_audit.py \
  --pdf /absolute/path/catalog2025-26.pdf --fail-on-confirmed
```

On Windows a virtual environment uses `Scripts/python.exe` instead of `bin/python`. This task host required the approved Windows command runner because the workspace sandbox runner could not initialize. This limitation does not change the audit's read-only scope.

After explicitly updating curricula, preserve the initial assessment and generate a new output directory against the same independently maintained reviews:

```sh
python3 scripts/curriculum-audit/run_audit.py \
  --pdf /absolute/path/catalog2025-26.pdf \
  --reviews audits/curriculum-accuracy/reviews \
  --output audits/curriculum-accuracy/after-corrections \
  --fail-on-confirmed
```

The old input lock intentionally rejects overwriting an initial assessment with changed runtime data. A new PDF needs fresh extraction and new source reviews; old assertions never qualify against a different PDF checksum. `fetch_official.mjs --refresh` obtains a new live service snapshot; preserve previous responses/manifest for historical reproducibility.

## Outputs and interpretation

- `audits/curriculum-accuracy/accuracy-report.md`: measured assessment, all faculties and every path.
- `accuracy-report.json`: every identified requirement claim, full expected/actual comparisons, evidence registry, source API records, course checks and year deltas.
- `requirements.csv`: full claim ledger; evidence IDs resolve to full quotes in JSON `sourceEvidence`.
- `discrepancies.csv`: confirmed and unresolved curriculum findings with path/course/group, expected, actual, exact PDF page, severity and confidence.
- `official-course-differences.csv`: term-specific metadata/strong-logic differences; historical empty rules and renamed unit labels remain unresolved.
- `manual-review.md`: twelve strategic questions across source areas, plus risky paths.
- `input-lock.json`: unchanged runtime hashes, original PDF hash, extraction hash, review hashes and audit-tool hashes.

The denominator is **identified database claims plus independently discovered missing requirements**, not a claim that every true catalog requirement has been discovered. Each list has a separate completeness obligation; missing obligations cannot be passed by matching a few members. Shared facts are path-specific instances. Source-checked coverage, confirmed-correct coverage and agreement on the checked subset are different metrics. The deliberately risk-weighted subset is not a statistical estimate of whole-database accuracy.

Structural/internal tests establish shape or consistency only. The existing importer coverage report and its `verified-listed` flags contribute no verification credit. A test suite passing means the audit mechanism passed its tests; the actual source accuracy gate can and currently does fail.

A confirmed discrepancy in an advertised inventory-only entry is a coverage gap, distinguished from an incorrectly published claim. Missing source IDs or unavailable official records do not prove that a course does not exist. Numeric PDF cells remain credit candidates until column/context is established; official matching-term credit values are reported separately. Current names/unit labels can differ from historical snapshots. Empty historical prerequisite responses do not establish that old edges were wrong; those cases require archival confirmation. Concurrent prerequisite semantics remain unverified.
# Human review decisions

`decisions.json` is the record of every human decision on an inventory entry. It is append-only:
add a new object, never edit or delete an old one. Changes arrive by pull request, so each decision
has an author, a timestamp and a reviewable diff.

```json
{"slug": "deonar", "decision": "analyst_reviewed", "reviewer": "A. Analyst",
 "organisation": "Example State Pollution Control Board", "date": "2026-10-02",
 "note": "Plume aligned with landfill cells 3-4; recommend EMIT tasking."}
```

`decision` is one of:
- `analyst_reviewed`: evidence examined by an analyst; entry stands as a candidate
- `partner_verified`: a regulatory partner confirmed the source on the ground or with a high-resolution instrument
- `rejected`: the entry is not a real source (reason in `note`); it stays listed, marked rejected
- `needs_field_check`: the analyst asks for a site visit or a Carbon Mapper / EMIT / GHGSat overpass

Until a site has a decision it is shown as "Machine candidate: awaiting analyst review".
Public pages show the decision, date and organisation; notes are visible to signed-in partners only.
The inventory workflow validates this file and fails loudly on an unknown decision value.

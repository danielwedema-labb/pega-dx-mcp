---
name: search-case
description: Search for a Pega case by short ID (e.g. "C-1001") and retrieve its full details using a two-step data view lookup followed by a full case fetch.
---

# search-case

Use this skill when the user provides a short case ID and wants to find and view the full case details.

## When to use

- User says something like "what is the status of case C-1001" or "find case 1001"
- You have a short/partial case ID but need the full case record

## Steps

### Step 1 — Search the data view

Call `get_list_data_view` with a filter matching the short case ID:

```json
{
  "dataViewID": "D_pySearch",
  "dataViewParameters": {
    "SearchString": "<short case ID>"
  }
}
```
IMPORTANT: do NOT wrap the dataViewParameters object as a string, it is an OBJECT with key-value pairs.

### Step 2 — Handle the result

| Outcome | Action |
|---|---|
| 0 results | Tell the user no case was found with that ID |
| 1 result | Extract `pzInsKey` from the row — this is the full case ID |
| 2+ results | List all matching cases and ask the user to clarify |

### Step 3 — Fetch full case details

Call `get_case` with the full case ID resolved in Step 2:

```json
{
  "caseID": "<value of pzInsKey>"
}
```

Return the complete case information to the user.

## Notes

- `pyID` is the short case ID field (e.g. `"C-1001"`)
- `pzInsKey` is the full case ID field (e.g. `"MYORG-APP-WORK C-1001"`)
- If the data view uses different field names, ask the user to confirm before proceeding

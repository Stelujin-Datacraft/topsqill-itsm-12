# VALUE_OF() Syntax - Copy Field Values

## The Problem You Had
When you write `VALUE_OF("field-id")`, you want to copy the **actual value** from that field, NOT store the literal text "VALUE_OF(...)".

## How It Works Now

### ✅ To Copy a Field Value:
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-field") = VALUE_OF("source-field-id")
WHERE true;
```
**Result:** The actual VALUE from `source-field-id` is copied to `target-field`

### ✅ To Store Static Text:
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-field") = "Hello World"
WHERE true;
```
**Result:** The literal text "Hello World" is stored in `target-field`

### ✅ To Store a Number:
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-field") = 42
WHERE true;
```
**Result:** The number 42 is stored in `target-field`

## What Changed
The parser now correctly recognizes `VALUE_OF("field-id")` and converts it internally to extract the actual field value instead of storing the literal text.

## Console Logs to Verify It's Working

When you run a VALUE_OF query, look for these logs:

**Parsing stage:**
```
✅ Found field reference patterns: ["VALUE_OF(\"...\")"]
  - Replacing: VALUE_OF("...") -> FIELD_REF::...
✅ Transformed value: FIELD_REF::...
```

**Execution stage:**
```
📋 UPDATE Executor - COPYING VALUE FROM FIELD
📋 Source field value: [the actual data from the source field]
✅ Final value to store: [the actual data]
```

If you see "No field references found", the syntax wasn't recognized properly.

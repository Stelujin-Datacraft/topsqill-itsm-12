# 🔧 INSERT Query Fix Applied

## What Was the Problem?

The regex pattern for parsing INSERT queries had a critical bug:
```javascript
// OLD BUGGY REGEX:
(?:\(([^)]+)\))?  // This stops at the first ) character!
```

When you used `FIELD("field-id")`, the regex would stop at the `)` inside `FIELD()` instead of the closing `)` of the column list.

**Your query:**
```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90")) VALUES (12345)
```

**Was being parsed as:**
- Form ID: ✅ `bac30b0c-3010-46ac-9afc-f85382ed50e1`
- Columns: ❌ `FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90"` (missing closing `)`)
- Values: ❌ Failed to match

## The Fix

New regex pattern that handles nested parentheses:
```javascript
// NEW WORKING REGEX:
\(([^)]*(?:\([^)]*\)[^)]*)*)\)  // Handles nested () properly!
```

This pattern:
1. Matches non-parenthesis content
2. Optionally matches nested `()` groups
3. Continues matching until the final closing `)`

## Try Your Query Again!

```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90")) VALUES (12345)
```

This should now execute successfully! ✅

## Debug Logging Added

If you still encounter issues, check the browser console for debug logs:
- `INSERT Query Debug` - Shows parsed form ID and columns
- `VALUES Debug` - Shows parsed values

These logs will help identify any remaining parsing issues.

## More Complex Examples Now Work!

```sql
-- Multiple FIELD() columns
INSERT INTO "form-id" 
  (FIELD("field-1"), FIELD("field-2"), FIELD("field-3")) 
VALUES (123, 'text', 456)

-- Mixed FIELD() and field names
INSERT INTO "form-id" 
  (FIELD("field-1"), "Field Name", FIELD("field-3")) 
VALUES (123, 'text', 456)

-- Nested functions in VALUES (coming soon!)
INSERT INTO "form-id" (FIELD("field-1")) 
VALUES (CONCAT("Hello", " World"))
```

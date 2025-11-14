# 📋 Field Value Copy Syntax Guide

## Understanding the Difference

When updating fields, there are TWO different things you can do:

### ❌ Store Literal Text
```sql
-- This stores the text "hello" literally
SET FIELD("target-id") = 'hello'
```

### ✅ Copy Field Value  
```sql
-- This COPIES the VALUE from another field
SET FIELD("target-id") = FIELD("source-id")

-- Alternative syntax (same result):
SET FIELD("target-id") = VALUE_OF("source-id")
```

---

## 🔍 How to Tell What's Happening

### Syntax Indicators:

| Syntax | What it Does | Example |
|--------|-------------|---------|
| `= 'text'` | Stores literal text "text" | `= 'Approved'` |
| `= FIELD("id")` | Copies value from field | `= FIELD("6c9dbb2d...")` |
| `= VALUE_OF("id")` | Copies value from field | `= VALUE_OF("6c9dbb2d...")` |
| `= 123` | Stores number 123 | `= 42` |

---

## 📝 Complete Examples

### Example 1: Copy Field to Field
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("c6f5038c-e8fb-45db-bd5f-6b83278ad9d9") = FIELD("00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4")
WHERE true;
```

**What happens:**
- Reads the value from field `00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4`
- Writes that value into field `c6f5038c-e8fb-45db-bd5f-6b83278ad9d9`
- For all submissions (`WHERE true`)

**Example:**
- If source field contains: `"John Doe"`
- Target field will contain: `"John Doe"` (the actual value, not the text "FIELD(...)")

---

### Example 2: Using VALUE_OF (Same as FIELD)
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-id") = VALUE_OF("source-id")
WHERE true;
```

**Why VALUE_OF?**
- More explicit about copying a value
- Same functionality as FIELD()
- Choose whichever is clearer to you

---

### Example 3: Mix Field Values and Text
```sql
UPDATE FORM "form-id"
SET FIELD("full-name-id") = CONCAT(FIELD("first-name-id"), ' ', FIELD("last-name-id"))
WHERE true;
```

**What happens:**
- Takes value from first name field
- Adds a space ' '
- Adds value from last name field
- Stores combined result in full name field

---

### Example 4: Calculate from Field Values
```sql
UPDATE FORM "form-id"
SET FIELD("total-id") = FIELD("quantity-id") * FIELD("price-id")
WHERE true;
```

**What happens:**
- Gets quantity value (e.g., 5)
- Gets price value (e.g., 10)
- Multiplies them (5 * 10 = 50)
- Stores 50 in total field

---

### Example 5: Conditional Copy
```sql
UPDATE FORM "form-id"
SET FIELD("result-id") = CASE
  WHEN FIELD("score-id") >= 80 THEN FIELD("pass-message-id")
  ELSE FIELD("fail-message-id")
END
WHERE true;
```

**What happens:**
- Checks score value
- If >= 80: copies value from pass-message field
- Otherwise: copies value from fail-message field

---

## 🐛 Debugging: Is it Working?

### Check Console Logs

When you run an UPDATE query, check browser console for:

```
📝 UPDATE Parser - Input query: [your query]
📝 UPDATE Parser - Parsed components:
  - Form ID: [form-uuid]
  - Target Field ID: [target-field-uuid]
  - Value Expression (raw): FIELD("source-field-uuid")
  - Where Clause: true

🔍 UPDATE Parser - Looking for FIELD() or VALUE_OF() references
  - Found matches: 1
✅ UPDATE Parser - Matched field reference with UUID: [source-field-uuid]
✅ UPDATE Parser - Transformed value: FIELD_REF::[source-field-uuid]

🔄 UPDATE Executor - Processing submission: [submission-id]
🔄 UPDATE Executor - Value expression: FIELD_REF::[source-field-uuid]
🔄 UPDATE Executor - Copying from field: [source-field-uuid]
🔄 UPDATE Executor - Source value: [actual-value]
🔄 UPDATE Executor - Final new value: [actual-value]
```

### What to Look For:

✅ **Good Signs:**
- `Found matches: 1` (or more)
- `Matched field reference with UUID`
- `Transformed value: FIELD_REF::`
- `Source value:` shows actual value, not "FIELD(...)"

❌ **Bad Signs:**
- `Found matches: 0`
- `No FIELD() references found`
- `Source value: FIELD("...")`  ← Literal text instead of value

---

## 🔧 Common Issues

### Issue 1: Quotes Not Matching
```sql
❌ FIELD('id')    -- Wrong quote style
✅ FIELD("id")    -- Correct double quotes
✅ VALUE_OF("id") -- Also correct
```

### Issue 2: Spaces in FIELD()
```sql
❌ FIELD( "id" )  -- Extra spaces might cause issues
✅ FIELD("id")    -- No spaces preferred
```

### Issue 3: Field ID Format
```sql
❌ FIELD(field-name)          -- Not a UUID
❌ FIELD("field-name")        -- Field name, not ID
✅ FIELD("6c9dbb2d-1dd4...")  -- Correct UUID format
```

### Issue 4: Missing Quotes
```sql
❌ FIELD(6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90)    -- No quotes
✅ FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90")  -- With quotes
```

---

## 📊 Finding Your Field IDs

### Method 1: Query Form Fields
```sql
SELECT id, label, field_type 
FROM form_fields 
WHERE form_id = "your-form-id"
ORDER BY label;
```

### Method 2: Check Submission Data
```sql
SELECT submission_data 
FROM form_submissions 
WHERE form_id = "your-form-id" 
LIMIT 1;
```

The JSON keys are your field IDs.

### Method 3: Check Browser DevTools
1. Open browser console
2. Run UPDATE query
3. Look for log line: `Target Field ID: ...`
4. Copy the UUID shown

---

## 🎯 Quick Reference Card

| Goal | Syntax | Example |
|------|--------|---------|
| Copy field value | `FIELD("source-id")` | `= FIELD("abc123...")` |
| Copy field value (alt) | `VALUE_OF("source-id")` | `= VALUE_OF("abc123...")` |
| Static text | `'text'` | `= 'Approved'` |
| Static number | `123` | `= 42` |
| Add numbers | `FIELD("id1") + FIELD("id2")` | `= FIELD("a") + FIELD("b")` |
| Uppercase | `UPPER(FIELD("id"))` | `= UPPER(FIELD("name"))` |
| Combine text | `CONCAT(FIELD("a"), FIELD("b"))` | `= CONCAT(FIELD("first"), ' ', FIELD("last"))` |

---

## 💡 Pro Tips

1. **Test First**: Use `WHERE submission_id = 'specific-id'` to test on one submission
2. **Check Logs**: Always check console logs to see what's happening
3. **Use VALUE_OF**: If FIELD() seems confusing, try VALUE_OF() - it's more explicit
4. **Backup Data**: Before mass updates, backup your data or test on a copy
5. **Field Types**: Ensure source and target fields have compatible data types

---

## ❓ Still Having Issues?

If the query is still storing literal text "FIELD(...)" instead of the value:

1. ✅ Check console logs for parsing errors
2. ✅ Verify field ID is a valid UUID (36 characters with dashes)
3. ✅ Ensure quotes are double quotes `"` not single `'`
4. ✅ Try VALUE_OF() syntax instead
5. ✅ Check if source field has a value (not null/empty)

Share the console logs and we can debug together!

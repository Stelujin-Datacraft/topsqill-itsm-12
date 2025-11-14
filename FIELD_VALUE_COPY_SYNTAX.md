# 📋 Field Value Copy Syntax Guide

## ⚡ Quick Start

### To COPY a field value:
```sql
-- Method 1: Using FIELD()
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-field-id") = FIELD("source-field-id")
WHERE true;

-- Method 2: Using VALUE_OF() (clearer, recommended)
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-field-id") = VALUE_OF("source-field-id")
WHERE true;
```

**Result:** The actual value from `source-field-id` will be copied to `target-field-id`.

### To STORE literal text:
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-field-id") = 'Approved'
WHERE true;
```

**Result:** The text "Approved" will be stored in `target-field-id`.

---

## 🔑 KEY CONCEPT: Two Different Operations

When you write an UPDATE query, you need to be VERY CLEAR about whether you want to:

### 1️⃣ COPY a field's value (use FIELD() or VALUE_OF())
```sql
-- ✅ This COPIES the actual value from the source field
SET FIELD("target-id") = FIELD("source-id")
SET FIELD("target-id") = VALUE_OF("source-id")

-- Example: If source field contains "John Doe"
-- Result: Target field will contain "John Doe" (the actual value)
```

### 2️⃣ STORE literal text (use quotes)
```sql
-- ✅ This stores the literal text "hello"
SET FIELD("target-id") = 'hello'

-- Result: Target field will contain exactly "hello"
```

### ❌ COMMON MISTAKE: Wrong syntax
```sql
-- ❌ This would store the TEXT "FIELD("source-id")" literally
-- (if the parser doesn't recognize it as a field reference)
SET FIELD("target-id") = 'FIELD("source-id")'
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

## 🐛 How to Tell If It's Working

### Console Log Patterns

When you run an UPDATE query, check your browser console. You should see logs like this:

#### ✅ CORRECT: Field value is being copied
```
📝 UPDATE Parser - Value Expression (raw): FIELD("00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4")
🔍 UPDATE Parser - Looking for FIELD() or VALUE_OF() references
  - Found matches: 1
  - Match 1: FIELD("00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4") -> UUID: 00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4
✅ UPDATE Parser - Transforming field reference: FIELD("...") -> FIELD_REF::00516cd7-...
✅ UPDATE Parser - Final transformed value: FIELD_REF::00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 UPDATE Executor - Processing submission: abc-123
🔄 UPDATE Executor - Value expression received: FIELD_REF::00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4
  - Starts with FIELD_REF::? true
📋 UPDATE Executor - COPYING VALUE FROM FIELD
📋 Source field ID: 00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4
📋 Source field value: "John Doe"
📋 Value to copy: "John Doe"
✅ UPDATE Executor - Final value to store: "John Doe"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### ❌ WRONG: Literal text being stored
```
📝 UPDATE Parser - Value Expression (raw): FIELD("00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4")
🔍 UPDATE Parser - Looking for FIELD() or VALUE_OF() references
  - Found matches: 0
ℹ️ UPDATE Parser - No FIELD() or VALUE_OF() references found
  - This will be treated as a static value

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 UPDATE Executor - Processing submission: abc-123
🔄 UPDATE Executor - Value expression received: FIELD("00516cd7-...")
  - Is static value? true
💾 UPDATE Executor - Using STATIC VALUE (not copying from field)
💾 Static value after quote removal: FIELD("00516cd7-...")
✅ UPDATE Executor - Final value to store: FIELD("00516cd7-...")  ❌ WRONG!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### What the Logs Tell You

| Log Message | Meaning |
|-------------|---------|
| `Found matches: 1` or more | ✅ Parser recognized your FIELD() reference |
| `Found matches: 0` | ❌ Parser didn't recognize it - check your syntax |
| `COPYING VALUE FROM FIELD` | ✅ Executor is copying the actual field value |
| `Using STATIC VALUE` | ⚠️ Executor is storing literal text |
| `FIELD_REF::` in value | ✅ Transformation succeeded |
| No `FIELD_REF::` prefix | ❌ Transformation failed - syntax issue |

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

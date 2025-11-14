# UPDATE Query Examples - Copy Field Values

## Basic Field Value Copy

Copy the value from one field to another for all submissions:

```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("c6f5038c-e8fb-45db-bd5f-6b83278ad9d9") = FIELD("00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4")
WHERE true;
```

**What it does:**
- Copies the value from field `00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4` (source)
- Into field `c6f5038c-e8fb-45db-bd5f-6b83278ad9d9` (target)
- For all submissions in the form (`WHERE true`)

---

## Conditional Field Copy

Copy field value only when a condition is met:

```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("target-field-id") = FIELD("source-field-id")
WHERE FIELD("status-field-id") = 'approved';
```

**What it does:**
- Only copies the value when the status field equals 'approved'

---

## Copy with Static Text

Set a field to a static text value:

```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("c6f5038c-e8fb-45db-bd5f-6b83278ad9d9") = 'Completed'
WHERE true;
```

---

## Copy with Arithmetic

Copy a field value and perform calculations:

```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("total-field-id") = FIELD("price-field-id") * 1.1
WHERE true;
```

**What it does:**
- Takes the value from `price-field-id`
- Multiplies it by 1.1 (adds 10%)
- Stores result in `total-field-id`

---

## Copy with Function

Use SQL functions to transform the value:

```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("uppercase-name-id") = UPPER(FIELD("name-field-id"))
WHERE true;
```

**Available functions:**
- `UPPER()` - Convert to uppercase
- `LOWER()` - Convert to lowercase
- `CONCAT()` - Combine values
- `TRIM()` - Remove whitespace
- `ROUND()` - Round numbers
- `ABS()` - Absolute value

---

## Copy with CASE WHEN

Conditional value assignment:

```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("category-id") = CASE 
  WHEN FIELD("score-id") >= 90 THEN 'Excellent'
  WHEN FIELD("score-id") >= 70 THEN 'Good'
  ELSE 'Needs Improvement'
END
WHERE true;
```

---

## Multiple Field Operations

Perform different updates based on conditions:

### Example 1: Copy different source fields based on status
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("result-field-id") = CASE 
  WHEN FIELD("type-id") = 'A' THEN FIELD("value-a-id")
  WHEN FIELD("type-id") = 'B' THEN FIELD("value-b-id")
  ELSE FIELD("default-value-id")
END
WHERE true;
```

### Example 2: Calculate based on multiple fields
```sql
UPDATE FORM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
SET FIELD("total-id") = FIELD("subtotal-id") + FIELD("tax-id") + FIELD("shipping-id")
WHERE true;
```

---

## Common Use Cases

### 1. **Backup Field Value**
```sql
-- Copy current value to a backup field before changes
UPDATE FORM "form-id"
SET FIELD("backup-field-id") = FIELD("original-field-id")
WHERE true;
```

### 2. **Normalize Data**
```sql
-- Convert all names to uppercase
UPDATE FORM "form-id"
SET FIELD("name-id") = UPPER(FIELD("name-id"))
WHERE true;
```

### 3. **Calculate Totals**
```sql
-- Calculate total from quantity and price
UPDATE FORM "form-id"
SET FIELD("total-id") = FIELD("quantity-id") * FIELD("price-id")
WHERE FIELD("quantity-id") > 0;
```

### 4. **Status Updates**
```sql
-- Update status based on score
UPDATE FORM "form-id"
SET FIELD("status-id") = CASE 
  WHEN FIELD("score-id") >= 80 THEN 'Pass'
  ELSE 'Fail'
END
WHERE FIELD("score-id") IS NOT NULL;
```

### 5. **Data Migration**
```sql
-- Migrate data from old field to new field
UPDATE FORM "form-id"
SET FIELD("new-field-id") = FIELD("old-field-id")
WHERE FIELD("new-field-id") IS NULL;
```

---

## Important Notes

1. **Field IDs**: Use actual field UUIDs, not field labels
2. **WHERE Clause**: 
   - Use `WHERE true` to update all submissions
   - Use specific conditions to update only matching submissions
3. **Data Types**: Ensure source and target fields have compatible data types
4. **Quotes**: Field IDs must be in double quotes inside FIELD()
5. **Testing**: Test on a single submission first using `WHERE submission_id = 'specific-id'`

---

## Finding Field IDs

You can find field IDs by:
1. Querying the form structure:
```sql
SELECT * FROM form_fields WHERE form_id = 'your-form-id';
```

2. Looking at submission data:
```sql
SELECT submission_data FROM form_submissions WHERE form_id = 'your-form-id' LIMIT 1;
```

The keys in `submission_data` are the field IDs.

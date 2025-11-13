# Quick INSERT Test Examples

## ✅ Your Queries - Now Fixed!

### Query 1: Using Field Name
```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (Number Input) VALUES (12345)
```
**Status:** ✅ Should work now!

### Query 2: Using FIELD() with Field ID
```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90")) VALUES (12345)
```
**Status:** ✅ Now supported! This is the easiest way to use field IDs.

## 📝 Valid INSERT Syntax Options

### Option 1: Using FIELD() with Field ID (Easiest for Copy-Paste)
```sql
INSERT INTO "form-uuid-here" (FIELD("field-uuid-here")) VALUES (value)
```

### Option 2: Using Field Name
```sql
INSERT INTO "form-uuid-here" (field_name) VALUES (value)
```

### Option 3: Using Field ID Directly
```sql
INSERT INTO "form-uuid-here" ("field-uuid-here") VALUES (value)
```

### Option 4: Without INTO keyword
```sql
INSERT "form-uuid-here" (FIELD("field-uuid-here")) VALUES (value)
```

### Option 5: Without quotes on form ID
```sql
INSERT INTO form-uuid-here (FIELD("field-uuid-here")) VALUES (value)
```

## 🎯 What Changed?

1. ✅ INSERT queries are now allowed (previously only SELECT and UPDATE were allowed)
2. ✅ The FORM keyword is optional
3. ✅ The INTO keyword is optional
4. ✅ You can use field names, field IDs, OR FIELD("field-id") syntax
5. ✅ Form ID can be with or without quotes
6. ✅ FIELD() syntax makes it super easy to copy-paste field IDs

## 🚀 Try These Now!

Replace `bac30b0c-3010-46ac-9afc-f85382ed50e1` with your actual form ID and try:

```sql
-- Using FIELD() syntax (Recommended - Easy Copy-Paste!)
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90")) VALUES (12345)

-- Multiple columns with FIELD() syntax
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90"), FIELD("another-field-id")) VALUES (12345, 'Hello')

-- Using field names
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" ("Number Input", "Text Field") VALUES (12345, 'Hello')

-- Using field IDs directly
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" ("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90") VALUES (12345)

-- Mixed syntax (FIELD() and field names)
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90"), "Text Field") VALUES (12345, 'Hello')
```

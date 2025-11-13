# Quick INSERT Test Examples

## ✅ Your Queries - Now Fixed!

### Query 1: Using Field Name
```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (Number Input) VALUES (12345)
```
**Status:** ✅ Should work now!

### Query 2: Using Field ID with FIELD() (Note: Syntax Error in Your Query)
Your original query had a syntax error. Here's the corrected version:

**❌ Your Query (had syntax error):**
```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" (FIELD("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90") VALUES (12345)
```

**✅ Correct Syntax Option 1 (Direct Field ID):**
```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" ("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90") VALUES (12345)
```

**✅ Correct Syntax Option 2 (Field Name):**
```sql
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" ("Number Input") VALUES (12345)
```

## 📝 Valid INSERT Syntax Options

### Option 1: Without FORM keyword (Recommended)
```sql
INSERT INTO "form-uuid-here" (field_name) VALUES (value)
```

### Option 2: Without INTO keyword
```sql
INSERT "form-uuid-here" (field_name) VALUES (value)
```

### Option 3: Without quotes on form ID
```sql
INSERT INTO form-uuid-here (field_name) VALUES (value)
```

### Option 4: Using Field IDs directly
```sql
INSERT INTO "form-uuid-here" ("field-uuid-here") VALUES (value)
```

## 🎯 What Changed?

1. ✅ INSERT queries are now allowed (previously only SELECT and UPDATE were allowed)
2. ✅ The FORM keyword is optional
3. ✅ The INTO keyword is optional
4. ✅ You can use either field names OR field IDs
5. ✅ Form ID can be with or without quotes

## 🚀 Try These Now!

Replace `bac30b0c-3010-46ac-9afc-f85382ed50e1` with your actual form ID and try:

```sql
-- Simple insert
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" ("Number Input") VALUES (12345)

-- Multiple columns
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" ("Number Input", "Text Field") VALUES (12345, 'Hello')

-- Using field IDs
INSERT INTO "bac30b0c-3010-46ac-9afc-f85382ed50e1" ("6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90") VALUES (12345)
```

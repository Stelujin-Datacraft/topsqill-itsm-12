# INSERT Query Syntax Guide - NEW Features! 🎉

## ✨ What's New

Two major improvements to INSERT queries:

1. **FORM keyword is now OPTIONAL** - Write cleaner queries!
2. **Use Field IDs OR Field Names** - Maximum flexibility!

---

## 📖 Syntax Comparison

### OLD Syntax (Still Works)
```sql
INSERT INTO FORM your-form-id (FieldName1, FieldName2)
VALUES ('value1', 'value2')
```

### NEW Syntax (Cleaner!)
```sql
-- Without FORM keyword
INSERT INTO your-form-id (FieldName1, FieldName2)
VALUES ('value1', 'value2')

-- Using field IDs instead of names
INSERT INTO your-form-id (field-uuid-1, field-uuid-2)
VALUES ('value1', 'value2')

-- Mix field IDs and names!
INSERT INTO your-form-id (FieldName1, field-uuid-2, FieldName3)
VALUES ('value1', 'value2', 'value3')
```

---

## 🎯 Quick Examples

### Example 1: Basic INSERT (No FORM keyword)
```sql
INSERT INTO 763790c6-af5b-4a67-9125-38df5ddb4b7c (Name, Email, Phone)
VALUES ('John Doe', 'john@example.com', '555-1234')
```

### Example 2: INSERT with Field IDs
```sql
INSERT INTO 763790c6-af5b-4a67-9125-38df5ddb4b7c 
  (f1e2d3c4-a5b6-7c8d-9e0f-1a2b3c4d5e6f, 
   g2f3e4d5-b6c7-8d9e-0f1a-2b3c4d5e6f7g)
VALUES ('Alice Smith', 'alice@example.com')
```

### Example 3: Mixed Field IDs and Names
```sql
INSERT INTO your-form-id 
  (Name,                                    -- Field name
   f1e2d3c4-a5b6-7c8d-9e0f-1a2b3c4d5e6f,  -- Field ID
   Status)                                  -- Field name
VALUES ('Bob Johnson', 'bob@example.com', 'Active')
```

### Example 4: INSERT with SELECT (No FORM keyword)
```sql
INSERT INTO target-form-id (CustomerName, Email, Total)
SELECT Name, Email, Amount
FROM FORM source-form-id
WHERE Status = 'Active'
```

### Example 5: All Field IDs with SELECT
```sql
INSERT INTO form-abc-123 
  (field-id-1, field-id-2, field-id-3)
SELECT 
  field-id-a,
  field-id-b,
  field-id-c
FROM FORM source-form-xyz
```

---

## 🔍 How to Get Field IDs

### Method 1: Using SQL Query
```sql
SELECT id, label, field_type 
FROM form_fields 
WHERE form_id = 'YOUR_FORM_ID'
```

### Method 2: Browser Console
1. Press F12 to open browser console
2. Go to Forms page and open your form
3. In console, inspect the form field data
4. Copy the UUID for each field

---

## 🚀 Why Use Field IDs?

### ✅ Benefits
- **Rename-proof**: Field IDs never change, even if you rename field labels
- **Programmatic**: Better for automated scripts and integrations
- **Precise**: No ambiguity if multiple fields have similar names
- **Database-level**: Direct mapping to database structure

### ✅ When to Use Field Names
- **Readable**: Easier for humans to read and write queries
- **Quick**: Faster to write ad-hoc queries
- **Flexible**: Don't need to look up UUIDs

---

## 📝 Complete Syntax Reference

```sql
-- Full syntax with all options
INSERT INTO [FORM] <form_id> (<column1>, <column2>, ...)
VALUES (<value1>, <value2>, ...)

INSERT INTO [FORM] <form_id> (<column1>, <column2>, ...)
SELECT <field1>, <field2>, ...
FROM FORM <source_form_id>
WHERE <conditions>

-- Where:
-- [FORM] = Optional keyword
-- <form_id> = UUID of your form
-- <column> = Field name OR field UUID
-- <value> = Literal value, expression, or FIELD() reference
```

---

## 💡 Pro Tips

1. **Mix freely**: You can use field names for some columns and field IDs for others in the same query
2. **Case insensitive**: Field names are case-insensitive (`Name` = `name` = `NAME`)
3. **Field IDs are exact**: Field UUIDs must match exactly (they are case-sensitive UUIDs)
4. **FORM keyword optional everywhere**: Works in both INSERT INTO and SELECT FROM
5. **Cleaner queries**: Omit FORM keyword for shorter, cleaner syntax

---

## ❓ FAQ

**Q: Do I need to use FORM keyword anymore?**
A: No! It's completely optional. `INSERT INTO form_id` works perfectly.

**Q: Can I mix field IDs and field names?**
A: Yes! Use whatever is convenient for each field.

**Q: How do I know if I should use field IDs or names?**
A: Use names for readability, use IDs for stability and automation.

**Q: Will my old queries still work?**
A: Yes! All existing queries with FORM keyword still work perfectly.

**Q: What if I mistype a field name?**
A: The query will fail with an error. Field IDs are more reliable if you're worried about typos.

---

## 🧪 Test These Now!

### Test 1: Simple without FORM
```sql
INSERT INTO YOUR_FORM_ID (TestName, TestValue)
VALUES ('Simple Test', '123')
```

### Test 2: With Field ID
```sql
INSERT INTO YOUR_FORM_ID (YOUR_FIELD_UUID)
VALUES ('Field ID Test')
```

### Test 3: Copy data without FORM
```sql
INSERT INTO TARGET_ID (Name, Email)
SELECT Name, Email FROM FORM SOURCE_ID LIMIT 1
```

Try these and see the improved syntax in action! 🎉

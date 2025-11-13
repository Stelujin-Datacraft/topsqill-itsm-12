# INSERT Query Examples - SQL Query Builder

## What's Been Implemented

The SQL Query Builder now supports **INSERT** queries with the following features:

1. **Flexible Syntax** - Use `INSERT INTO form_id` OR `INSERT INTO FORM form_id` (FORM keyword is optional!)
2. **Field ID or Name** - Use field IDs (UUIDs) OR field labels/names interchangeably
3. **Basic INSERT with VALUES** - Insert single records with explicit values
4. **INSERT with SELECT** - Insert multiple records from query results
5. **FIELD() References** - Pull values from other form submissions
6. **Loop Variables** - Use variables from DECLARE/SET/WHILE loops
7. **Arithmetic Expressions** - Perform calculations in VALUES
8. **Complex Nested Queries** - Combine all features together

---

## Example Queries

### 1. Basic INSERT with VALUES (Field Names)
Insert a single record using field names:

```sql
INSERT INTO your-form-id (Name, Email, Age, Status)
VALUES ('John Doe', 'john@example.com', '30', 'Active')
```

### 1b. Basic INSERT with VALUES (Field IDs)
Same insert but using field IDs instead of names:

```sql
INSERT INTO your-form-id (abc-123-field-id, def-456-field-id, ghi-789-field-id)
VALUES ('John Doe', 'john@example.com', '30')
```

### 2. INSERT with FORM Keyword (Optional)
Both syntaxes work - with or without FORM keyword:

```sql
-- With FORM keyword
INSERT INTO FORM your-form-id (Name, Email)
VALUES ('Jane Smith', 'jane@example.com')

-- Without FORM keyword (cleaner!)
INSERT INTO your-form-id (Name, Email)
VALUES ('Jane Smith', 'jane@example.com')
```

### 3. INSERT with Arithmetic Expressions
Perform calculations while inserting:

```sql
INSERT INTO your-form-id (Product, Quantity, Price, Total)
VALUES ('Laptop', '5', '1000', 5*1000)
```

### 4. INSERT with FIELD() References
Pull values from the latest submission of another form:

```sql
INSERT INTO FORM target-form-id (Customer, OrderDate, Amount)
VALUES (
  FIELD('Customer Name', 'source-form-id'),
  '2025-01-13',
  FIELD('Total Amount', 'source-form-id')
)
```

### 5. INSERT with SELECT (Copy Data)
Insert multiple records by selecting from another form:

```sql
INSERT INTO new-form-id (Name, Email, Phone)
SELECT Name, Email, Phone
FROM FORM source-form-id
WHERE Status = 'Active'
```

### 6. Mixed: Field IDs and Names
You can mix field IDs and field names in the same query:

```sql
INSERT INTO your-form-id (Name, abc-123-uuid, def-456-uuid, Status)
VALUES ('Test User', 'test@email.com', '25', 'Active')
```

### 7. INSERT with SELECT and Calculations
Insert records with calculated values:

```sql
INSERT INTO FORM summary-form-id (Product, TotalSales, AvgPrice)
SELECT 
  Product,
  SUM(Quantity) as TotalSales,
  AVG(Price) as AvgPrice
FROM FORM sales-form-id
GROUP BY Product
```

### 8. INSERT with Loop Variables
Use variables from DECLARE/WHILE loops:

```sql
DECLARE @counter INT = 1;
DECLARE @name VARCHAR(50) = 'Test User';

WHILE @counter <= 3
BEGIN
  INSERT INTO your-form-id (Name, Number, Status)
  VALUES (@name, @counter, 'Active');
  
  SET @counter = @counter + 1;
END
```

### 9. Complex INSERT with Multiple Features
Combine FIELD(), SELECT, and calculations:

```sql
INSERT INTO FORM invoice-form-id (Customer, Product, Quantity, UnitPrice, Total)
SELECT 
  FIELD('Customer Name') as Customer,
  Product,
  Quantity,
  Price as UnitPrice,
  Quantity * Price as Total
FROM FORM orders-form-id
WHERE Status = 'Pending'
  AND Quantity > 0
```

### 10. INSERT with CASE WHEN
Insert records with conditional values:

```sql
INSERT INTO status-form-id (Name, Score, Grade)
SELECT 
  Name,
  Score,
  CASE 
    WHEN Score >= 90 THEN 'A'
    WHEN Score >= 80 THEN 'B'
    WHEN Score >= 70 THEN 'C'
    ELSE 'F'
  END as Grade
FROM FORM results-form-id
```

### 11. INSERT Multiple Records with SELECT
Insert filtered and aggregated data:

```sql
INSERT INTO FORM monthly-report-id (Month, TotalOrders, TotalRevenue, AvgOrderValue)
SELECT 
  'January' as Month,
  COUNT(*) as TotalOrders,
  SUM(Amount) as TotalRevenue,
  AVG(Amount) as AvgOrderValue
FROM FORM orders-form-id
WHERE submission_ref_id LIKE 'ORD01%'
```

### 12. Advanced: INSERT with Nested Aggregations
Complex query with multiple aggregations:

```sql
INSERT INTO analytics-form-id (Category, Products, Sales, AvgPrice, MaxPrice, MinPrice)
SELECT 
  Category,
  COUNT(DISTINCT Product) as Products,
  SUM(Quantity) as Sales,
  AVG(Price) as AvgPrice,
  MAX(Price) as MaxPrice,
  MIN(Price) as MinPrice
FROM FORM sales-form-id
WHERE Status = 'Completed'
GROUP BY Category
HAVING SUM(Quantity) > 10
```

---

## Syntax Rules

### Basic Syntax (Both work!)
```sql
-- Option 1: Without FORM keyword (recommended)
INSERT INTO form_id (column1, column2, ...)
VALUES (value1, value2, ...)

-- Option 2: With FORM keyword (also supported)
INSERT INTO FORM form_id (column1, column2, ...)
VALUES (value1, value2, ...)
```

### Field References (Both work!)
```sql
-- Option 1: Using field names/labels
INSERT INTO form_id (Name, Email, Phone)
VALUES ('John', 'john@email.com', '123-456')

-- Option 2: Using field IDs (UUIDs)
INSERT INTO form_id (abc-123-uuid, def-456-uuid, ghi-789-uuid)
VALUES ('John', 'john@email.com', '123-456')

-- Option 3: Mix both!
INSERT INTO form_id (Name, abc-123-uuid, Phone)
VALUES ('John', 'john@email.com', '123-456')
```

### INSERT with SELECT
```sql
INSERT INTO form_id (column1, column2, ...)
SELECT field1, field2, ...
FROM FORM source_form_id
WHERE conditions
```

### Key Points
- **FORM keyword is optional** - `INSERT INTO form_id` works fine
- **Use field IDs OR names** - Both are supported, even mixed in same query
- Form ID must exist in your database
- Column names can be field labels (case-insensitive) OR field IDs (UUIDs)
- String values should be in quotes: `'text'`
- Numbers don't need quotes: `42` or `3.14`
- FIELD() syntax: `FIELD('field_label', 'form_id')` or `FIELD('field_label')` for same form
- Loop variables use `@` prefix: `@counter`, `@name`
- Arithmetic works with numbers: `5*10`, `@price * 1.1`

---

## Testing Your Queries

1. **Start Simple**: Test basic INSERT with VALUES first
2. **Verify Form IDs**: Make sure your form IDs are correct
3. **Check Field Labels**: Field names must match exactly (case doesn't matter)
4. **Test SELECT First**: If using INSERT with SELECT, run the SELECT alone first
5. **Review Results**: Check the execution summary for success/error counts

---

## Common Issues

❌ **"Form not found"**: Check your form ID is correct
❌ **"Column names required"**: Add column list after form ID
❌ **"Invalid INSERT syntax"**: Review syntax above
✅ **Success**: Shows "Records Inserted" count and any errors

---

Enjoy building complex INSERT queries! 🚀

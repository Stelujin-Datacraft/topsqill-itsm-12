# INSERT Query Examples - SQL Query Builder

## What's Been Implemented

The SQL Query Builder now supports **INSERT** queries with the following features:

1. **Basic INSERT with VALUES** - Insert single records with explicit values
2. **INSERT with SELECT** - Insert multiple records from query results
3. **FIELD() References** - Pull values from other form submissions
4. **Loop Variables** - Use variables from DECLARE/SET/WHILE loops
5. **Arithmetic Expressions** - Perform calculations in VALUES
6. **Complex Nested Queries** - Combine all features together

---

## Example Queries

### 1. Basic INSERT with VALUES
Insert a single record with explicit values:

```sql
INSERT INTO FORM your-form-id (Name, Email, Age, Status)
VALUES ('John Doe', 'john@example.com', '30', 'Active')
```

### 2. INSERT with Arithmetic Expressions
Perform calculations while inserting:

```sql
INSERT INTO FORM your-form-id (Product, Quantity, Price, Total)
VALUES ('Laptop', '5', '1000', 5*1000)
```

### 3. INSERT with FIELD() References
Pull values from the latest submission of another form:

```sql
INSERT INTO FORM target-form-id (Customer, OrderDate, Amount)
VALUES (
  FIELD('Customer Name', 'source-form-id'),
  '2025-01-13',
  FIELD('Total Amount', 'source-form-id')
)
```

### 4. INSERT with SELECT (Copy Data)
Insert multiple records by selecting from another form:

```sql
INSERT INTO FORM new-form-id (Name, Email, Phone)
SELECT Name, Email, Phone
FROM FORM source-form-id
WHERE Status = 'Active'
```

### 5. INSERT with SELECT and Calculations
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

### 6. INSERT with Loop Variables
Use variables from DECLARE/WHILE loops:

```sql
DECLARE @counter INT = 1;
DECLARE @name VARCHAR(50) = 'Test User';

WHILE @counter <= 3
BEGIN
  INSERT INTO FORM your-form-id (Name, Number, Status)
  VALUES (@name, @counter, 'Active');
  
  SET @counter = @counter + 1;
END
```

### 7. Complex INSERT with Multiple Features
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

### 8. INSERT with CASE WHEN
Insert records with conditional values:

```sql
INSERT INTO FORM status-form-id (Name, Score, Grade)
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

### 9. INSERT Multiple Records with SELECT
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

### 10. Advanced: INSERT with Nested Aggregations
Complex query with multiple aggregations:

```sql
INSERT INTO FORM analytics-form-id (Category, Products, Sales, AvgPrice, MaxPrice, MinPrice)
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

### Basic Syntax
```sql
INSERT INTO FORM form_id (column1, column2, ...)
VALUES (value1, value2, ...)
```

### INSERT with SELECT
```sql
INSERT INTO FORM form_id (column1, column2, ...)
SELECT field1, field2, ...
FROM FORM source_form_id
WHERE conditions
```

### Key Points
- Form ID must exist in your database
- Column names must match form field labels (case-insensitive)
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

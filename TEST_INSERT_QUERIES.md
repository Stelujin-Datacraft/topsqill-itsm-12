# Test INSERT Queries - Ready to Run

## 🟢 SIMPLE EXAMPLES (Start Here!)

### Example 1: Basic Single Record Insert
Replace `YOUR_FORM_ID` with your actual form ID:

```sql
INSERT INTO FORM YOUR_FORM_ID (Name, Email, Status)
VALUES ('John Doe', 'john@example.com', 'Active')
```

**What it does**: Inserts one record with 3 fields

---

### Example 2: Insert with Numbers
```sql
INSERT INTO FORM YOUR_FORM_ID (Product, Quantity, Price)
VALUES ('Laptop', '5', '1200')
```

**What it does**: Inserts product data with quantity and price

---

### Example 3: Insert with Date
```sql
INSERT INTO FORM YOUR_FORM_ID (TaskName, DueDate, Priority, Completed)
VALUES ('Complete Report', '2025-01-15', 'High', 'No')
```

**What it does**: Inserts a task with date and priority

---

## 🟡 INTERMEDIATE EXAMPLES

### Example 4: Insert with Calculation
```sql
INSERT INTO FORM YOUR_FORM_ID (Item, Quantity, Price, Total)
VALUES ('Monitor', '3', '350', 3*350)
```

**What it does**: Automatically calculates Total as 1050

---

### Example 5: Copy All Active Records
```sql
INSERT INTO FORM TARGET_FORM_ID (Name, Email, Phone)
SELECT Name, Email, Phone
FROM FORM SOURCE_FORM_ID
WHERE Status = 'Active'
```

**What it does**: Copies all active records from one form to another

---

### Example 6: Insert with Reference to Another Form
```sql
INSERT INTO FORM ORDER_FORM_ID (Customer, OrderDate, Status)
VALUES (
  FIELD('Name', 'CUSTOMER_FORM_ID'),
  '2025-01-13',
  'Pending'
)
```

**What it does**: Pulls customer name from another form's latest submission

---

## 🔴 COMPLEX EXAMPLES

### Example 7: Insert Aggregated Sales Summary
```sql
INSERT INTO FORM SUMMARY_FORM_ID (Product, TotalSales, TotalRevenue, AvgPrice)
SELECT 
  Product,
  SUM(Quantity) as TotalSales,
  SUM(Quantity * Price) as TotalRevenue,
  AVG(Price) as AvgPrice
FROM FORM SALES_FORM_ID
WHERE Status = 'Completed'
GROUP BY Product
```

**What it does**: Creates a summary report with aggregated sales data per product

---

### Example 8: Insert with Conditional Logic
```sql
INSERT INTO FORM GRADES_FORM_ID (Student, Score, Grade, PassFail)
SELECT 
  Student,
  Score,
  CASE 
    WHEN Score >= 90 THEN 'A'
    WHEN Score >= 80 THEN 'B'
    WHEN Score >= 70 THEN 'C'
    WHEN Score >= 60 THEN 'D'
    ELSE 'F'
  END as Grade,
  CASE 
    WHEN Score >= 60 THEN 'Pass'
    ELSE 'Fail'
  END as PassFail
FROM FORM EXAM_RESULTS_FORM_ID
```

**What it does**: Calculates grades and pass/fail status from exam scores

---

### Example 9: Insert Top Performers
```sql
INSERT INTO FORM TOP_SALES_FORM_ID (SalesPerson, TotalSales, Rank)
SELECT 
  SalesPerson,
  SUM(Amount) as TotalSales,
  'Top 5' as Rank
FROM FORM SALES_FORM_ID
WHERE YEAR(SaleDate) = 2025
GROUP BY SalesPerson
ORDER BY SUM(Amount) DESC
LIMIT 5
```

**What it does**: Inserts top 5 sales performers based on total sales

---

### Example 10: Multi-Step Insert with Loop Variables
```sql
DECLARE @i INT = 1;
DECLARE @status VARCHAR(20) = 'Active';

WHILE @i <= 5
BEGIN
  INSERT INTO FORM YOUR_FORM_ID (RecordNumber, Status, CreatedDate)
  VALUES (@i, @status, '2025-01-13');
  
  SET @i = @i + 1;
END
```

**What it does**: Creates 5 records in a loop with sequential numbers

---

### Example 11: Complex Multi-Form Insert
```sql
INSERT INTO FORM INVOICE_FORM_ID (
  CustomerName,
  CustomerEmail,
  Product,
  Quantity,
  UnitPrice,
  TaxRate,
  SubTotal,
  TaxAmount,
  GrandTotal
)
SELECT 
  FIELD('Name', 'CUSTOMER_FORM_ID') as CustomerName,
  FIELD('Email', 'CUSTOMER_FORM_ID') as CustomerEmail,
  Product,
  Quantity,
  Price as UnitPrice,
  0.15 as TaxRate,
  Quantity * Price as SubTotal,
  (Quantity * Price) * 0.15 as TaxAmount,
  (Quantity * Price) * 1.15 as GrandTotal
FROM FORM ORDER_FORM_ID
WHERE Status = 'Approved'
  AND Quantity > 0
```

**What it does**: Creates invoices by combining customer data with approved orders, calculating taxes and totals

---

## 📝 HOW TO USE THESE EXAMPLES

### Step 1: Get Your Form ID
1. Go to your Forms page
2. Open any form
3. Copy the form ID from the URL

### Step 2: Replace Placeholders
- Replace `YOUR_FORM_ID` with your actual form ID
- Replace `SOURCE_FORM_ID`, `TARGET_FORM_ID`, etc. with real IDs
- Make sure field names (Name, Email, etc.) match your form fields

### Step 3: Run the Query
1. Paste the query in the SQL Query Builder
2. Click "Execute" or press Ctrl+Enter
3. Check the results table

### Step 4: Verify Results
- Check "Records Inserted" count
- Look for any errors
- Go to your form to see the new submissions

---

## ⚠️ IMPORTANT NOTES

✅ **Field Names**: Must match your form field labels exactly (case doesn't matter)
✅ **Form IDs**: Get from the URL when viewing a form
✅ **String Values**: Wrap in quotes: `'text here'`
✅ **Numbers**: No quotes needed: `42` or `99.99`
✅ **Test SELECT First**: Before INSERT with SELECT, test the SELECT query alone

---

## 🚀 QUICK TEST

Try this simple one first (just replace YOUR_FORM_ID):

```sql
INSERT INTO FORM YOUR_FORM_ID (TestField, TestValue, TestDate)
VALUES ('Test', '123', '2025-01-13')
```

If it works, you'll see: "Records Inserted: 1" ✅

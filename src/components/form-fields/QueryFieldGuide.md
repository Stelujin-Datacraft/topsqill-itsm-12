# Query Field - User Guide

## Overview
The Query Field allows you to execute SQL queries within your forms and display the results dynamically. This powerful field type can fetch data from your form submissions and display it based on various triggers.

## Configuration Options

### 1. Query Configuration
Define your SQL query using the custom query syntax:

**Example:**
```sql
SELECT "field-id-1", "field-id-2" 
FROM "form-id" 
WHERE "field-id-3" = 'value'
```

**Insert Field/Form IDs:**
- Click the **+** button next to any field to insert its ID into your query
- Click the **+** button next to Form ID to insert the current form ID
- IDs are automatically wrapped in quotation marks

### 2. Execution Triggers

Choose when the query should execute:

#### **On Load** (Default)
- Query executes once when the form loads
- Useful for: Loading initial data, displaying summaries, showing reference information
- Example: Display the total count of existing submissions

#### **On Submit**
- Query executes when the form is submitted
- Useful for: Final calculations, validation checks, generating reports
- Example: Calculate final totals before submission

#### **On Field Change**
- Query executes whenever a specific target field changes
- **Requires:** Select a Target Field from the dropdown
- Useful for: Dynamic lookups, conditional data fetching, dependent fields
- Example: When user selects a product ID, fetch and display product details

**Important:** When using "On Field Change", you must select a Target Field. The query will execute every time that field's value changes.

### 3. Display Options

#### **Display Mode**
- **Results Only:** Show only the query results
- **Code & Results:** Show both the query and its results (useful for debugging)

#### **Max Results**
- Limit the number of rows displayed (default: 100)
- Helps prevent performance issues with large datasets

### 4. Auto-Refresh
Enable periodic automatic query execution:
- Set refresh interval in seconds (minimum: 5 seconds)
- Useful for: Real-time dashboards, live data monitoring
- Example: Refresh submission counts every 30 seconds

## Common Use Cases

### Use Case 1: Dynamic Lookup
**Scenario:** User enters a product ID, display product name and price

**Query:**
```sql
SELECT "product-name-field-id", "product-price-field-id"
FROM "products-form-id"
WHERE "product-id-field-id" = "user-entered-product-id-field"
```

**Settings:**
- Execute On: **On Field Change**
- Target Field: **Product ID** (the field user enters)
- Display Mode: Results Only

### Use Case 2: Form Summary
**Scenario:** Show total submissions count on form load

**Query:**
```sql
SELECT COUNT(*) as total_submissions
FROM "current-form-id"
```

**Settings:**
- Execute On: **On Load**
- Display Mode: Results Only

### Use Case 3: Conditional Display
**Scenario:** Show related records based on user selection

**Query:**
```sql
SELECT "field-1", "field-2", "field-3"
FROM "form-id"
WHERE "category-field" = "selected-category-field-id"
ORDER BY "date-field" DESC
```

**Settings:**
- Execute On: **On Field Change**
- Target Field: **Category Selection Field**
- Max Results: 10

### Use Case 4: Real-time Dashboard
**Scenario:** Display live submission statistics

**Query:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN "status-field" = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN "status-field" = 'approved' THEN 1 END) as approved
FROM "form-id"
```

**Settings:**
- Execute On: **On Load**
- Auto-refresh: **Enabled (30 seconds)**
- Display Mode: Results Only

## Query Syntax Notes

1. **Field References:** Always wrap field IDs in double quotes: `"field-id"`
2. **Form References:** Wrap form IDs in double quotes: `"form-id"`
3. **String Values:** Use single quotes for literal strings: `'value'`
4. **Functions:** Standard SQL functions are supported: `COUNT()`, `SUM()`, `AVG()`, `MAX()`, `MIN()`
5. **Aggregations:** Use `GROUP BY` for aggregated queries

## Troubleshooting

### Query not executing on field change?
- ✅ Check: Have you selected a Target Field?
- ✅ Check: Is the Target Field ID correct?
- ✅ Check: Look at browser console for logs (starts with 🎯)

### No results showing?
- ✅ Check: Is your query syntax correct?
- ✅ Check: Do the field/form IDs exist?
- ✅ Check: Are there any matching records?
- ✅ Check: Browser console for error messages (starts with ❌)

### Query executes too many times?
- ✅ Solution: Use "On Load" instead of "On Field Change" if you don't need dynamic updates
- ✅ Solution: Disable auto-refresh if you don't need real-time data

## Performance Tips

1. **Limit Results:** Always set Max Results to prevent loading too many records
2. **Optimize Queries:** Use WHERE clauses to filter data early
3. **Avoid Auto-refresh:** Only use when necessary for real-time data
4. **Index Fields:** Ensure frequently queried fields are indexed in your database

## Best Practices

1. **Test Queries First:** Use "Code & Results" display mode during development
2. **Use Meaningful Field Labels:** Makes queries easier to understand
3. **Document Complex Queries:** Add comments in your query logic
4. **Handle Empty Results:** Design your form to handle when no data is returned
5. **Security:** Never expose sensitive data in query results

# Query Field - Complete Guide

## Overview

The Query Field is a powerful component that allows you to execute SQL-like queries on form submissions and display the results dynamically within your forms. It's perfect for creating dashboards, reports, lookups, and real-time data summaries.

## How It Works

### Architecture

1. **Query Parser** (`sqlParser.ts`): Parses and executes SQL-like queries against form submission data
2. **Query Field Component** (`QueryField.tsx`): Renders the field and handles query execution
3. **Query Field Config** (`QueryFieldConfig.tsx`): Configuration interface with templates and helpers
4. **Query Templates** (`QueryTemplates.tsx`): Pre-built query examples and syntax guide

### Data Model

- Form submissions are stored in the `form_submissions` table
- Each submission has a `submission_data` JSONB column containing all field values
- Fields are referenced by their UUID
- Forms are referenced by their UUID

## Query Syntax

### Basic Syntax

The Query Field uses a simplified SQL syntax that's translated to work with your form data:

```sql
SELECT "field-id" FROM "form-id"
```

### Supported Operations

#### 1. SELECT - Choose which fields to display

```sql
-- Select all fields
SELECT * FROM "form-id"

-- Select specific fields
SELECT "field-id-1", "field-id-2" FROM "form-id"

-- Select with aliases (column names)
SELECT "field-id" AS "Custom Name" FROM "form-id"
```

#### 2. WHERE - Filter results

```sql
-- Exact match
SELECT * FROM "form-id" WHERE "field-id" = 'value'

-- Text search (case-insensitive)
SELECT * FROM "form-id" WHERE "field-id" LIKE '%search%'

-- Multiple conditions
SELECT * FROM "form-id" 
WHERE "field-id-1" = 'value1' AND "field-id-2" = 'value2'

-- OR conditions
SELECT * FROM "form-id" 
WHERE "field-id-1" = 'value1' OR "field-id-2" = 'value2'
```

#### 3. ORDER BY - Sort results

```sql
-- Ascending order
SELECT * FROM "form-id" ORDER BY "field-id" ASC

-- Descending order
SELECT * FROM "form-id" ORDER BY "field-id" DESC
```

#### 4. LIMIT - Restrict number of results

```sql
SELECT * FROM "form-id" LIMIT 10
```

#### 5. Aggregations - Calculate values

```sql
-- Count submissions
SELECT COUNT(*) AS total FROM "form-id"

-- Sum numeric values
SELECT SUM("numeric-field-id") AS total FROM "form-id"

-- Average
SELECT AVG("numeric-field-id") AS average FROM "form-id"

-- Min and Max
SELECT MIN("field-id"), MAX("field-id") FROM "form-id"
```

#### 6. GROUP BY - Group and aggregate

```sql
-- Count by category
SELECT "category-field-id", COUNT(*) AS count 
FROM "form-id" 
GROUP BY "category-field-id"

-- Sum by group
SELECT "category-field-id", SUM("amount-field-id") AS total 
FROM "form-id" 
GROUP BY "category-field-id"
```

## Practical Examples

### Example 1: Dynamic Lookup
**Use Case**: Show all submissions from a specific user

```sql
SELECT * FROM "form-id" 
WHERE "user-email-field-id" = 'john@example.com'
```

### Example 2: Real-Time Dashboard
**Use Case**: Count submissions by status

```sql
SELECT "status-field-id", COUNT(*) AS count 
FROM "form-id" 
GROUP BY "status-field-id"
```

### Example 3: Search Functionality
**Use Case**: Search for products containing a keyword

```sql
SELECT "product-name-field-id", "price-field-id" 
FROM "form-id" 
WHERE "product-name-field-id" LIKE '%keyword%'
ORDER BY "product-name-field-id"
```

### Example 4: Summary Calculations
**Use Case**: Calculate total sales and average order value

```sql
SELECT 
  COUNT(*) AS "Total Orders",
  SUM("amount-field-id") AS "Total Sales",
  AVG("amount-field-id") AS "Average Order"
FROM "form-id"
```

### Example 5: Recent Activity
**Use Case**: Show the 5 most recent submissions

```sql
SELECT * FROM "form-id" 
ORDER BY submitted_at DESC 
LIMIT 5
```

## Execution Modes

### 1. On Load
Query executes automatically when the form loads.

**Best for**:
- Dashboards
- Summary data
- Static reports

**Example**: Show total number of submissions
```sql
SELECT COUNT(*) AS total FROM "form-id"
```

### 2. On Field Change
Query executes when a specific field's value changes.

**Best for**:
- Dynamic lookups
- Dependent dropdowns
- Real-time filtering

**Example**: Search products as user types
```sql
SELECT "product-name-field-id", "price-field-id" 
FROM "form-id" 
WHERE "product-name-field-id" LIKE '%{search-input}%'
```

Configuration:
- Set "Execute Query" to "On Field Change"
- Select the field to watch in "Target Field"

### 3. On Submit
Query executes when the form is submitted.

**Best for**:
- Validation
- Final calculations
- Post-submission summaries

### 4. Manual Only
Query only executes when the user clicks the "Execute" button.

**Best for**:
- Expensive queries
- User-initiated reports

## Display Options

### Show Query Code
Toggle whether to display the SQL query to users.

- **ON**: Users see the query (useful for transparency or debugging)
- **OFF**: Only results are shown (cleaner interface)

### Show Results
Toggle whether to display query results.

- **ON**: Results are shown in a table
- **OFF**: Query runs but results are hidden (useful for background calculations)

### Maximum Results
Limit the number of rows displayed (1-1000).

Default: 100 rows

## Auto-Refresh

Set an interval (in seconds) for the query to automatically re-execute.

**Use Cases**:
- Real-time dashboards
- Live data feeds
- Monitoring

**Example**: Refresh every 30 seconds
```
Auto-Refresh Interval: 30
```

**Note**: Set to 0 to disable auto-refresh.

## Best Practices

### 1. Use Meaningful Field IDs
Replace placeholder IDs with actual field IDs from your form:

❌ Bad:
```sql
SELECT "{field_id_1}", "{field_id_2}" FROM "{form_id}"
```

✅ Good:
```sql
SELECT "00516cd7-a32e-4ea0-9c39-2e04dfb9d8d4", "6c9dbb2d-1dd4-4f54-9856-18e1d81c3d90" 
FROM "bac30b0c-3010-46ac-9afc-f85382ed50e1"
```

### 2. Use Aliases for Better Column Names
The Query Field automatically maps field IDs to their labels, but you can also use aliases:

```sql
SELECT 
  "name-field-id" AS "Customer Name",
  "email-field-id" AS "Email Address",
  "order-total-field-id" AS "Total"
FROM "form-id"
```

### 3. Limit Results for Performance
Always use LIMIT for large datasets:

```sql
SELECT * FROM "form-id" LIMIT 50
```

### 4. Use Appropriate Execution Modes
- **On Load**: For dashboards and summaries
- **On Field Change**: For search and filtering
- **Manual**: For expensive queries

### 5. Test Queries Before Deployment
Use the "Execute" button to test your query before setting it to auto-execute.

## Helper Tools

### Query Helper Panel
The configuration interface includes helpers to insert IDs:

1. **Current Form ID**: Click + to insert the current form's ID
2. **Insert Field ID**: Select a field from the dropdown and click + to insert its ID

### Query Templates
The "Templates & Guide" tab provides:
- 10+ pre-built query templates
- Categorized by use case (basic, filtering, aggregations, advanced)
- One-click insertion with automatic form ID replacement
- Syntax reference guide

## Troubleshooting

### Common Issues

#### 1. Column Headers Show Field IDs Instead of Labels

**Problem**: Results show UUID columns instead of field names

**Solution**: This has been fixed! The system now automatically maps field IDs to their labels. If you still see IDs, ensure you're using the latest version.

#### 2. Query Returns No Results

**Possible Causes**:
- No submissions exist for the form
- WHERE clause is too restrictive
- Field ID is incorrect

**Debug Steps**:
1. Try `SELECT * FROM "form-id"` to see if any data exists
2. Check that field IDs are correct (use the helper to insert them)
3. Remove WHERE clauses to see all data first

#### 3. Query Execution Fails

**Possible Causes**:
- Syntax error in query
- Invalid field or form ID
- Unsupported SQL operation

**Debug Steps**:
1. Check the error message displayed
2. Verify IDs are wrapped in double quotes: `"id-here"`
3. Try a simpler query first (e.g., `SELECT * FROM "form-id"`)

#### 4. Field Change Not Triggering

**Possible Causes**:
- Wrong target field selected
- Field hasn't actually changed
- Execution mode not set to "On Field Change"

**Solution**:
1. Verify "Execute Query" is set to "On Field Change"
2. Confirm the correct field is selected in "Target Field"
3. Check console logs for execution messages

## Advanced Techniques

### 1. Combining Multiple Conditions

```sql
SELECT * FROM "form-id" 
WHERE "status-field" = 'approved' 
  AND "amount-field" > 100 
  AND "date-field" LIKE '2024%'
ORDER BY "amount-field" DESC
LIMIT 20
```

### 2. Complex Aggregations

```sql
SELECT 
  "category-field", 
  COUNT(*) AS "Count",
  SUM("amount-field") AS "Total",
  AVG("amount-field") AS "Average",
  MIN("amount-field") AS "Min",
  MAX("amount-field") AS "Max"
FROM "form-id"
GROUP BY "category-field"
ORDER BY SUM("amount-field") DESC
```

### 3. Text Search with Multiple Terms

```sql
SELECT * FROM "form-id" 
WHERE "description-field" LIKE '%keyword1%' 
   OR "description-field" LIKE '%keyword2%'
   OR "title-field" LIKE '%keyword1%'
ORDER BY submitted_at DESC
```

## Integration with Other Fields

### Using Query Results in Forms

The query results are stored in the field's value and can be accessed by other fields or form logic:

```javascript
// Access query results in custom logic
const queryResults = formData['query-field-id'];
if (queryResults?.result) {
  const rows = queryResults.result.rows;
  // Process rows...
}
```

### Chaining Query Fields

You can create multiple query fields that depend on each other:

1. **Query Field 1**: Gets categories
```sql
SELECT DISTINCT "category-field" FROM "form-id"
```

2. **Query Field 2**: Filters by selected category (on field change of field 1)
```sql
SELECT * FROM "form-id" 
WHERE "category-field" = 'selected-value'
```

## Performance Considerations

### Optimization Tips

1. **Use LIMIT**: Always limit results for large datasets
2. **Index Strategic Fields**: Ensure frequently queried fields are indexed in the database
3. **Avoid Wildcards**: Use specific field selections instead of `SELECT *`
4. **Appropriate Execution**: Use manual execution for expensive queries
5. **Reasonable Refresh Intervals**: Don't set auto-refresh too frequently (minimum 10-30 seconds)

### When to Use Query Fields

✅ **Good Use Cases**:
- Dashboards with summary data
- Filtered lists (e.g., products, users)
- Real-time calculations
- Form-based reports
- Dynamic lookups

❌ **Not Ideal For**:
- Very large datasets (>10,000 rows without pagination)
- Complex joins across multiple forms
- Real-time updates every second
- Heavy computational operations

## Summary

The Query Field is a versatile tool for dynamic data display in forms. Key features:

- **SQL-like syntax** for familiar querying
- **Multiple execution modes** for different use cases
- **Auto-refresh** for real-time data
- **Aggregations** for calculations
- **Templates** for quick start
- **Helper tools** for easy configuration

Use the Templates & Guide tab in the configuration panel to get started quickly, and refer to this guide for advanced usage!

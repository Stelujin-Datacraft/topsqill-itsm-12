# Query Field - Understanding Execution Context

## 🎯 Core Concept

**Query Fields display data from EXISTING form submissions stored in the database.**

They do NOT show data from the form you're currently filling out. Think of Query Fields as a window into your submission database, not a mirror of the current form.

---

## 📍 Execution Context: Where Am I?

### Scenario 1: Creating a New Form Submission (Public Form View)
**Location**: `/form/:id` (public form URL)  
**Context**: You're filling out a blank form  
**Query Behavior**: Queries run against existing submissions in the database  
**Expected Result**: Shows data from OTHER submissions, not your current input

**Example**:
```sql
SELECT "name-field", "email-field" 
FROM "form-id" 
WHERE "status" = 'approved'
```
- Shows approved submissions from the database
- Your current form input is NOT in the database yet
- If no submissions exist → "zero rows"

---

### Scenario 2: Viewing/Editing an Existing Submission
**Location**: Submission detail/edit page  
**Context**: You're viewing a previously submitted form  
**Query Behavior**: Still queries the submission database  
**Expected Result**: Shows data from ALL submissions (can include the current one if it matches WHERE conditions)

---

### Scenario 3: Dashboard or Report View
**Location**: Custom dashboard page with embedded forms  
**Context**: Displaying analytics or aggregated data  
**Query Behavior**: Queries submission database  
**Expected Result**: Shows aggregated/filtered submission data

**Example**:
```sql
SELECT COUNT(*) as "Total Submissions", 
       AVG("rating-field") as "Average Rating"
FROM "form-id"
```

---

## ⚡ Execution Triggers Explained

### 1. On Load (Execute When Form/Page Loads)
```
User Opens Page → Component Mounts → Query Executes → Results Display
```

**Use Cases**:
- Dashboard statistics
- Recent submission lists
- Default data displays
- Aggregate counts/averages

**Example**: Show total submission count when dashboard loads
```sql
SELECT COUNT(*) as "Total" FROM "form-id"
```

---

### 2. On Field Change (Execute When Specific Field Value Changes)
```
User Types in Field A → Field A Value Changes → Query Executes → Results Update
```

**Configuration**: Requires specifying a "Target Field ID"

**Use Cases**:
- Dynamic lookups (search by name/email)
- Filtered results based on user selection
- Cascading dropdowns
- Real-time search

**Example**: Search submissions by name as user types
```sql
SELECT "name", "email", "phone" 
FROM "form-id" 
WHERE "name" LIKE '%{search-field}%'
```

**⚠️ Important**: The field value being changed is from your CURRENT form input, but the query searches PAST submissions.

---

### 3. On Submit (Execute After Form Submission)
```
User Submits Form → Form Saved to Database → Query Executes → Results Stored
```

**Use Cases**:
- Post-submission analytics
- Confirmation with related data
- Trigger calculations after save

**⚠️ Limitation**: Results are stored with the submission but may not be immediately visible in the form view. User typically needs to navigate to submission detail to see results.

---

### 4. Manual Only (Execute When User Clicks "Execute" Button)
```
User Clicks Execute Button → Query Runs → Results Display
```

**Use Cases**:
- Expensive/slow queries
- User-controlled refreshes
- Testing queries
- On-demand reports

---

## 🚫 Common Misconceptions

### ❌ WRONG: "Query Field will show me what I just typed"
**Reality**: Query Field queries the DATABASE, not your current form input

### ❌ WRONG: "On field change will display my typed value"
**Reality**: It queries OTHER submissions when you type, not your current form

### ❌ WRONG: "I can use Query Field to validate or process my input"
**Reality**: Use Field Rules or custom validation for that

---

## ✅ What Query Fields ARE Good For

### 1. **Live Dashboards**
```sql
SELECT COUNT(*) as "Pending", 
       COUNT(CASE WHEN "status" = 'approved' THEN 1 END) as "Approved"
FROM "form-id"
```

### 2. **Dynamic Search/Lookup**
User types in search field → Shows matching submissions
```sql
SELECT "product-name", "price", "stock" 
FROM "inventory-form" 
WHERE "product-name" LIKE '%{search}%'
```

### 3. **Aggregate Analytics**
```sql
SELECT "category", COUNT(*) as "count", AVG("rating") as "avg_rating"
FROM "reviews-form"
GROUP BY "category"
ORDER BY "count" DESC
```

### 4. **Recent Activity Feed**
```sql
SELECT "user-name", "action", "timestamp"
FROM "activity-form"
ORDER BY "timestamp" DESC
LIMIT 10
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER FILLS OUT FORM                      │
│  [Name Field: "John"] [Email Field: "john@example.com"]    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (NOT YET IN DATABASE)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     QUERY FIELD EXECUTES                     │
│     SELECT "name", "email" FROM "form-id"                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Queries Database
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  FORM_SUBMISSIONS TABLE                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Submission 1: {name: "Alice", email: "a@test.com"}  │   │
│  │ Submission 2: {name: "Bob", email: "b@test.com"}    │   │
│  │ Submission 3: {name: "Charlie", email: "c@test.com"}│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ❌ Current Form Data (John's input) NOT HERE YET           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Returns Results
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  QUERY RESULTS DISPLAYED                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Name     │ Email                                    │   │
│  │──────────────────────────────────────────────────────│   │
│  │  Alice    │ a@test.com                               │   │
│  │  Bob      │ b@test.com                               │   │
│  │  Charlie  │ c@test.com                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

                    John's input is NOT shown here!
```

---

## 🎓 Recommended Use Cases

| Scenario | Trigger | Example |
|----------|---------|---------|
| Show submission stats on dashboard | On Load | `SELECT COUNT(*) FROM "form-id"` |
| Search existing submissions | On Field Change | `SELECT * FROM "form-id" WHERE "name" LIKE '%{search}%'` |
| Display recent activity | On Load + Auto-refresh | `SELECT * FROM "form-id" ORDER BY "created" DESC LIMIT 5` |
| User-controlled reports | Manual Only | `SELECT "category", COUNT(*) FROM "form-id" GROUP BY "category"` |

---

## 🛠️ Troubleshooting

### "Why am I seeing zero rows?"
- ✅ **Expected** if no submissions exist in database
- ✅ **Expected** if WHERE clause filters out all rows
- ✅ **Expected** when creating NEW form (current input not in database)

### "Why don't I see my typed value?"
- Your input isn't saved to database yet
- Query Fields show DATABASE content, not form state

### "Results disappeared when I closed/refreshed"
- Query results are temporary unless "On Submit" stores them
- Use "On Load" to re-fetch on page load

---

## 📖 Summary

**Query Fields = Database Viewer, NOT Form Mirror**

- ✅ Shows data from existing submissions
- ✅ Great for dashboards, search, analytics
- ❌ Does NOT show current form input
- ❌ Not for real-time input validation

For showing current form values, use regular fields or Field Rules.
For querying submission history, use Query Fields.

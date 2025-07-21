# Database Setup for Saved Queries

The saved queries functionality now uses a proper database table instead of localStorage.

## Database Table Schema

A new `saved_queries` table has been created with the following structure:

```sql
CREATE TABLE saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Row Level Security (RLS)

RLS policies have been implemented to ensure users can only access their own saved queries:

- Users can view their own saved queries
- Users can insert their own saved queries  
- Users can update their own saved queries
- Users can delete their own saved queries

## Migration File

The migration file `supabase/migrations/20250121_create_saved_queries.sql` contains all the necessary SQL commands to set up the table, policies, and triggers.

## Note about TypeScript Types

Since the Supabase types file is read-only, the code uses type assertions (`supabase as any`) to bypass TypeScript errors until the types are regenerated. This is a temporary workaround and functionality works correctly.
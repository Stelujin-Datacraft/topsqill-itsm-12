import { supabase } from '@/integrations/supabase/client';

/**
 * Supported query variables that can be used in SQL queries
 */
export const QUERY_VARIABLES = {
  '@current_user': 'Current user ID',
  '@current_user_email': 'Current user email',
  '@today': 'Today\'s date (YYYY-MM-DD)',
  '@now': 'Current timestamp',
  '@form_id': 'Current form ID',
  '@submission_id': 'Current submission ID',
  '@yesterday': 'Yesterday\'s date',
  '@this_week_start': 'Start of current week',
  '@this_month_start': 'Start of current month',
  '@this_year_start': 'Start of current year',
} as const;

/**
 * Replace query variables with actual values
 */
export async function replaceQueryVariables(
  query: string,
  context: {
    formId?: string;
    submissionId?: string;
  } = {}
): Promise<string> {
  let processedQuery = query;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  // Date helpers
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisYearStart = new Date(today.getFullYear(), 0, 1);

  // Replace variables
  const replacements: Record<string, string> = {
    '@current_user': user?.id || 'NULL',
    '@current_user_email': user?.email ? `'${user.email}'` : 'NULL',
    '@today': `'${today.toISOString().split('T')[0]}'`,
    '@now': `'${today.toISOString()}'`,
    '@form_id': context.formId ? `'${context.formId}'` : 'NULL',
    '@submission_id': context.submissionId ? `'${context.submissionId}'` : 'NULL',
    '@yesterday': `'${yesterday.toISOString().split('T')[0]}'`,
    '@this_week_start': `'${thisWeekStart.toISOString().split('T')[0]}'`,
    '@this_month_start': `'${thisMonthStart.toISOString().split('T')[0]}'`,
    '@this_year_start': `'${thisYearStart.toISOString().split('T')[0]}'`,
  };

  for (const [variable, value] of Object.entries(replacements)) {
    processedQuery = processedQuery.replace(new RegExp(variable, 'g'), value);
  }

  return processedQuery;
}

/**
 * Extract variables used in a query
 */
export function extractQueryVariables(query: string): string[] {
  const variables = Object.keys(QUERY_VARIABLES);
  return variables.filter(v => query.includes(v));
}

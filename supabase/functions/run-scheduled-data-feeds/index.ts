import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple cron expression parser for common patterns
function shouldRunNow(schedule: string, lastRunAt: string | null): boolean {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentDay = now.getUTCDay(); // 0 = Sunday
  const currentDate = now.getUTCDate();
  
  // Parse cron expression: minute hour day-of-month month day-of-week
  const parts = schedule.split(' ');
  if (parts.length !== 5) return false;
  
  const [cronMinute, cronHour, cronDayOfMonth, cronMonth, cronDayOfWeek] = parts;
  
  // Check if we already ran within the last interval
  if (lastRunAt) {
    const lastRun = new Date(lastRunAt);
    const timeSinceLastRun = now.getTime() - lastRun.getTime();
    
    // For hourly schedules (minute * * * *), don't run if ran within last 55 mins
    if (cronMinute !== '*' && cronHour === '*') {
      if (timeSinceLastRun < 55 * 60 * 1000) return false;
    }
    
    // For daily schedules (minute hour * * *), don't run if ran within last 23 hours
    if (cronMinute !== '*' && cronHour !== '*' && cronDayOfMonth === '*') {
      if (timeSinceLastRun < 23 * 60 * 60 * 1000) return false;
    }
  }
  
  // Check minute
  if (cronMinute !== '*') {
    const targetMinutes = cronMinute.split(',').map(m => parseInt(m.trim()));
    // Allow 2-minute window for cron execution timing
    if (!targetMinutes.some(m => Math.abs(currentMinute - m) <= 2)) return false;
  }
  
  // Check hour
  if (cronHour !== '*') {
    const targetHours = cronHour.split(',').map(h => parseInt(h.trim()));
    if (!targetHours.includes(currentHour)) return false;
  }
  
  // Check day of month
  if (cronDayOfMonth !== '*') {
    const targetDays = cronDayOfMonth.split(',').map(d => parseInt(d.trim()));
    if (!targetDays.includes(currentDate)) return false;
  }
  
  // Check day of week
  if (cronDayOfWeek !== '*') {
    const targetDaysOfWeek = cronDayOfWeek.split(',').map(d => parseInt(d.trim()));
    if (!targetDaysOfWeek.includes(currentDay)) return false;
  }
  
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('⏰ Checking for scheduled data feeds to run...');

    // Fetch all active data feeds with schedules
    const { data: feeds, error: feedsError } = await supabase
      .from('data_feeds')
      .select('id, name, schedule, last_run_at')
      .eq('is_active', true)
      .not('schedule', 'is', null);

    if (feedsError) {
      console.error('❌ Error fetching feeds:', feedsError);
      return new Response(
        JSON.stringify({ error: feedsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${feeds?.length || 0} active scheduled feeds`);

    const results: { feedId: string; feedName: string; executed: boolean; error?: string }[] = [];

    for (const feed of feeds || []) {
      if (!feed.schedule) continue;

      const shouldRun = shouldRunNow(feed.schedule, feed.last_run_at);
      console.log(`📋 Feed "${feed.name}" (${feed.id}): schedule=${feed.schedule}, shouldRun=${shouldRun}`);

      if (shouldRun) {
        try {
          // Call the execute-data-feed function
          const response = await fetch(`${supabaseUrl}/functions/v1/execute-data-feed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ feedId: feed.id, triggeredBy: 'schedule' })
          });

          const result = await response.json();
          
          if (result.success) {
            console.log(`✅ Feed "${feed.name}" executed successfully`);
            results.push({ feedId: feed.id, feedName: feed.name, executed: true });
          } else {
            console.error(`❌ Feed "${feed.name}" execution failed:`, result.error);
            results.push({ feedId: feed.id, feedName: feed.name, executed: true, error: result.error });
          }
        } catch (execError) {
          console.error(`❌ Error executing feed "${feed.name}":`, execError);
          results.push({ feedId: feed.id, feedName: feed.name, executed: false, error: String(execError) });
        }
      } else {
        results.push({ feedId: feed.id, feedName: feed.name, executed: false });
      }
    }

    const executedCount = results.filter(r => r.executed).length;
    console.log(`✅ Scheduler complete. Executed ${executedCount} of ${feeds?.length || 0} feeds`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalFeeds: feeds?.length || 0,
        executedFeeds: executedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Scheduler error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

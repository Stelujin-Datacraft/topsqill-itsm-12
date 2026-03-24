 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
 
     const supabase = createClient(supabaseUrl, supabaseKey);
 
     // Get active SLA instances with their templates
     const { data: slaInstances, error: slaError } = await supabase
       .from('sla_instances')
       .select(`
         *,
         template:sla_templates(*),
         submission:form_submissions(
           id,
           submission_data,
           submitted_at,
           form:forms(id, name)
         )
       `)
      .in('status', ['on_track', 'warning'])
      .order('breach_at', { ascending: true });
 
     if (slaError) {
       console.error('Error fetching SLA instances:', slaError);
       throw slaError;
     }
 
     // Get historical data for prediction
     const { data: historicalBreaches } = await supabase
       .from('sla_instances')
       .select('template_id, status, started_at, completed_at')
       .eq('status', 'breached')
       .limit(500);
 
     // Calculate breach rates per template
     const templateBreachRates: Record<string, { total: number; breached: number; avgResolutionHours: number }> = {};
     
     const { data: allHistorical } = await supabase
       .from('sla_instances')
       .select('template_id, status, started_at, completed_at')
       .not('completed_at', 'is', null)
       .limit(1000);
 
     allHistorical?.forEach(instance => {
       if (!templateBreachRates[instance.template_id]) {
         templateBreachRates[instance.template_id] = { total: 0, breached: 0, avgResolutionHours: 0 };
       }
       templateBreachRates[instance.template_id].total++;
       if (instance.status === 'breached') {
         templateBreachRates[instance.template_id].breached++;
       }
       if (instance.completed_at && instance.started_at) {
         const hours = (new Date(instance.completed_at).getTime() - new Date(instance.started_at).getTime()) / (1000 * 60 * 60);
         templateBreachRates[instance.template_id].avgResolutionHours = 
           (templateBreachRates[instance.template_id].avgResolutionHours * (templateBreachRates[instance.template_id].total - 1) + hours) / 
           templateBreachRates[instance.template_id].total;
       }
     });
 
     // Predict breach risk for each active instance
     const predictions = slaInstances?.map(instance => {
       const now = new Date();
        const dueAt = new Date(instance.breach_at);
       const startedAt = new Date(instance.started_at);
       
       const totalDuration = dueAt.getTime() - startedAt.getTime();
       const elapsed = now.getTime() - startedAt.getTime();
       const remaining = dueAt.getTime() - now.getTime();
       const percentElapsed = (elapsed / totalDuration) * 100;
       const hoursRemaining = remaining / (1000 * 60 * 60);
       
       // Get template-specific breach rate
       const templateStats = templateBreachRates[instance.template_id] || { total: 0, breached: 0, avgResolutionHours: 0 };
       const historicalBreachRate = templateStats.total > 0 ? (templateStats.breached / templateStats.total) : 0.3;
       const avgResolution = templateStats.avgResolutionHours || (totalDuration / (1000 * 60 * 60)) * 0.7;
       
       // Calculate risk score (0-100)
       let riskScore = 0;
       
       // Factor 1: Time pressure (40% weight)
       if (hoursRemaining <= 0) {
         riskScore += 40;
       } else if (hoursRemaining <= 1) {
         riskScore += 35;
       } else if (hoursRemaining <= 2) {
         riskScore += 28;
       } else if (hoursRemaining <= 4) {
         riskScore += 20;
       } else if (percentElapsed > 75) {
         riskScore += 15;
       } else if (percentElapsed > 50) {
         riskScore += 8;
       }
       
       // Factor 2: Historical breach rate (30% weight)
       riskScore += historicalBreachRate * 30;
       
       // Factor 3: Average resolution vs remaining time (20% weight)
       if (avgResolution > hoursRemaining) {
         const overage = (avgResolution - hoursRemaining) / avgResolution;
         riskScore += Math.min(overage * 20, 20);
       }
       
       // Factor 4: Already in warning status (10% weight)
       if (instance.status === 'warning') {
         riskScore += 10;
       }
       
       // Determine risk level
       let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
       if (riskScore >= 70) riskLevel = 'critical';
       else if (riskScore >= 50) riskLevel = 'high';
       else if (riskScore >= 30) riskLevel = 'medium';
       
       // Generate recommendation
       let recommendation = '';
       if (riskLevel === 'critical') {
         recommendation = 'Immediate attention required. Consider escalating or reassigning to available resources.';
       } else if (riskLevel === 'high') {
         recommendation = 'Prioritize this ticket. Review current assignee workload and consider additional support.';
       } else if (riskLevel === 'medium') {
         recommendation = 'Monitor closely. Ensure assignee is aware of upcoming deadline.';
       } else {
         recommendation = 'On track. Continue with normal workflow.';
       }
       
       return {
         id: instance.id,
         submission_id: instance.submission_id,
         form_name: instance.submission?.form?.name || 'Unknown Form',
         submission_ref: instance.submission?.submission_data?.reference_id || instance.submission_id?.slice(0, 8),
         template_name: instance.template?.name || 'Unknown Template',
         status: instance.status,
          due_at: instance.breach_at,
         hours_remaining: Math.max(0, hoursRemaining),
         percent_elapsed: Math.min(100, percentElapsed),
         risk_score: Math.round(riskScore),
         risk_level: riskLevel,
         historical_breach_rate: Math.round(historicalBreachRate * 100),
         avg_resolution_hours: Math.round(avgResolution * 10) / 10,
         recommendation,
         current_stage: instance.current_stage
       };
     }) || [];
 
     // Sort by risk score descending
     predictions.sort((a, b) => b.risk_score - a.risk_score);
 
     // Use AI for additional insights if we have high-risk items
     let aiInsights = null;
     if (LOVABLE_API_KEY && predictions.filter(p => p.risk_level === 'critical' || p.risk_level === 'high').length > 0) {
       try {
         const highRiskItems = predictions.filter(p => p.risk_level === 'critical' || p.risk_level === 'high').slice(0, 5);
         
         const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${LOVABLE_API_KEY}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             model: 'google/gemini-2.0-flash',
             messages: [
               {
                 role: 'system',
                 content: 'You are an SLA management expert. Analyze the high-risk SLA instances and provide actionable insights in 2-3 bullet points. Be concise and specific.'
               },
               {
                 role: 'user',
                 content: `Analyze these high-risk SLA instances and provide insights:\n${JSON.stringify(highRiskItems, null, 2)}`
               }
             ],
             temperature: 0.3,
             max_tokens: 300,
           }),
         });
 
         if (aiResponse.ok) {
           const aiData = await aiResponse.json();
           aiInsights = aiData.choices[0]?.message?.content;
         }
       } catch (aiError) {
         console.error('AI insights error:', aiError);
       }
     }
 
     // Summary statistics
     const summary = {
       total_active: predictions.length,
       critical: predictions.filter(p => p.risk_level === 'critical').length,
       high: predictions.filter(p => p.risk_level === 'high').length,
       medium: predictions.filter(p => p.risk_level === 'medium').length,
       low: predictions.filter(p => p.risk_level === 'low').length,
       average_risk_score: predictions.length > 0 
         ? Math.round(predictions.reduce((sum, p) => sum + p.risk_score, 0) / predictions.length)
         : 0
     };
 
     return new Response(JSON.stringify({
       success: true,
       predictions,
       summary,
       ai_insights: aiInsights
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('Prediction error:', error);
     return new Response(JSON.stringify({
       success: false,
       error: error instanceof Error ? error.message : 'Unknown error'
     }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });
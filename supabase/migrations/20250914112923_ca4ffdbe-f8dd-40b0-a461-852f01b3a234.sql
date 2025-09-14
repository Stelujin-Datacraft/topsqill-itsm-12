-- Enhanced get_chart_data function to support multiple metrics and complex aggregations
CREATE OR REPLACE FUNCTION public.get_chart_data(
  p_form_id uuid,
  p_dimensions text[] DEFAULT '{}',
  p_metrics text[] DEFAULT '{}',
  p_aggregation text DEFAULT 'count',
  p_filters jsonb DEFAULT '[]',
  p_drilldown_path text[] DEFAULT '{}',
  p_drilldown_values text[] DEFAULT '{}',
  p_metric_aggregations jsonb DEFAULT '[]',
  p_group_by_field text DEFAULT NULL
) 
RETURNS TABLE(name text, value numeric, additional_data jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  filter_item jsonb;
  dimension_field text;
  metric_field text;
  where_conditions text[] := '{}';
  group_by_fields text[] := '{}';
  select_fields text[] := '{}';
  sql_query text;
  metric_agg jsonb;
  i integer;
BEGIN
  -- Build base query conditions
  
  -- Add form filter
  where_conditions := array_append(where_conditions, 'form_id = ' || quote_literal(p_form_id));
  
  -- Process regular filters
  FOR filter_item IN SELECT jsonb_array_elements(p_filters)
  LOOP
    CASE filter_item->>'operator'
      WHEN 'equals' THEN
        where_conditions := array_append(where_conditions, 
          'submission_data->>''' || (filter_item->>'field') || ''' = ' || quote_literal(filter_item->>'value'));
      WHEN 'contains' THEN
        where_conditions := array_append(where_conditions, 
          'submission_data->>''' || (filter_item->>'field') || ''' ILIKE ' || quote_literal('%' || (filter_item->>'value') || '%'));
      WHEN 'greater_than' THEN
        where_conditions := array_append(where_conditions, 
          '(submission_data->>''' || (filter_item->>'field') || ''')::numeric > ' || quote_literal(filter_item->>'value')::numeric);
      WHEN 'less_than' THEN
        where_conditions := array_append(where_conditions, 
          '(submission_data->>''' || (filter_item->>'field') || ''')::numeric < ' || quote_literal(filter_item->>'value')::numeric);
      WHEN 'not_equals' THEN
        where_conditions := array_append(where_conditions, 
          'submission_data->>''' || (filter_item->>'field') || ''' != ' || quote_literal(filter_item->>'value'));
      WHEN 'is_empty' THEN
        where_conditions := array_append(where_conditions, 
          '(submission_data->>''' || (filter_item->>'field') || ''' IS NULL OR submission_data->>''' || (filter_item->>'field') || ''' = '''')');
      WHEN 'is_not_empty' THEN
        where_conditions := array_append(where_conditions, 
          '(submission_data->>''' || (filter_item->>'field') || ''' IS NOT NULL AND submission_data->>''' || (filter_item->>'field') || ''' != '''')');
    END CASE;
  END LOOP;
  
  -- Add drilldown conditions
  FOR i IN 1..array_length(p_drilldown_path, 1)
  LOOP
    IF i <= array_length(p_drilldown_values, 1) AND p_drilldown_values[i] IS NOT NULL THEN
      where_conditions := array_append(where_conditions, 
        'submission_data->>''' || p_drilldown_path[i] || ''' = ' || quote_literal(p_drilldown_values[i]));
    END IF;
  END LOOP;
  
  -- Determine dimension field (next level in drilldown or first dimension)
  IF array_length(p_drilldown_path, 1) > 0 AND array_length(p_drilldown_values, 1) < array_length(p_drilldown_path, 1) THEN
    -- Use next drilldown level
    dimension_field := p_drilldown_path[array_length(p_drilldown_values, 1) + 1];
  ELSIF array_length(p_dimensions, 1) > 0 THEN
    -- Use first dimension
    dimension_field := p_dimensions[1];
  ELSE
    -- Default grouping
    dimension_field := NULL;
  END IF;
  
  -- Build SELECT and GROUP BY based on dimension
  IF dimension_field IS NOT NULL THEN
    select_fields := array_append(select_fields, 
      'COALESCE(submission_data->>''' || dimension_field || ''', ''Unknown'') AS name');
    group_by_fields := array_append(group_by_fields, 
      'submission_data->>''' || dimension_field || '''');
  ELSE
    select_fields := array_append(select_fields, '''Total'' AS name');
  END IF;
  
  -- Build metric selection based on multiple metrics and aggregations
  IF array_length(p_metrics, 1) > 0 AND jsonb_array_length(p_metric_aggregations) > 0 THEN
    -- Use advanced metric aggregations
    FOR metric_agg IN SELECT jsonb_array_elements(p_metric_aggregations)
    LOOP
      metric_field := metric_agg->>'field';
      CASE metric_agg->>'aggregation'
        WHEN 'sum' THEN
          select_fields := array_append(select_fields, 
            'SUM(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
        WHEN 'avg' THEN
          select_fields := array_append(select_fields, 
            'AVG(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
        WHEN 'max' THEN
          select_fields := array_append(select_fields, 
            'MAX(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
        WHEN 'min' THEN
          select_fields := array_append(select_fields, 
            'MIN(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
        WHEN 'median' THEN
          select_fields := array_append(select_fields, 
            'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (submission_data->>''' || metric_field || ''')::numeric) AS value');
        WHEN 'stddev' THEN
          select_fields := array_append(select_fields, 
            'STDDEV(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
        ELSE
          select_fields := array_append(select_fields, 'COUNT(*) AS value');
      END CASE;
      EXIT; -- For now, use only the first metric aggregation for main value
    END LOOP;
  ELSIF array_length(p_metrics, 1) > 0 THEN
    -- Use basic aggregation with single metric
    metric_field := p_metrics[1];
    CASE p_aggregation
      WHEN 'sum' THEN
        select_fields := array_append(select_fields, 
          'SUM(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
      WHEN 'avg' THEN
        select_fields := array_append(select_fields, 
          'AVG(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
      WHEN 'max' THEN
        select_fields := array_append(select_fields, 
          'MAX(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
      WHEN 'min' THEN
        select_fields := array_append(select_fields, 
          'MIN(COALESCE((submission_data->>''' || metric_field || ''')::numeric, 0)) AS value');
      ELSE
        select_fields := array_append(select_fields, 'COUNT(*) AS value');
    END CASE;
  ELSE
    -- Default to count
    select_fields := array_append(select_fields, 'COUNT(*)::numeric AS value');
  END IF;
  
  -- Add additional data for context and multiple metrics support
  select_fields := array_append(select_fields, 
    'jsonb_build_object(
      ''drilldown_level'', ' || COALESCE(array_length(p_drilldown_values, 1), 0)::text || ',
      ''drilldown_path'', ''' || array_to_string(p_drilldown_path, ',') || ''',
      ''drilldown_values'', ''' || array_to_string(p_drilldown_values, ',') || ''',
      ''metric_count'', ' || COALESCE(array_length(p_metrics, 1), 0)::text || ',
      ''dimension_count'', ' || COALESCE(array_length(p_dimensions, 1), 0)::text || '
    ) AS additional_data');
  
  -- Build final query
  sql_query := 'SELECT ' || array_to_string(select_fields, ', ') || 
               ' FROM form_submissions WHERE ' || array_to_string(where_conditions, ' AND ');
  
  IF array_length(group_by_fields, 1) > 0 THEN
    sql_query := sql_query || ' GROUP BY ' || array_to_string(group_by_fields, ', ');
  END IF;
  
  sql_query := sql_query || ' ORDER BY name';
  
  -- Execute and return
  RETURN QUERY EXECUTE sql_query;
END;
$function$;
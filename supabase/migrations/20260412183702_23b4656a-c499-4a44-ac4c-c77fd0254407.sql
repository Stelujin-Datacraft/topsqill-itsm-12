ALTER TABLE public.performance_alerts DROP CONSTRAINT IF EXISTS performance_alerts_alert_type_check;

ALTER TABLE public.performance_alerts
ADD CONSTRAINT performance_alerts_alert_type_check
CHECK (
  alert_type = ANY (
    ARRAY[
      'budget_overrun'::text,
      'schedule_delay'::text,
      'resource_shortage'::text,
      'milestone_risk'::text,
      'task_bottleneck'::text,
      'anomaly'::text,
      'prediction'::text,
      'threshold_breach'::text
    ]
  )
);
import { supabase } from '@/integrations/supabase/client';

export async function seedProjectKPIsForm(projectId: string, organizationId: string, userId: string) {
  // 1. Create the form
  const { data: form, error: formError } = await supabase
    .from('forms')
    .insert({
      name: 'Project KPIs Tracker',
      description: 'Track key project performance indicators including revenue, budget, timeline, quality, and risk metrics.',
      project_id: projectId,
      organization_id: organizationId,
      created_by: userId,
      status: 'published',
      is_public: false,
      layout: { columns: 2 },
      pages: [{ id: 'default', name: 'Page 1', order: 0, fields: [] }],
    })
    .select()
    .single();

  if (formError) throw formError;
  const formId = form.id;

  // 2. Create form fields
  const fields = [
    { label: 'Project Name', field_type: 'text', field_order: 0, required: true, placeholder: 'Enter project name' },
    { label: 'Report Date', field_type: 'date', field_order: 1, required: true, placeholder: '' },
    { label: 'Revenue ($)', field_type: 'number', field_order: 2, required: true, placeholder: 'e.g. 50000' },
    { label: 'Budget Spent ($)', field_type: 'number', field_order: 3, required: true, placeholder: 'e.g. 30000' },
    { label: 'Budget Allocated ($)', field_type: 'number', field_order: 4, required: true, placeholder: 'e.g. 100000' },
    { label: 'Timeline Completion (%)', field_type: 'number', field_order: 5, required: true, placeholder: '0-100' },
    { label: 'Quality Score', field_type: 'number', field_order: 6, required: true, placeholder: '1-10' },
    { label: 'Customer Satisfaction', field_type: 'number', field_order: 7, required: false, placeholder: '1-5' },
    { label: 'Risk Level', field_type: 'select', field_order: 8, required: true, placeholder: '', options: [
      { id: 'opt-low', label: 'Low', value: 'Low' },
      { id: 'opt-medium', label: 'Medium', value: 'Medium' },
      { id: 'opt-high', label: 'High', value: 'High' },
      { id: 'opt-critical', label: 'Critical', value: 'Critical' },
    ]},
    { label: 'Status', field_type: 'select', field_order: 9, required: true, placeholder: '', options: [
      { id: 'opt-on-track', label: 'On Track', value: 'On Track' },
      { id: 'opt-at-risk', label: 'At Risk', value: 'At Risk' },
      { id: 'opt-delayed', label: 'Delayed', value: 'Delayed' },
      { id: 'opt-completed', label: 'Completed', value: 'Completed' },
    ]},
    { label: 'Team Size', field_type: 'number', field_order: 10, required: false, placeholder: 'Number of team members' },
    { label: 'Notes', field_type: 'textarea', field_order: 11, required: false, placeholder: 'Additional comments' },
  ];

  const fieldInserts = fields.map(f => ({
    form_id: formId,
    label: f.label,
    field_type: f.field_type,
    field_order: f.field_order,
    required: f.required,
    placeholder: f.placeholder || null,
    options: f.options || null,
    custom_config: { pageId: 'default' },
  }));

  const { data: insertedFields, error: fieldsError } = await supabase
    .from('form_fields')
    .insert(fieldInserts)
    .select();

  if (fieldsError) throw fieldsError;

  // Build field ID map for submissions
  const fieldMap: Record<string, string> = {};
  insertedFields.forEach(f => {
    fieldMap[f.label] = f.id;
  });

  // 3. Insert dummy submissions (20 entries spanning 20 weeks)
  const projects = ['Alpha Launch', 'Beta Migration', 'Cloud Upgrade', 'Data Pipeline', 'ERP Integration'];
  const riskLevels = ['Low', 'Medium', 'High', 'Critical'];
  const statuses = ['On Track', 'At Risk', 'Delayed', 'Completed'];

  const submissions = [];
  const baseDate = new Date('2025-01-06');

  for (let i = 0; i < 20; i++) {
    const projIdx = i % projects.length;
    const weekOffset = i;
    const reportDate = new Date(baseDate);
    reportDate.setDate(reportDate.getDate() + weekOffset * 7);

    const revenue = Math.round(20000 + Math.random() * 80000);
    const budgetAllocated = Math.round(50000 + Math.random() * 100000);
    const budgetSpent = Math.round(budgetAllocated * (0.2 + Math.random() * 0.7));
    const timeline = Math.min(100, Math.round(10 + i * 4.5 + Math.random() * 5));
    const quality = Math.round(5 + Math.random() * 5);
    const satisfaction = Math.round(2 + Math.random() * 3);
    const teamSize = Math.round(5 + Math.random() * 20);
    const riskIdx = revenue < 40000 ? (Math.random() > 0.5 ? 2 : 3) : (Math.random() > 0.5 ? 0 : 1);
    const statusIdx = timeline >= 90 ? 3 : (riskIdx >= 2 ? 2 : (riskIdx === 1 ? 1 : 0));

    const submissionData: Record<string, any> = {};
    submissionData[fieldMap['Project Name']] = projects[projIdx];
    submissionData[fieldMap['Report Date']] = reportDate.toISOString().split('T')[0];
    submissionData[fieldMap['Revenue ($)']] = revenue;
    submissionData[fieldMap['Budget Spent ($)']] = budgetSpent;
    submissionData[fieldMap['Budget Allocated ($)']] = budgetAllocated;
    submissionData[fieldMap['Timeline Completion (%)']] = timeline;
    submissionData[fieldMap['Quality Score']] = quality;
    submissionData[fieldMap['Customer Satisfaction']] = satisfaction;
    submissionData[fieldMap['Risk Level']] = riskLevels[riskIdx];
    submissionData[fieldMap['Status']] = statuses[statusIdx];
    submissionData[fieldMap['Team Size']] = teamSize;
    submissionData[fieldMap['Notes']] = `Week ${i + 1} report for ${projects[projIdx]}`;

    const submittedAt = new Date(reportDate);
    submittedAt.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));

    submissions.push({
      form_id: formId,
      submission_data: submissionData,
      submitted_by: userId,
      submitted_at: submittedAt.toISOString(),
    });
  }

  const { error: subError } = await supabase
    .from('form_submissions')
    .insert(submissions);

  if (subError) throw subError;

  return { formId, fieldCount: insertedFields.length, submissionCount: submissions.length };
}

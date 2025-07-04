
-- Insert sample form submissions for the Student Information form
INSERT INTO public.form_submissions (form_id, submission_data, submitted_by, submitted_at) VALUES 
-- Sample submission 1
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1), 
 '{
   "name": "John Smith",
   "email": "john.smith@example.com", 
   "age": 20,
   "grade": "A",
   "course": "Computer Science",
   "semester": "Fall 2024",
   "gpa": 3.8,
   "attendance": 95,
   "phone": "+1-555-0101",
   "address": "123 College Ave, University City",
   "enrollment_date": "2024-08-15",
   "status": "Active"
 }', 'admin@example.com', '2024-01-15 10:00:00'),

-- Sample submission 2
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Sarah Johnson", 
   "email": "sarah.johnson@example.com",
   "age": 19,
   "grade": "B+",
   "course": "Mathematics",
   "semester": "Fall 2024", 
   "gpa": 3.5,
   "attendance": 88,
   "phone": "+1-555-0102",
   "address": "456 Campus Dr, University City",
   "enrollment_date": "2024-08-20",
   "status": "Active"
 }', 'admin@example.com', '2024-01-16 11:30:00'),

-- Sample submission 3
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Michael Brown",
   "email": "michael.brown@example.com",
   "age": 21,
   "grade": "A-", 
   "course": "Physics",
   "semester": "Fall 2024",
   "gpa": 3.7,
   "attendance": 92,
   "phone": "+1-555-0103", 
   "address": "789 Student St, University City",
   "enrollment_date": "2024-08-10",
   "status": "Active"
 }', 'admin@example.com', '2024-01-17 14:15:00'),

-- Sample submission 4
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Emily Davis",
   "email": "emily.davis@example.com",
   "age": 20,
   "grade": "B",
   "course": "Biology",
   "semester": "Fall 2024",
   "gpa": 3.2,
   "attendance": 85,
   "phone": "+1-555-0104",
   "address": "321 Dorm Ave, University City", 
   "enrollment_date": "2024-08-25",
   "status": "Active"
 }', 'admin@example.com', '2024-01-18 09:45:00'),

-- Sample submission 5
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "David Wilson",
   "email": "david.wilson@example.com",
   "age": 22,
   "grade": "A",
   "course": "Chemistry",
   "semester": "Fall 2024",
   "gpa": 3.9,
   "attendance": 98,
   "phone": "+1-555-0105",
   "address": "654 Academic Blvd, University City",
   "enrollment_date": "2024-08-05",
   "status": "Active"
 }', 'admin@example.com', '2024-01-19 16:20:00'),

-- Sample submission 6
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Jessica Miller",
   "email": "jessica.miller@example.com", 
   "age": 19,
   "grade": "B-",
   "course": "English Literature",
   "semester": "Fall 2024",
   "gpa": 2.9,
   "attendance": 78,
   "phone": "+1-555-0106",
   "address": "987 Library Lane, University City",
   "enrollment_date": "2024-09-01",
   "status": "Active"
 }', 'admin@example.com', '2024-01-20 13:10:00'),

-- Sample submission 7
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Robert Garcia",
   "email": "robert.garcia@example.com",
   "age": 21,
   "grade": "A-",
   "course": "Computer Science", 
   "semester": "Fall 2024",
   "gpa": 3.6,
   "attendance": 90,
   "phone": "+1-555-0107",
   "address": "147 Tech Way, University City",
   "enrollment_date": "2024-08-12",
   "status": "Active"
 }', 'admin@example.com', '2024-01-21 10:30:00'),

-- Sample submission 8
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Lisa Anderson",
   "email": "lisa.anderson@example.com",
   "age": 20,
   "grade": "B+",
   "course": "Psychology",
   "semester": "Fall 2024", 
   "gpa": 3.4,
   "attendance": 87,
   "phone": "+1-555-0108",
   "address": "258 Mind St, University City",
   "enrollment_date": "2024-08-18",
   "status": "Active"
 }', 'admin@example.com', '2024-01-22 15:45:00'),

-- Sample submission 9
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Christopher Lee",
   "email": "christopher.lee@example.com",
   "age": 19,
   "grade": "A",
   "course": "Mathematics",
   "semester": "Fall 2024",
   "gpa": 3.8,
   "attendance": 94,
   "phone": "+1-555-0109", 
   "address": "369 Numbers Ave, University City",
   "enrollment_date": "2024-08-22",
   "status": "Active"
 }', 'admin@example.com', '2024-01-23 12:00:00'),

-- Sample submission 10
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Amanda Taylor",
   "email": "amanda.taylor@example.com",
   "age": 21,
   "grade": "B",
   "course": "History",
   "semester": "Fall 2024",
   "gpa": 3.1,
   "attendance": 82,
   "phone": "+1-555-0110",
   "address": "741 Past Rd, University City",
   "enrollment_date": "2024-08-30",
   "status": "Active"
 }', 'admin@example.com', '2024-01-24 08:20:00'),

-- Sample submission 11
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Kevin Rodriguez",
   "email": "kevin.rodriguez@example.com",
   "age": 22,
   "grade": "A-",
   "course": "Engineering",
   "semester": "Fall 2024",
   "gpa": 3.7,
   "attendance": 96,
   "phone": "+1-555-0111",
   "address": "852 Build St, University City", 
   "enrollment_date": "2024-08-08",
   "status": "Active"
 }', 'admin@example.com', '2024-01-25 11:15:00'),

-- Sample submission 12
((SELECT id FROM public.forms WHERE name = 'Student Information' LIMIT 1),
 '{
   "name": "Michelle White",
   "email": "michelle.white@example.com",
   "age": 20,
   "grade": "B+",
   "course": "Art",
   "semester": "Fall 2024",
   "gpa": 3.3,
   "attendance": 89,
   "phone": "+1-555-0112",
   "address": "963 Creative Ave, University City",
   "enrollment_date": "2024-08-28",
   "status": "Active"
 }', 'admin@example.com', '2024-01-26 14:30:00');

-- Create a comprehensive example report
INSERT INTO public.reports (name, description, project_id, organization_id, created_by) VALUES 
('Student Analytics Dashboard',
 'Comprehensive dashboard showcasing all chart types and student data analysis',
 (SELECT id FROM public.projects WHERE name = 'Sample Project' LIMIT 1),
 (SELECT organization_id FROM public.projects WHERE name = 'Sample Project' LIMIT 1),
 (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1));

-- Get the report ID for adding components
WITH report_data AS (
  SELECT id as report_id FROM public.reports WHERE name = 'Student Analytics Dashboard'
),
form_data AS (
  SELECT id as form_id FROM public.forms WHERE name = 'Student Information' LIMIT 1
)

-- Insert report components showcasing different chart types
INSERT INTO public.report_components (report_id, type, config, layout) 
SELECT 
  r.report_id,
  'chart' as type,
  jsonb_build_object(
    'formId', f.form_id,
    'chartType', 'bar',
    'title', 'Students by Course',
    'description', 'Distribution of students across different courses',
    'aggregationType', 'count',
    'dimensions', jsonb_build_array('course'),
    'colorTheme', 'vibrant'
  ) as config,
  jsonb_build_object('x', 0, 'y', 0, 'w', 6, 'h', 4) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'chart' as type,
  jsonb_build_object(
    'formId', f.form_id,
    'chartType', 'pie', 
    'title', 'Grade Distribution',
    'description', 'Breakdown of student grades',
    'aggregationType', 'count',
    'dimensions', jsonb_build_array('grade'),
    'colorTheme', 'pastel'
  ) as config,
  jsonb_build_object('x', 6, 'y', 0, 'w', 6, 'h', 4) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'chart' as type, 
  jsonb_build_object(
    'formId', f.form_id,
    'chartType', 'line',
    'title', 'GPA Trend by Age',
    'description', 'Average GPA across different age groups',
    'dimensions', jsonb_build_array('age'),
    'metrics', jsonb_build_array('gpa'),
    'aggregationType', 'avg',
    'colorTheme', 'default'
  ) as config,
  jsonb_build_object('x', 0, 'y', 4, 'w', 6, 'h', 4) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'chart' as type,
  jsonb_build_object(
    'formId', f.form_id,
    'chartType', 'area',
    'title', 'Attendance Patterns',
    'description', 'Student attendance rates by course',
    'dimensions', jsonb_build_array('course'),
    'metrics', jsonb_build_array('attendance'),
    'aggregationType', 'avg',
    'colorTheme', 'monochrome'
  ) as config,
  jsonb_build_object('x', 6, 'y', 4, 'w', 6, 'h', 4) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'metric-card' as type,
  jsonb_build_object(
    'title', 'Total Students',
    'description', 'Total number of enrolled students', 
    'formId', f.form_id,
    'field', 'name',
    'aggregation', 'count',
    'format', 'number',
    'icon', 'users',
    'color', 'blue'
  ) as config,
  jsonb_build_object('x', 0, 'y', 8, 'w', 3, 'h', 2) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'metric-card' as type,
  jsonb_build_object(
    'title', 'Average GPA',
    'description', 'Overall student GPA average',
    'formId', f.form_id,
    'field', 'gpa', 
    'aggregation', 'avg',
    'format', 'number',
    'icon', 'award',
    'color', 'green'
  ) as config,
  jsonb_build_object('x', 3, 'y', 8, 'w', 3, 'h', 2) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'metric-card' as type,
  jsonb_build_object(
    'title', 'Avg Attendance',
    'description', 'Average attendance percentage',
    'formId', f.form_id,
    'field', 'attendance',
    'aggregation', 'avg', 
    'format', 'percentage',
    'icon', 'calendar-check',
    'color', 'purple'
  ) as config,
  jsonb_build_object('x', 6, 'y', 8, 'w', 3, 'h', 2) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'metric-card' as type,
  jsonb_build_object(
    'title', 'Active Students',
    'description', 'Students with Active status',
    'formId', f.form_id,
    'field', 'status',
    'aggregation', 'count',
    'format', 'number',
    'icon', 'check-circle',
    'color', 'orange'
  ) as config,
  jsonb_build_object('x', 9, 'y', 8, 'w', 3, 'h', 2) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'form-submissions' as type,
  jsonb_build_object(
    'title', 'Recent Student Submissions',
    'formId', f.form_id,
    'selectedColumns', jsonb_build_array('name', 'email', 'course', 'grade', 'gpa'),
    'showApprovalStatus', true,
    'pageSize', 10
  ) as config,
  jsonb_build_object('x', 0, 'y', 10, 'w', 12, 'h', 6) as layout
FROM report_data r, form_data f

UNION ALL

SELECT 
  r.report_id,
  'text' as type,
  jsonb_build_object(
    'content', '<h2>Student Analytics Dashboard</h2><p>This comprehensive dashboard showcases various visualization types including bar charts, pie charts, line graphs, area charts, and metric cards. The data represents student information including grades, attendance, and course enrollment statistics.</p>',
    'fontSize', 'medium',
    'textAlign', 'left',
    'padding', 'medium'
  ) as config,
  jsonb_build_object('x', 0, 'y', 16, 'w', 12, 'h', 2) as layout
FROM report_data r, form_data f;

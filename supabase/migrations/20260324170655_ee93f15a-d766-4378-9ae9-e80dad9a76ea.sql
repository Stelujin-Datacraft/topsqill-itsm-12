INSERT INTO roles (name, description, organization_id, created_by)
SELECT 'Engineer', 'Discipline/Task Engineer for performance monitoring', org.id, '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c'
FROM organizations org
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Engineer' AND organization_id = org.id);

INSERT INTO roles (name, description, organization_id, created_by)
SELECT 'Project Manager', 'Project Manager for performance monitoring', org.id, '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c'
FROM organizations org
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Project Manager' AND organization_id = org.id);

INSERT INTO roles (name, description, organization_id, created_by)
SELECT 'Finance', 'Finance/Contract role for performance monitoring', org.id, '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c'
FROM organizations org
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Finance' AND organization_id = org.id);

INSERT INTO roles (name, description, organization_id, created_by)
SELECT 'Senior Management', 'Senior Management for performance monitoring', org.id, '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c'
FROM organizations org
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Senior Management' AND organization_id = org.id);

INSERT INTO roles (name, description, organization_id, created_by)
SELECT 'Risk Compliance', 'Risk & Compliance role for performance monitoring', org.id, '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c'
FROM organizations org
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Risk Compliance' AND organization_id = org.id);
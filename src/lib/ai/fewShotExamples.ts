/**
 * Few-Shot Examples for AI Prompts
 * 
 * These examples help the AI understand the exact format and structure
 * expected for each type of generation.
 */

// ============= FORM GENERATION EXAMPLES =============

export const FORM_EXAMPLES = {
  leaveRequest: {
    name: "Leave Request Form",
    description: "Submit leave requests for approval by your manager",
    fields: [
      {
        type: "text",
        label: "Employee Name",
        required: true,
        placeholder: "Enter your full name"
      },
      {
        type: "email",
        label: "Employee Email",
        required: true,
        placeholder: "your.email@company.com"
      },
      {
        type: "select",
        label: "Leave Type",
        required: true,
        options: [
          { value: "annual", label: "Annual Leave" },
          { value: "sick", label: "Sick Leave" },
          { value: "personal", label: "Personal Leave" },
          { value: "bereavement", label: "Bereavement Leave" },
          { value: "unpaid", label: "Unpaid Leave" }
        ]
      },
      {
        type: "date",
        label: "Start Date",
        required: true
      },
      {
        type: "date",
        label: "End Date",
        required: true
      },
      {
        type: "textarea",
        label: "Reason for Leave",
        required: true,
        placeholder: "Please provide details about your leave request"
      },
      {
        type: "file",
        label: "Supporting Documents",
        required: false,
        tooltip: "Upload any supporting documents (medical certificate, etc.)"
      }
    ],
    suggestedLayout: 2,
    estimatedCompletionTime: "3-5 minutes"
  },
  
  itServiceRequest: {
    name: "IT Service Request",
    description: "Request IT support or new equipment",
    fields: [
      {
        type: "text",
        label: "Requester Name",
        required: true
      },
      {
        type: "text",
        label: "Department",
        required: true
      },
      {
        type: "select",
        label: "Request Category",
        required: true,
        options: [
          { value: "hardware", label: "Hardware Issue" },
          { value: "software", label: "Software Issue" },
          { value: "network", label: "Network Problem" },
          { value: "access", label: "Access Request" },
          { value: "new_equipment", label: "New Equipment" }
        ]
      },
      {
        type: "radio",
        label: "Priority",
        required: true,
        options: [
          { value: "low", label: "Low - Can wait a few days" },
          { value: "medium", label: "Medium - Need within 24 hours" },
          { value: "high", label: "High - Blocking my work" },
          { value: "critical", label: "Critical - System down" }
        ]
      },
      {
        type: "textarea",
        label: "Issue Description",
        required: true,
        placeholder: "Describe the issue or request in detail"
      },
      {
        type: "file",
        label: "Screenshot or Attachment",
        required: false
      }
    ],
    suggestedLayout: 1,
    estimatedCompletionTime: "2-4 minutes"
  }
};

// ============= WORKFLOW EXAMPLES =============

export const WORKFLOW_EXAMPLES = {
  approvalWorkflow: {
    name: "Leave Approval Workflow",
    description: "Automated leave request approval process with manager notification and status updates",
    nodes: [
      {
        type: "start",
        label: "Leave Request Submitted",
        description: "Triggered when employee submits leave request",
        config: {
          triggerType: "form_submission",
          triggerFormName: "Leave Request Form"
        },
        connections: [{ to: "Notify Manager" }]
      },
      {
        type: "action",
        label: "Notify Manager",
        description: "Send email notification to the employee's manager",
        config: {
          actionType: "send_notification",
          notificationConfig: {
            type: "email",
            subject: "New Leave Request: {{Employee Name}} - {{Leave Type}}",
            message: "<h2>Leave Request Pending Approval</h2><p>{{Employee Name}} has submitted a leave request.</p><ul><li>Leave Type: {{Leave Type}}</li><li>Start Date: {{Start Date}}</li><li>End Date: {{End Date}}</li><li>Reason: {{Reason for Leave}}</li></ul><p>Please review and approve/reject this request.</p>",
            recipientConfig: {
              type: "form_owner"
            }
          }
        },
        connections: [{ to: "Check Auto-Approve" }]
      },
      {
        type: "condition",
        label: "Check Auto-Approve",
        description: "Auto-approve if leave is 2 days or less",
        config: {
          enhancedCondition: {
            systemType: "field_level",
            conditions: [
              {
                id: "cond_1",
                systemType: "field_level",
                fieldLevelCondition: {
                  fieldLabel: "Leave Type",
                  operator: "==",
                  value: "annual"
                }
              }
            ]
          }
        },
        connections: [
          { to: "Auto-Approve", condition: "true" },
          { to: "Wait for Approval", condition: "false" }
        ]
      },
      {
        type: "wait",
        label: "Wait for Approval",
        description: "Wait for manual manager approval",
        config: {
          waitType: "duration",
          durationValue: 48,
          durationUnit: "hours"
        },
        connections: [{ to: "Notify Employee" }]
      },
      {
        type: "action",
        label: "Auto-Approve",
        description: "Automatically approve the leave request",
        config: {
          actionType: "approve_form"
        },
        connections: [{ to: "Notify Employee" }]
      },
      {
        type: "action",
        label: "Notify Employee",
        description: "Send decision notification to employee",
        config: {
          actionType: "send_notification",
          notificationConfig: {
            type: "email",
            subject: "Leave Request Update",
            message: "<p>Your leave request has been processed.</p>",
            recipientConfig: {
              type: "submitter"
            }
          }
        },
        connections: [{ to: "Complete" }]
      },
      {
        type: "end",
        label: "Complete",
        description: "Workflow completed",
        config: {
          endStatus: "completed"
        },
        connections: []
      }
    ],
    suggestions: [
      "Consider adding escalation if manager doesn't respond within 48 hours",
      "Add calendar integration to block the dates automatically"
    ],
    estimatedDuration: "1-3 business days"
  }
};

// ============= FIELD RULE EXAMPLES =============

export const FIELD_RULE_EXAMPLES = {
  conditionalVisibility: {
    name: "Show Supporting Documents for Sick Leave",
    targetFieldId: "supporting_docs",
    targetFieldLabel: "Supporting Documents",
    conditions: [
      {
        fieldId: "leave_type",
        fieldLabel: "Leave Type",
        operator: "==",
        value: "sick"
      }
    ],
    logicExpression: "1",
    action: "show",
    explanation: "Display the supporting documents upload field when sick leave is selected, as medical certificates may be required"
  },
  
  conditionalRequired: {
    name: "Require Reason for Emergency Leave",
    targetFieldId: "reason",
    targetFieldLabel: "Reason for Leave",
    conditions: [
      {
        fieldId: "priority",
        fieldLabel: "Priority",
        operator: "==",
        value: "critical"
      }
    ],
    logicExpression: "1",
    action: "require",
    explanation: "Make the reason field required when the request is marked as critical/emergency"
  },
  
  complexCondition: {
    name: "Enable Approval Bypass for Short Leaves",
    targetFieldId: "auto_approve_checkbox",
    targetFieldLabel: "Request Auto-Approval",
    conditions: [
      {
        fieldId: "leave_type",
        fieldLabel: "Leave Type",
        operator: "==",
        value: "annual"
      },
      {
        fieldId: "duration_days",
        fieldLabel: "Duration (Days)",
        operator: "<=",
        value: 2
      }
    ],
    logicExpression: "1 AND 2",
    action: "enable",
    explanation: "Allow employees to request auto-approval for short annual leaves (2 days or less)"
  }
};

// ============= EMAIL TEMPLATE EXAMPLES =============

export const EMAIL_TEMPLATE_EXAMPLES = {
  leaveConfirmation: {
    name: "Leave Request Confirmation",
    description: "Sent to employee when leave request is submitted",
    subject: "Leave Request Submitted - {{Leave Type}} from {{Start Date}} to {{End Date}}",
    htmlContent: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">Leave Request Submitted</h1>
  </div>
  <div style="padding: 20px; background-color: #f9fafb;">
    <p>Dear {{Employee Name}},</p>
    <p>Your leave request has been successfully submitted and is pending approval.</p>
    
    <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #4F46E5; margin-top: 0;">Request Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">{{Leave Type}}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Start Date:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">{{Start Date}}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>End Date:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">{{End Date}}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Reason:</strong></td><td style="padding: 8px 0;">{{Reason for Leave}}</td></tr>
      </table>
    </div>
    
    <p>Your manager has been notified and will review your request shortly. You will receive an email once a decision has been made.</p>
    
    <p>Best regards,<br>HR Department</p>
  </div>
  <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
    <p style="margin: 0;">This is an automated message from the HR Management System.</p>
  </div>
</div>`,
    templateVariables: ["Employee Name", "Leave Type", "Start Date", "End Date", "Reason for Leave"]
  }
};

// ============= CHART SUGGESTION EXAMPLES =============

export const CHART_EXAMPLES = {
  submissionsByStatus: {
    chartType: "pie",
    title: "Requests by Status",
    description: "Distribution of requests across different statuses",
    dimensions: ["status"],
    metrics: [],
    aggregation: "count",
    reasoning: "Pie chart is ideal for showing the proportion of requests in each status category",
    priority: 1
  },
  
  submissionsOverTime: {
    chartType: "line",
    title: "Submissions Over Time",
    description: "Trend of submissions over the past month",
    dimensions: ["submitted_at"],
    metrics: [],
    aggregation: "count",
    sortBy: "submitted_at",
    sortOrder: "asc" as const,
    reasoning: "Line chart effectively shows trends and patterns over time",
    priority: 2
  },
  
  categoryBreakdown: {
    chartType: "bar",
    title: "Requests by Category",
    description: "Number of requests in each category",
    dimensions: ["category"],
    metrics: [],
    aggregation: "count",
    sortBy: "count",
    sortOrder: "desc" as const,
    reasoning: "Bar chart is best for comparing quantities across categories",
    priority: 3
  }
};

/**
 * Get formatted examples for a specific AI action
 */
export function getExamplesForPrompt(action: string): string {
  switch (action) {
    case 'generate-form':
      return `
=== EXAMPLE FORMS ===

Example 1 - Leave Request Form:
${JSON.stringify(FORM_EXAMPLES.leaveRequest, null, 2)}

Example 2 - IT Service Request:
${JSON.stringify(FORM_EXAMPLES.itServiceRequest, null, 2)}

=== END EXAMPLES ===
`;

    case 'suggest-workflow':
      return `
=== EXAMPLE WORKFLOW ===

${JSON.stringify(WORKFLOW_EXAMPLES.approvalWorkflow, null, 2)}

=== END EXAMPLE ===
`;

    case 'suggest-field-rules':
      return `
=== EXAMPLE FIELD RULES ===

Example 1 - Conditional Visibility:
${JSON.stringify(FIELD_RULE_EXAMPLES.conditionalVisibility, null, 2)}

Example 2 - Conditional Required:
${JSON.stringify(FIELD_RULE_EXAMPLES.conditionalRequired, null, 2)}

Example 3 - Complex Condition:
${JSON.stringify(FIELD_RULE_EXAMPLES.complexCondition, null, 2)}

=== END EXAMPLES ===
`;

    case 'generate-email-template':
      return `
=== EXAMPLE EMAIL TEMPLATE ===

${JSON.stringify(EMAIL_TEMPLATE_EXAMPLES.leaveConfirmation, null, 2)}

=== END EXAMPLE ===
`;

    case 'suggest-chart':
      return `
=== EXAMPLE CHART SUGGESTIONS ===

${JSON.stringify([
  CHART_EXAMPLES.submissionsByStatus,
  CHART_EXAMPLES.submissionsOverTime,
  CHART_EXAMPLES.categoryBreakdown
], null, 2)}

=== END EXAMPLES ===
`;

    default:
      return '';
  }
}

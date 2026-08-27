export type FaqItem = { question: string; answer: string };

export const LANDING_FAQS: FaqItem[] = [
  {
    question: 'How does Topsqill differ from other form builders?',
    answer:
      'Topsqill combines enterprise-grade form building with advanced workflow automation, SQL querying capabilities, and built-in analytics. Unlike basic form builders, we offer organization-level user management, role-based access control, and direct database integration for complex business processes.',
  },
  {
    question: 'Can I query my form data with SQL?',
    answer:
      'Yes! Our built-in SQL editor allows you to run complex queries directly on your form submissions. You can join data across forms, create aggregations, generate reports, and export results — all with the power and flexibility of SQL.',
  },
  {
    question: 'What makes your workflow automation special?',
    answer:
      'Our visual workflow designer lets you create complex automation without coding. Connect forms to approvals, notifications, database updates, API calls, and third-party integrations. Set up conditional logic, parallel processing, and error handling with our drag-and-drop interface.',
  },
  {
    question: 'How do you handle enterprise security and compliance?',
    answer:
      'We implement row-level security (RLS), organization isolation, SOC 2 compliance, GDPR compliance, and enterprise SSO. All data is encrypted at rest and in transit, with audit logs and role-based access controls for complete security governance.',
  },
  {
    question: 'What is included in the AI roadmap?',
    answer:
      'Our AI features include intelligent form optimization, predictive analytics, automated form generation based on requirements, RAG-powered data insights, and custom LLM modules. Early access begins for enterprise customers on a rolling basis.',
  },
  {
    question: 'How does pricing work for organizations?',
    answer:
      'We publish named tiers in USD and INR on our Pricing page — from a free Starter plan through Professional and Business seats, plus a Contact-us Enterprise tier. All paid plans include unlimited forms and core workflows; see /pricing for inclusions.',
  },
  {
    question: 'Can I integrate Topsqill with existing systems?',
    answer:
      'Absolutely. We provide REST APIs, webhooks, and direct database connections. Connect with CRM systems, HR platforms, project management tools, and any system with API support. Custom integrations are available for enterprise clients.',
  },
  {
    question: 'What support do you provide?',
    answer:
      'We offer onboarding, documentation, video tutorials, and dedicated support. Enterprise customers get priority support, dedicated success managers, and custom training sessions.',
  },
];

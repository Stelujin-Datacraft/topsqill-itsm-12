import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export default function FAQSection() {
  const faqs = [
    {
      question: "How does Topsqill differ from other form builders?",
      answer: "Topsqill combines enterprise-grade form building with advanced workflow automation, SQL querying capabilities, and built-in analytics. Unlike basic form builders, we offer organization-level user management, role-based access control, and direct database integration for complex business processes."
    },
    {
      question: "Can I query my form data with SQL?",
      answer: "Yes! Our built-in SQL editor allows you to run complex queries directly on your form submissions. You can join data across forms, create aggregations, generate reports, and export results - all with the power and flexibility of SQL."
    },
    {
      question: "What makes your workflow automation special?",
      answer: "Our visual workflow designer lets you create complex automation without coding. Connect forms to approvals, notifications, database updates, API calls, and third-party integrations. Set up conditional logic, parallel processing, and error handling with our drag-and-drop interface."
    },
    {
      question: "How do you handle enterprise security and compliance?",
      answer: "We implement row-level security (RLS), organization isolation, SOC 2 compliance, GDPR compliance, and enterprise SSO. All data is encrypted at rest and in transit, with audit logs and role-based access controls for complete security governance."
    },
    {
      question: "What's included in the AI roadmap?",
      answer: "Our AI features will include intelligent form optimization, predictive analytics, automated form generation based on requirements, RAG-powered data insights, and custom LLM modules. Early access begins Q2 2025 for enterprise customers."
    },
    {
      question: "How does pricing work for organizations?",
      answer: "We offer flexible pricing based on organization size, starting at $49/month for small teams up to $500/month for enterprise. Custom pricing available for large organizations with specific requirements. All plans include unlimited forms and basic workflows."
    },
    {
      question: "Can I integrate Topsqill with existing systems?",
      answer: "Absolutely! We provide REST APIs, webhooks, Zapier integration, and direct database connections. Connect with CRM systems, HR platforms, project management tools, and any system with API support. Custom integrations available for enterprise clients."
    },
    {
      question: "What support do you provide?",
      answer: "We offer comprehensive onboarding, documentation, video tutorials, and dedicated support. Enterprise customers get priority support, dedicated success managers, and custom training sessions. Community support available through our Discord and knowledge base."
    }
  ];

  return (
    <section aria-labelledby="faq-heading" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Frequently Asked Questions</Badge>
          <h2 id="faq-heading" className="text-3xl font-bold mb-4">
            Everything you need to know
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get answers to common questions about features, pricing, and implementation
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border rounded-lg px-6"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="font-medium">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Still have questions? We're here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:support@topsqill.com" 
              className="text-primary hover:underline font-medium"
            >
              Contact Support
            </a>
            <a 
              href="/docs" 
              className="text-primary hover:underline font-medium"
            >
              View Documentation
            </a>
            <a 
              href="/demo" 
              className="text-primary hover:underline font-medium"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
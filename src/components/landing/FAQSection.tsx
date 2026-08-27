import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { LANDING_FAQS } from "@/content/faq";

export default function FAQSection() {
  const faqs = LANDING_FAQS;

  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-20">
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
                key={faq.question}
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
            Still have questions? We&apos;re here to help.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center text-primary hover:underline font-medium"
          >
            Contact Support
          </Link>
          {' · '}
          <Link
            to="/pricing"
            className="inline-flex items-center text-primary hover:underline font-medium"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

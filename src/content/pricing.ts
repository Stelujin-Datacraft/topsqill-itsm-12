export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  priceUsd: number | null;
  priceInr: number | null;
  priceLabelUsd: string;
  priceLabelInr: string;
  period: string;
  features: string[];
  cta: string;
  ctaTo: string;
  popular?: boolean;
  enterprise?: boolean;
};

/** Named tiers with USD + INR list prices (per seat / org month). */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'For small teams getting started with governed forms.',
    priceUsd: 0,
    priceInr: 0,
    priceLabelUsd: '$0',
    priceLabelInr: '₹0',
    period: '/month',
    features: [
      'Up to 5 forms',
      '100 submissions/month',
      'Basic form builder',
      'Email notifications',
      'Community support',
      'Standard templates',
    ],
    cta: 'Get started free',
    ctaTo: '/auth?mode=signup',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing teams that need workflows and SQL.',
    priceUsd: 49,
    priceInr: 3999,
    priceLabelUsd: '$49',
    priceLabelInr: '₹3,999',
    period: '/seat/month',
    features: [
      'Unlimited forms',
      '10,000 submissions/month',
      'Workflow automation',
      'SQL query engine',
      'Priority support',
      'Custom branding',
      'API access',
    ],
    cta: 'Start free trial',
    ctaTo: '/auth?mode=signup',
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For multi-project organizations with advanced controls.',
    priceUsd: 149,
    priceInr: 11999,
    priceLabelUsd: '$149',
    priceLabelInr: '₹11,999',
    period: '/seat/month',
    features: [
      'Everything in Professional',
      '50,000 submissions/month',
      'Advanced roles & access',
      'Data feeds & integrations',
      'Audit logs',
      'SLA-backed support',
    ],
    cta: 'Start free trial',
    ctaTo: '/auth?mode=signup',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom security, SSO, and volume for large rollouts.',
    priceUsd: null,
    priceInr: null,
    priceLabelUsd: 'Contact us',
    priceLabelInr: 'Contact us',
    period: '',
    features: [
      'Everything in Business',
      'Unlimited submissions',
      'SSO / SAML / LDAP',
      'Dedicated success manager',
      'Custom SLA',
      'On-prem or private cloud options',
      'Custom integrations',
    ],
    cta: 'Contact sales',
    ctaTo: '/contact',
    enterprise: true,
  },
];

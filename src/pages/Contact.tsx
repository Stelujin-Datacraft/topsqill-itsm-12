import { FormEvent, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Linkedin, MapPin } from 'lucide-react';
import PublicPageLayout from '@/components/layout/PublicPageLayout';

const EMAIL = 'contact@topsqill.com';
const LINKEDIN = 'https://www.linkedin.com/company/topsqill-pvt-ltd/posts/?feedView=all';

const HEAR_ABOUT_OPTIONS = [
  'Google search',
  'Bing search',
  'ChatGPT / AI assistant',
  'Perplexity',
  'LinkedIn',
  'Colleague / referral',
  'Event / webinar',
  'Other',
];

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [hearAbout, setHearAbout] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`TopSqill demo request — ${company || name || 'Prospect'}`);
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company}`,
        `How did you hear about us?: ${hearAbout || '(not specified)'}`,
        '',
        message || '(no additional message)',
      ].join('\n'),
    );
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <PublicPageLayout
      eyebrow="Get in touch"
      title="Contact us"
      description="Questions about the platform, a demo, or an enterprise rollout? Reach out and we'll get back to you."
      contentClassName="max-w-4xl mx-auto"
    >
      <Card className="mb-6 border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Request a demo</CardTitle>
          <CardDescription>
            Tell us about your team. Includes a free-text field for how you found TopSqill (search, AI, referral, and more).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Work email</Label>
              <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-company">Company</Label>
              <Input id="contact-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-hear">How did you hear about us?</Label>
              <Input
                id="contact-hear"
                list="hear-about-suggestions"
                placeholder="e.g. Google, ChatGPT, LinkedIn, colleague…"
                value={hearAbout}
                onChange={(e) => setHearAbout(e.target.value)}
              />
              <datalist id="hear-about-suggestions">
                {HEAR_ABOUT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-message">What would you like to automate?</Label>
              <Textarea
                id="contact-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit">Open email to send</Button>
              {sent && (
                <p className="text-sm text-muted-foreground">
                  Your mail client should open with the details filled in.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email
            </CardTitle>
            <CardDescription>We usually reply within one business day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <a href={`mailto:${EMAIL}`} className="block text-base font-medium text-primary underline underline-offset-4 break-all">
              {EMAIL}
            </a>
            <Button asChild className="w-full">
              <a href={`mailto:${EMAIL}`}>Send an email</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Linkedin className="h-5 w-5 text-primary" />
              LinkedIn
            </CardTitle>
            <CardDescription>Follow product updates and announcements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">TopSqill Pvt Ltd</p>
            <Button asChild variant="outline" className="w-full">
              <a href={LINKEDIN} target="_blank" rel="noopener noreferrer">Visit our LinkedIn</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Office address
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            B-439, Bhutani Technopark, Sector 127
          </p>
          <p>Noida — 201313, India</p>
        </CardContent>
      </Card>
    </PublicPageLayout>
  );
}

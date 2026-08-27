import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Linkedin, MapPin } from 'lucide-react';
import PublicPageLayout from '@/components/layout/PublicPageLayout';

const EMAIL = 'contact@topsqill.com';
const LINKEDIN = 'https://www.linkedin.com/company/topsqill-pvt-ltd/posts/?feedView=all';

export default function Contact() {
  return (
    <PublicPageLayout
      eyebrow="Get in touch"
      title="Contact us"
      description="Questions about the platform, a demo, or an enterprise rollout? Reach out and we'll get back to you."
      contentClassName="max-w-4xl mx-auto"
    >
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

        <Card className="mt-6 border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Working with us</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Sales and demos: mention your team size and the process you want to automate.</p>
            <p>Support: include your organization name and a short description of the issue.</p>
            <p>Partnerships: tell us about your product and the integration you have in mind.</p>
          </CardContent>
        </Card>
    </PublicPageLayout>
  );
}

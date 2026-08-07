import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Linkedin, ArrowLeft, MapPin } from 'lucide-react';

const EMAIL = 'contact@topsqill.com';
const LINKEDIN = 'https://www.linkedin.com/company/topsqill-pvt-ltd/posts/?feedView=all';

export default function Contact() {
  useEffect(() => {
    document.title = 'Contact TopSqill — Talk to our team';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Get in touch with the TopSqill team by email or LinkedIn for demos, partnerships and enterprise support.');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="text-lg font-semibold">TopSqill</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">Contact us</h1>
        <p className="text-lg text-muted-foreground mb-10">
          Questions about the platform, a demo, or enterprise rollout? Reach out and we'll get back to you.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
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

          <Card>
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Working with us
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Sales and demos: mention your team size and the process you want to automate.</p>
            <p>Support: include your organization name and a short description of the issue.</p>
            <p>Partnerships: tell us about your product and the integration you have in mind.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

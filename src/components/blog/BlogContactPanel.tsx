import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONTACT_EMAIL = 'contact@topsqill.com';

type BlogContactPanelProps = {
  className?: string;
  compact?: boolean;
  /** Unique suffix so multiple panels on a page do not clash on input ids */
  idPrefix?: string;
};

export default function BlogContactPanel({
  className,
  compact = false,
  idPrefix = 'blog-contact',
}: BlogContactPanelProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`TopSqill blog inquiry — ${name || 'Reader'}`);
    const body = encodeURIComponent(
      [`Name: ${name}`, `Email: ${email}`, '', message || '(no message)'].join('\n'),
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-gradient-to-b from-primary/[0.04] to-background p-5 shadow-sm',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
        Contact
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
        Talk to TopSqill
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground/70">
        Questions about forms, workflows, or a demo? Send a short note — we reply quickly.
      </p>

      <form className={cn('mt-5 space-y-3', compact && 'space-y-2.5')} onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-name`} className="text-xs">Name</Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-email`} className="text-xs">Work email</Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-message`} className="text-xs">Message</Label>
          <Textarea
            id={`${idPrefix}-message`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={compact ? 3 : 4}
            placeholder="What are you trying to solve?"
            className="resize-none text-sm"
          />
        </div>
        <Button type="submit" size="sm" className="w-full gap-1.5">
          <Mail className="h-4 w-4" />
          {sent ? 'Opening email…' : 'Send message'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-foreground/55">
        Or visit the{' '}
        <Link to="/contact" className="font-medium text-primary underline underline-offset-4">
          contact page
        </Link>
      </p>
    </div>
  );
}

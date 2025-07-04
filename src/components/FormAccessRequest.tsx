
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form } from '@/types/form';
import { useFormAccess } from '@/hooks/useFormAccess';
import { Lock, Send, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FormAccessRequestProps {
  form: Form;
}

export function FormAccessRequest({ form }: FormAccessRequestProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { requestAccess } = useFormAccess(form.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const success = await requestAccess(message);
    if (success) {
      setIsSubmitted(true);
    }

    setIsSubmitting(false);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <Send className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-600 mb-2">Request Sent!</h2>
            <p className="text-muted-foreground mb-4">
              Your access request has been submitted to the form owner.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              You'll be notified when your request is reviewed.
            </p>
            <div className="space-y-2">
              <Link to="/" className="block">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go to Homepage
                </Button>
              </Link>
              <Link to="/auth" className="block">
                <Button variant="outline" className="w-full">
                  View My Account
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <Lock className="h-16 w-16 text-orange-600 mx-auto mb-4" />
          <CardTitle className="text-2xl text-orange-600">Access Required</CardTitle>
          <p className="text-muted-foreground">
            This form requires permission to access. Request access from the form owner.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Form: {form.name}</h3>
              {form.description && (
                <p className="text-sm text-muted-foreground mb-4">{form.description}</p>
              )}
            </div>

            <div>
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell the form owner why you need access..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>Sending Request...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Request Access
                  </>
                )}
              </Button>
              
              <Link to="/" className="block">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

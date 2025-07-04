
import { Card, CardContent } from '@/components/ui/card';
import { PublicHeader } from '@/components/PublicHeader';

interface FormErrorViewProps {
  error: string;
}

export function FormErrorView({ error }: FormErrorViewProps) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold text-destructive mb-2">Form Not Available</h2>
            <p className="text-muted-foreground">
              {error || 'This form could not be found or is no longer available.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

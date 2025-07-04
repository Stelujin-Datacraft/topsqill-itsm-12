
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Database } from 'lucide-react';
import { PublicHeader } from '@/components/PublicHeader';

interface ImprovedLoadingScreenProps {
  title?: string;
  description?: string;
  showHeader?: boolean;
}

export function ImprovedLoadingScreen({ 
  title = "Loading...", 
  description = "Please wait while we prepare your content",
  showHeader = false 
}: ImprovedLoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {showHeader && <PublicHeader />}
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[80vh]">
        <Card className="max-w-md mx-auto border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 px-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping opacity-20">
                <Database className="h-12 w-12 text-violet-600" />
              </div>
              <div className="relative">
                <Database className="h-12 w-12 text-violet-600" />
                <Loader2 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 animate-spin text-white" />
              </div>
            </div>
            
            <div className="text-center space-y-3">
              <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
              
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

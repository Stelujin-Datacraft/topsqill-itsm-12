import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PolicyRatingsTabProps {
  policyId: string;
  getUserName: (userId: string) => string;
}

export function PolicyRatingsTab({ policyId, getUserName }: PolicyRatingsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const { data: ratings = [] } = useQuery({
    queryKey: ['policy_ratings', policyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_ratings')
        .select('*')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!policyId,
  });

  const myRating = ratings.find((r: any) => r.user_id === user?.id);
  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : '—';

  const submitRating = useMutation({
    mutationFn: async () => {
      if (myRating) {
        const { error } = await supabase
          .from('policy_ratings')
          .update({ rating: selectedRating, feedback: feedback || null, updated_at: new Date().toISOString() } as any)
          .eq('id', myRating.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('policy_ratings')
          .insert([{ policy_id: policyId, user_id: user?.id, rating: selectedRating, feedback: feedback || null } as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_ratings', policyId] });
      toast.success(myRating ? 'Rating updated' : 'Rating submitted');
      setSelectedRating(0);
      setFeedback('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  React.useEffect(() => {
    if (myRating) {
      setSelectedRating(myRating.rating);
      setFeedback(myRating.feedback || '');
    }
  }, [myRating]);

  return (
    <Card>
      <CardContent className="pt-4 space-y-6">
        {/* Summary */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">{avgRating}</div>
            <div className="text-xs text-muted-foreground">{ratings.length} rating{ratings.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} className={`h-5 w-5 ${Number(avgRating) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
            ))}
          </div>
        </div>

        {/* Rate */}
        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">{myRating ? 'Update your rating' : 'Rate this policy'}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setSelectedRating(s)}
                className="p-0.5"
              >
                <Star className={`h-7 w-7 transition-colors ${
                  (hoverRating || selectedRating) >= s
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/30'
                }`} />
              </button>
            ))}
          </div>
          <Textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Optional feedback..."
            rows={2}
          />
          <Button
            size="sm"
            disabled={!selectedRating || submitRating.isPending}
            onClick={() => submitRating.mutate()}
          >
            {submitRating.isPending ? 'Submitting...' : myRating ? 'Update Rating' : 'Submit Rating'}
          </Button>
        </div>

        {/* All ratings */}
        {ratings.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">All Ratings</p>
            {ratings.map((r: any) => (
              <div key={r.id} className="flex items-start justify-between p-3 rounded-md border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{getUserName(r.user_id)}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`h-3.5 w-3.5 ${r.rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                      ))}
                    </div>
                  </div>
                  {r.feedback && <p className="text-xs text-muted-foreground">{r.feedback}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{format(new Date(r.created_at), 'MMM d, yyyy')}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

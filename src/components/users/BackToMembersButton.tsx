import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackToMembersButtonProps {
  className?: string;
}

export function BackToMembersButton({ className }: BackToMembersButtonProps) {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate('/users')}
      className={className}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to Access Control
    </Button>
  );
}

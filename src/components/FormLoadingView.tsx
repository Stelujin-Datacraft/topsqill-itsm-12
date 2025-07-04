
import { ImprovedLoadingScreen } from '@/components/ImprovedLoadingScreen';

export function FormLoadingView() {
  return (
    <ImprovedLoadingScreen 
      title="Loading Form..." 
      description="Preparing your form for submission"
      showHeader={true}
    />
  );
}

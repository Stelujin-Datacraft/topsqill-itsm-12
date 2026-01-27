import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  description,
  actions
}) => {
  const { isImpersonating } = useImpersonation();
  
  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full ${isImpersonating ? 'pt-12' : ''}`}>
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="border-b bg-background/95 backdrop-blur p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  {title && <h1 className="text-2xl font-semibold">{title}</h1>}
                  {description && <p className="text-sm text-muted-foreground">{description}</p>}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          </header>
          <div className="flex-1 p-6 px-[10px] mx-0 py-[10px]">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
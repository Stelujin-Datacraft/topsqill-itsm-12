import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DataFeedList } from '@/components/data-feeds/DataFeedList';
import { DataFeedDialog } from '@/components/data-feeds/DataFeedDialog';
import { DataFeedHistoryDialog } from '@/components/data-feeds/DataFeedHistoryDialog';
import { useDataFeeds } from '@/hooks/useDataFeeds';
import { DataFeed, DataFeedFormData } from '@/types/dataFeed';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRightLeft, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataFeedStatusMonitor } from '@/components/data-feeds/DataFeedStatusMonitor';

export default function DataFeeds() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || '';

  const {
    feeds,
    loading,
    createFeed,
    updateFeed,
    deleteFeed,
    executeFeed,
    toggleFeedActive,
  } = useDataFeeds(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<DataFeed | null>(null);
  const [activeTab, setActiveTab] = useState('feeds');

  const handleCreateClick = () => {
    setSelectedFeed(null);
    setDialogOpen(true);
  };

  const handleEditClick = (feed: DataFeed) => {
    setSelectedFeed(feed);
    setDialogOpen(true);
  };

  const handleViewHistory = (feed: DataFeed) => {
    setSelectedFeed(feed);
    setHistoryOpen(true);
  };

  const handleSave = async (data: DataFeedFormData): Promise<boolean> => {
    if (selectedFeed) {
      return updateFeed(selectedFeed.id, data);
    } else {
      const result = await createFeed(data);
      return !!result;
    }
  };

  return (
    <DashboardLayout 
      title="Data Feeds"
      description="Sync data between forms using scheduled or manual feeds"
      actions={activeTab === 'feeds' ? (
        <Button onClick={handleCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Create Data Feed
        </Button>
      ) : undefined}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="feeds" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-module-feeds" />
            Data Feeds
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-module-feeds" />
            Status Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feeds">
          <DataFeedList
            feeds={feeds}
            loading={loading}
            onEditClick={handleEditClick}
            onViewHistory={handleViewHistory}
            onExecute={executeFeed}
            onToggleActive={toggleFeedActive}
            onDelete={deleteFeed}
            onCreateClick={handleCreateClick}
          />
        </TabsContent>

        <TabsContent value="status">
          <DataFeedStatusMonitor />
        </TabsContent>
      </Tabs>

      <DataFeedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        feed={selectedFeed}
        projectId={projectId}
        onSave={handleSave}
      />

      <DataFeedHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        feed={selectedFeed}
      />
    </DashboardLayout>
  );
}

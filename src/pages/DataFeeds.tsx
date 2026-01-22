import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DataFeedList } from '@/components/data-feeds/DataFeedList';
import { DataFeedDialog } from '@/components/data-feeds/DataFeedDialog';
import { DataFeedHistoryDialog } from '@/components/data-feeds/DataFeedHistoryDialog';
import { useDataFeeds } from '@/hooks/useDataFeeds';
import { DataFeed, DataFeedFormData } from '@/types/dataFeed';
import { useProject } from '@/contexts/ProjectContext';

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
    <DashboardLayout>
      <div className="container mx-auto py-6 px-4">
        <DataFeedList
          feeds={feeds}
          loading={loading}
          onCreateClick={handleCreateClick}
          onEditClick={handleEditClick}
          onViewHistory={handleViewHistory}
          onExecute={executeFeed}
          onToggleActive={toggleFeedActive}
          onDelete={deleteFeed}
        />

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
      </div>
    </DashboardLayout>
  );
}

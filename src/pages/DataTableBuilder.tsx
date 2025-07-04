
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useForm } from '@/contexts/FormContext';
import { useReports } from '@/hooks/useReports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SimpleLoadingSpinner } from '@/components/SimpleLoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimpleFormSelector } from '@/components/reports/SimpleFormSelector';
import { ColumnSelector } from '@/components/reports/ColumnSelector';
import { SimpleTablePreview } from '@/components/reports/SimpleTablePreview';
import { TableFiltersPanel, FilterGroup } from '@/components/reports/TableFiltersPanel';
import { FormJoinConfig } from '@/components/reports/FormJoinConfig';
import { useFormWithFields } from '@/hooks/useFormWithFields';

const DataTableBuilder = () => {
  const navigate = useNavigate();
  const { forms } = useForm();
  const { createReport, saveReportComponent } = useReports();
  const { toast } = useToast();
  
  // Basic table configuration
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  
  // Table features
  const [showMetadata, setShowMetadata] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableSorting, setEnableSorting] = useState(true);
  const [enableFiltering, setEnableFiltering] = useState(true);
  const [enableExport, setEnableExport] = useState(true);
  
  // Filters
  const [filters, setFilters] = useState<FilterGroup[]>([]);
  
  // Join configuration
  const [joinEnabled, setJoinEnabled] = useState(false);
  const [joinConfig, setJoinConfig] = useState({
    secondaryFormId: '',
    joinType: 'inner',
    primaryFieldId: '',
    secondaryFieldId: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Use the new hook to load form with fields
  const { form: selectedFormWithFields, loading: formLoading } = useFormWithFields(selectedFormId);

  // Get forms with fields for join configuration
  const availableFormsWithFields = forms.map(form => ({
    id: form.id,
    name: form.name,
    fields: form.fields || []
  }));

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
    // Clear selected columns when form changes
    setSelectedColumns([]);
    // Reset join config when primary form changes
    setJoinConfig({
      secondaryFormId: '',
      joinType: 'inner',
      primaryFieldId: '',
      secondaryFieldId: ''
    });
  };

  const handleSave = async () => {
    if (!selectedFormId || !title) {
      toast({
        title: "Validation Error",
        description: "Please select a primary form and provide a report title",
        variant: "destructive",
      });
      return;
    }

    if (selectedColumns.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one column to display",
        variant: "destructive",
      });
      return;
    }

    // Validate join configuration if enabled
    if (joinEnabled) {
      if (!joinConfig.secondaryFormId || !joinConfig.primaryFieldId || !joinConfig.secondaryFieldId) {
        toast({
          title: "Validation Error",
          description: "Please complete the join configuration or disable it",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setLoading(true);
      
      const reportConfig = {
        title: title,
        type: 'table', // Changed from 'dynamic-table' to 'table'
        formId: selectedFormId,
        selectedColumns: selectedColumns,
        showMetadata: showMetadata,
        pageSize: pageSize,
        enableSearch: enableSearch,
        enableSorting: enableSorting,
        enableFiltering: enableFiltering,
        enableExport: enableExport,
        filters: filters,
        joinConfig: joinEnabled ? {
          enabled: true,
          ...joinConfig
        } : { enabled: false }
      };

      const newReport = await createReport({
        name: title,
        description: description || 'Dynamic data table report'
      });

      if (newReport) {
        await saveReportComponent({
          report_id: newReport.id,
          type: 'table', // Changed from 'dynamic-table' to 'table'
          config: reportConfig,
          layout: {
            x: 0,
            y: 0,
            w: 12,
            h: 10
          }
        });

        toast({
          title: "Success",
          description: "Data table report created successfully",
        });
        navigate(`/report-editor/${newReport.id}`);
      }
    } catch (error) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: "Failed to create data table report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Creating Report...">
        <div className="flex items-center justify-center h-64">
          <SimpleLoadingSpinner size={32} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Data Table Builder">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/reports')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Data Table Builder</h1>
                <p className="text-muted-foreground">Create dynamic, filterable data tables from your forms</p>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading || !selectedFormId}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Create Report'}
          </Button>
        </div>

        {/* Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle>Table Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="columns">Columns</TabsTrigger>
                <TabsTrigger value="join">Join Forms</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="filters">Filters</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Report Title *</label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter report title"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your table report"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <SimpleFormSelector
                      forms={forms}
                      selectedFormId={selectedFormId}
                      onFormSelect={handleFormSelect}
                      disabled={loading || formLoading}
                    />

                    <div>
                      <label className="text-sm font-medium">Page Size</label>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(parseInt(e.target.value))}
                        className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background"
                      >
                        <option value={10}>10 rows</option>
                        <option value={25}>25 rows</option>
                        <option value={50}>50 rows</option>
                        <option value={100}>100 rows</option>
                      </select>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="columns" className="mt-6">
                {formLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <SimpleLoadingSpinner size={24} />
                    <span className="ml-2">Loading form fields...</span>
                  </div>
                ) : (
                  <ColumnSelector
                    form={selectedFormWithFields}
                    selectedColumns={selectedColumns}
                    onColumnsChange={setSelectedColumns}
                  />
                )}
              </TabsContent>

              <TabsContent value="join" className="mt-6">
                {selectedFormWithFields ? (
                  <FormJoinConfig
                    enabled={joinEnabled}
                    onEnabledChange={setJoinEnabled}
                    primaryForm={{
                      id: selectedFormWithFields.id,
                      name: selectedFormWithFields.name,
                      fields: selectedFormWithFields.fields
                    }}
                    availableForms={availableFormsWithFields}
                    joinConfig={joinConfig}
                    onJoinConfigChange={setJoinConfig}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Please select a primary form first to configure joins
                  </div>
                )}
              </TabsContent>

              <TabsContent value="features" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Table Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="show-metadata"
                          checked={showMetadata}
                          onCheckedChange={(checked) => setShowMetadata(!!checked)}
                        />
                        <label htmlFor="show-metadata" className="text-sm">Show metadata columns</label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enable-search"
                          checked={enableSearch}
                          onCheckedChange={(checked) => setEnableSearch(!!checked)}
                        />
                        <label htmlFor="enable-search" className="text-sm">Enable search</label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enable-sorting"
                          checked={enableSorting}
                          onCheckedChange={(checked) => setEnableSorting(!!checked)}
                        />
                        <label htmlFor="enable-sorting" className="text-sm">Enable sorting</label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enable-filtering"
                          checked={enableFiltering}
                          onCheckedChange={(checked) => setEnableFiltering(!!checked)}
                        />
                        <label htmlFor="enable-filtering" className="text-sm">Enable filtering</label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enable-export"
                          checked={enableExport}
                          onCheckedChange={(checked) => setEnableExport(!!checked)}
                        />
                        <label htmlFor="enable-export" className="text-sm">Enable export</label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="filters" className="mt-6">
                <TableFiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  forms={forms}
                  primaryFormId={selectedFormId}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Table Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SimpleTablePreview
              selectedForm={selectedFormWithFields}
              selectedColumns={selectedColumns}
              filters={filters}
              enableSearch={enableSearch}
              enableSorting={enableSorting}
              enableExport={enableExport}
              pageSize={pageSize}
              title={title}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DataTableBuilder;

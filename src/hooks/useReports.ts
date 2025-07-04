
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Report, ReportComponent } from '@/types/reports';
import { useForm } from '@/contexts/FormContext';

export function useReports() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const { forms } = useForm();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: loading, refetch: refetchReports } = useQuery({
    queryKey: ['reports', currentProject?.id],
    queryFn: async () => {
      if (!currentProject) return [];
      
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProject,
  });

  const createReport = async (reportData: { name: string; description?: string }) => {
    if (!userProfile?.organization_id || !currentProject) {
      throw new Error('Organization and project required');
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        name: reportData.name,
        description: reportData.description,
        project_id: currentProject.id,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteReport = async (reportId: string) => {
    // First delete all report components
    const { error: componentsError } = await supabase
      .from('report_components')
      .delete()
      .eq('report_id', reportId);

    if (componentsError) throw componentsError;

    // Then delete the report
    const { error: reportError } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (reportError) throw reportError;
    
    // Invalidate queries to refresh the reports list
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const loadReports = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const fetchReportComponents = async (reportId: string) => {
    const { data, error } = await supabase
      .from('report_components')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const saveReportComponent = async (componentData: Omit<ReportComponent, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('report_components')
      .insert(componentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateReportComponent = async (componentId: string, updates: Partial<ReportComponent>) => {
    const { data, error } = await supabase
      .from('report_components')
      .update(updates)
      .eq('id', componentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteReportComponent = async (componentId: string) => {
    const { error } = await supabase
      .from('report_components')
      .delete()
      .eq('id', componentId);

    if (error) throw error;
  };

  const getFormSubmissionData = async (formId: string) => {
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId);

    if (error) throw error;
    return data || [];
  };

  const getFormFields = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    return form?.fields || [];
  };

  const getAvailableForms = async () => {
    return forms.map(form => ({
      id: form.id,
      name: form.name,
      description: form.description
    }));
  };

  return {
    reports,
    loading,
    forms,
    refetchReports,
    createReport,
    deleteReport,
    loadReports,
    fetchReportComponents,
    saveReportComponent,
    updateReportComponent,
    deleteReportComponent,
    getFormSubmissionData,
    getFormFields,
    getAvailableForms,
  };
}

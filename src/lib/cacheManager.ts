/**
 * Centralized Cache Manager
 * Handles React Query cache invalidation and schemaCache coordination
 */

import { QueryClient } from '@tanstack/react-query';
import { schemaCache } from '@/services/schemaCache';

// Query keys for consistent cache management
export const queryKeys = {
  // Forms
  forms: (projectId?: string) => ['forms', projectId] as const,
  form: (formId: string) => ['form', formId] as const,
  formFields: (formId: string) => ['formFields', formId] as const,
  
  // Users & Groups
  users: (orgId?: string) => ['users', orgId] as const,
  groups: (orgId?: string) => ['groups', orgId] as const,
  projectUsers: (projectId: string) => ['projectUsers', projectId] as const,
  projectInvitations: (projectId: string) => ['projectInvitations', projectId] as const,
  userInvitations: (userId: string) => ['userInvitations', userId] as const,
  
  // Data & Feeds
  dataFeeds: (projectId: string) => ['dataFeeds', projectId] as const,
  dataFeedRuns: (feedId: string) => ['dataFeedRuns', feedId] as const,
  
  // Reports & Submissions
  submissions: (formId: string) => ['submissions', formId] as const,
  reports: (projectId?: string) => ['reports', projectId] as const,
  
  // Permissions
  formPermissions: (formId: string) => ['formPermissions', formId] as const,
  assetPermissions: (projectId: string) => ['assetPermissions', projectId] as const,
  
  // Saved Queries & Filters
  savedQueries: () => ['savedQueries'] as const,
  savedFilters: (formId: string) => ['savedFilters', formId] as const,
} as const;

class CacheManager {
  private queryClient: QueryClient | null = null;

  setQueryClient(client: QueryClient) {
    this.queryClient = client;
  }

  getQueryClient(): QueryClient | null {
    return this.queryClient;
  }

  // ============ Form Cache Invalidation ============
  
  invalidateForm(formId: string) {
    // Invalidate schema cache for field metadata
    schemaCache.invalidateCache();
    
    // Invalidate React Query caches
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: queryKeys.form(formId) });
      this.queryClient.invalidateQueries({ queryKey: queryKeys.formFields(formId) });
      this.queryClient.invalidateQueries({ queryKey: queryKeys.submissions(formId) });
    }
  }

  invalidateAllForms(projectId?: string) {
    schemaCache.invalidateCache();
    
    if (this.queryClient) {
      if (projectId) {
        this.queryClient.invalidateQueries({ queryKey: queryKeys.forms(projectId) });
      } else {
        this.queryClient.invalidateQueries({ queryKey: ['forms'] });
      }
    }
  }

  // ============ User Cache Invalidation ============
  
  invalidateUsers(orgId?: string) {
    if (this.queryClient) {
      if (orgId) {
        this.queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) });
      } else {
        this.queryClient.invalidateQueries({ queryKey: ['users'] });
      }
    }
  }

  invalidateProjectUsers(projectId: string) {
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: queryKeys.projectUsers(projectId) });
      this.queryClient.invalidateQueries({ queryKey: queryKeys.projectInvitations(projectId) });
    }
  }

  // ============ Groups Cache Invalidation ============
  
  invalidateGroups(orgId?: string) {
    if (this.queryClient) {
      if (orgId) {
        this.queryClient.invalidateQueries({ queryKey: queryKeys.groups(orgId) });
      } else {
        this.queryClient.invalidateQueries({ queryKey: ['groups'] });
      }
    }
  }

  // ============ Data Feeds Cache Invalidation ============
  
  invalidateDataFeeds(projectId: string) {
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: queryKeys.dataFeeds(projectId) });
    }
  }

  invalidateDataFeedRuns(feedId: string) {
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: queryKeys.dataFeedRuns(feedId) });
    }
  }

  // ============ Reports Cache Invalidation ============
  
  invalidateReports(projectId?: string) {
    if (this.queryClient) {
      if (projectId) {
        this.queryClient.invalidateQueries({ queryKey: queryKeys.reports(projectId) });
      } else {
        this.queryClient.invalidateQueries({ queryKey: ['reports'] });
      }
    }
  }

  // ============ Submissions Cache Invalidation ============
  
  invalidateSubmissions(formId: string) {
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: queryKeys.submissions(formId) });
    }
  }

  // ============ Full Cache Clear ============
  
  clearAll() {
    schemaCache.invalidateCache();
    if (this.queryClient) {
      this.queryClient.clear();
    }
  }

  // ============ Prefetch utilities ============
  
  async prefetchForm(formId: string, fetchFn: () => Promise<any>) {
    if (this.queryClient) {
      await this.queryClient.prefetchQuery({
        queryKey: queryKeys.form(formId),
        queryFn: fetchFn,
        staleTime: 2 * 60 * 1000, // 2 minutes
      });
    }
  }
}

export const cacheManager = new CacheManager();

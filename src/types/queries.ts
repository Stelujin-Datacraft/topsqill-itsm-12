export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface QueryTab {
  id: string;
  name: string;
  query: string;
  isActive: boolean;
  isDirty: boolean;
  savedQueryId?: string; // Reference to saved query ID if this tab represents a saved query
}
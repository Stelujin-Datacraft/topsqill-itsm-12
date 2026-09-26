import { Navigate } from 'react-router-dom';

/**
 * Legacy route: API Integration is now the API Keys tab under Integrations.
 */
export default function ApiIntegration() {
  return <Navigate to="/integrations?tab=api-keys" replace />;
}

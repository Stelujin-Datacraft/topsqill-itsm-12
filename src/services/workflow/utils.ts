
// Helper function to safely parse config from database
export function parseNodeConfig(config: any): any {
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  return config && typeof config === 'object' ? config : {};
}

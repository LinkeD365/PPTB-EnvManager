interface EnvironmentApiOptions {
  connectionTarget?: "primary" | "secondary";
}

const API_VERSION = "2024-10-01";

export async function getEnvironmentManagementSettings(
  environmentId: string,
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  const endpoint = `environments/${environmentId}/settings?api-version=${API_VERSION}`;
  return window.powerplatformAPI.EnvironmentManagement.Get(endpoint, options?.connectionTarget);
}

export async function updateEnvironmentManagementSettings(
  environmentId: string,
  changes: Record<string, string | number | boolean | null>,
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  const endpoint = `environments/${environmentId}/settings?api-version=${API_VERSION}`;
  return window.powerplatformAPI.EnvironmentManagement.Patch(endpoint, changes, options?.connectionTarget);
}

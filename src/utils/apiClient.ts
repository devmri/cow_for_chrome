
import { getAccessToken, getApiBaseUrl } from "../lib/sentryService";

class ApiClient {
  async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseURL = await getApiBaseUrl();
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("No valid OAuth token available");
    }

    const url = `${baseURL}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();

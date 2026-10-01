const getApiBase = (): string => {
  const envUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // When running on Render or deployed domain, default to production backend URL rather than localhost
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('onrender.com') || (host !== 'localhost' && host !== '127.0.0.1')) {
      return 'https://cirsis-command-multi-agent-environment.onrender.com';
    }
  }
  return 'http://localhost:8000';
};

const API_BASE = getApiBase();

/**
 * Normalizes any API or network error into a clean, human-readable string.
 * Strictly guarantees that '[object Object]' is never returned.
 */
export function normalizeApiError(err: any): string {
  if (!err) {
    return 'An unexpected error occurred. Please try again.';
  }

  // 1. If already a string
  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (!trimmed || trimmed === '[object Object]') {
      return 'An unexpected error occurred. Please try again.';
    }
    // Handle stringified JSON errors
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeApiError(parsed);
      } catch {
        // Not valid JSON, continue with trimmed string
      }
    }
    return trimmed;
  }

  // 2. If it's a TypeError from fetch (network/CORS failure)
  if (err instanceof TypeError || (err.name === 'TypeError' && err.message)) {
    if (typeof err.message === 'string' && err.message.toLowerCase().includes('fetch')) {
      return 'Unable to reach Crisis Command servers. Please check your internet connection or try again shortly.';
    }
  }

  // 3. Nested response/data wrappers (e.g., Axios or custom response bodies)
  if (err.response && err.response.data) {
    return normalizeApiError(err.response.data);
  }
  if (err.data) {
    return normalizeApiError(err.data);
  }

  // 4. FastAPI standard 'detail' field
  if (err.detail !== undefined && err.detail !== null) {
    if (typeof err.detail === 'string') {
      return normalizeApiError(err.detail);
    }
    if (Array.isArray(err.detail)) {
      const messages = err.detail
        .map((item: any) => {
          if (!item) return '';
          if (typeof item === 'string') return item;
          const field = Array.isArray(item.loc) && item.loc.length > 0 ? String(item.loc[item.loc.length - 1]) : '';
          const msg = item.msg || item.message || '';
          if (field && field !== 'body') {
            return `${field}: ${msg}`;
          }
          return msg;
        })
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join('. ');
      }
      return 'Validation error. Please verify the provided details.';
    }
    if (typeof err.detail === 'object') {
      if (typeof err.detail.message === 'string' && err.detail.message.trim()) {
        return err.detail.message.trim();
      }
      if (typeof err.detail.detail === 'string' && err.detail.detail.trim()) {
        return err.detail.detail.trim();
      }
      if (typeof err.detail.error === 'string' && err.detail.error.trim()) {
        return err.detail.error.trim();
      }
    }
  }

  // 5. Standard 'message' field
  if (err.message) {
    if (typeof err.message === 'string') {
      const msg = err.message.trim();
      if (msg && msg !== '[object Object]') {
        return normalizeApiError(msg);
      }
    } else {
      return normalizeApiError(err.message);
    }
  }

  // 6. Generic 'error' field
  if (err.error && typeof err.error === 'string') {
    const errorStr = err.error.trim();
    if (errorStr && errorStr !== '[object Object]') {
      return errorStr;
    }
  }

  // 7. Status Text
  if (err.statusText && typeof err.statusText === 'string') {
    const st = err.statusText.trim();
    if (st && st !== '[object Object]') {
      return st;
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

class ApiService {
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('crisis_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });
    } catch (networkErr: any) {
      throw new Error(normalizeApiError(networkErr));
    }

    if (!res.ok) {
      let rawError: any = null;
      try {
        rawError = await res.json();
      } catch {
        try {
          rawError = await res.text();
        } catch {
          rawError = res.statusText || `HTTP Error ${res.status}`;
        }
      }
      const humanMessage = normalizeApiError(rawError || res.statusText);
      const err = new Error(humanMessage);
      (err as any).status = res.status;
      (err as any).data = rawError;
      throw err;
    }

    return res.json();
  }

  // Auth
  async register(data: any) {
    return this.request<{ status: string; message: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyOtp(email: string, otp: string) {
    return this.request<{ access_token: string; user: any }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async login(data: any) {
    return this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ status: string; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async listUsers() {
    return this.request<{ users: any[]; total: number }>('/auth/users');
  }

  async updateUserStatus(email: string, statusData: { status?: string; is_verified?: boolean }) {
    return this.request<{ status: string; message: string; user: any }>(`/auth/users/${encodeURIComponent(email)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    });
  }

  // Incidents
  async getIncidents(params?: { status?: string; severity?: string; incident_type?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/incidents${query ? `?${query}` : ''}`);
  }

  async getIncident(id: string) {
    return this.request<any>(`/incidents/${id}`);
  }

  async createIncident(data: any) {
    return this.request<any>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIncidentStatus(id: string, new_status: string, notes?: string) {
    const query = new URLSearchParams({ new_status, ...(notes ? { notes } : {}) }).toString();
    return this.request<any>(`/incidents/${id}?${query}`, {
      method: 'PATCH',
    });
  }

  // Resources
  async getResources(params?: { type?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/resources${query ? `?${query}` : ''}`);
  }

  async getResource(id: string) {
    return this.request<any>(`/resources/${id}`);
  }

  async updateResourceStatus(id: string, data: { status?: string; available_units?: number }) {
    const query = new URLSearchParams(data as any).toString();
    return this.request<any>(`/resources/${id}?${query}`, {
      method: 'PATCH',
    });
  }

  async updateResourceLocation(id: string, data: { latitude: number; longitude: number; accuracy?: number; heading?: number; speed?: number; timestamp?: number }) {
    return this.request<any>(`/resources/${id}/location`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleResourceLiveTracking(id: string, enabled: boolean) {
    return this.request<any>(`/resources/${id}/live-tracking?enabled=${enabled}`, {
      method: 'POST',
    });
  }

  // Assignments
  async getAssignments(params?: { incident_id?: string; resource_id?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/assignments${query ? `?${query}` : ''}`);
  }

  async getAssignment(id: string) {
    return this.request<any>(`/assignments/${id}`);
  }

  async acceptAssignment(id: string, notes?: string) {
    return this.request<any>(`/assignments/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ action: 'ACCEPT', notes }),
    });
  }

  async rejectAssignment(id: string, reason?: string) {
    return this.request<any>(`/assignments/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ action: 'REJECT', reason }),
    });
  }

  async updateAssignmentStatus(id: string, status: string, notes?: string) {
    const query = new URLSearchParams({ status, ...(notes ? { notes } : {}) }).toString();
    return this.request<any>(`/assignments/${id}/status?${query}`, {
      method: 'PATCH',
    });
  }

  async prepareTraumaBays(id: string) {
    return this.request<any>(`/assignments/${id}/prepare-trauma-bays`, {
      method: 'POST',
    });
  }

  // Plans
  async getPlans(incident_id?: string) {
    const query = incident_id ? `?incident_id=${incident_id}` : '';
    return this.request<any[]>(`/plans${query}`);
  }

  // Replanning
  async triggerReplanning(data: { incident_id: string; reason: string; escalate_severity?: string; unavailable_resource_id?: string }) {
    return this.request<any>('/replanning/trigger', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  async getNotifications(params?: { role?: string; user_id?: string; resource_id?: string }) {
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return this.request<any[]>(`/notifications${query ? `?${query}` : ''}`);
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ status: string; marked_read_count: number }>('/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  async updateHospitalCapacity(id: string, data: { available_units?: number; capacity?: number; icu_beds?: number; trauma_bays?: number }) {
    return this.request<any>(`/resources/${id}/capacity`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Incident Sharing (Universal / Device)
  async shareIncident(incident_id: string) {
    return this.request<{ status: string; incident_id: string; title: string; text: string; url: string; map_url: string; summary: any }>(`/share/incident/${incident_id}`);
  }

  // Analytics & AI Prediction Engine
  async getAnalytics() {
    return this.request<any>('/analytics');
  }

  async getPrediction() {
    return this.request<any>('/analytics/prediction');
  }

  // Commander Overrides
  async commanderOverride(data: {
    incident_id: string;
    action_type: string;
    resource_id?: string;
    new_resource_id?: string;
    new_severity?: string;
    reason: string;
  }) {
    return this.request<any>('/commander/override', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAuditLogs() {
    return this.request<any[]>('/commander/audit-logs');
  }

  // Demo Controls
  async demoSimulateFire() {
    return this.request<any>('/demo/simulate-fire', { method: 'POST' });
  }

  async demoSimulateAccident() {
    return this.request<any>('/demo/simulate-accident', { method: 'POST' });
  }

  async demoEscalateFire(incident_id: string = 'INC-001') {
    return this.request<any>('/demo/escalate-fire', {
      method: 'POST',
      body: JSON.stringify({ incident_id }),
    });
  }

  async demoAmbulanceUnavailable(resource_id: string = 'RES-AMB-01') {
    return this.request<any>('/demo/ambulance-unavailable', {
      method: 'POST',
      body: JSON.stringify({ resource_id }),
    });
  }

  async demoResourceAvailable(resource_id: string) {
    return this.request<any>('/demo/resource-available', {
      method: 'POST',
      body: JSON.stringify({ resource_id }),
    });
  }

  async demoResolveIncident(incident_id: string) {
    return this.request<any>('/demo/resolve-incident', {
      method: 'POST',
      body: JSON.stringify({ incident_id }),
    });
  }

  async demoReset() {
    return this.request<any>('/demo/reset', { method: 'POST' });
  }

  // OpenStreetMap Nominatim Geocoding & Routing
  async geocode(query: string) {
    return this.request<{ status: string; data: { latitude: number; longitude: number; display_name: string } }>(
      `/geo/geocode?q=${encodeURIComponent(query)}`
    );
  }

  async reverseGeocode(lat: number, lng: number) {
    return this.request<{ status: string; address: string; latitude: number; longitude: number }>(
      `/geo/reverse?lat=${lat}&lng=${lng}`
    );
  }

  async calculateRoute(startLat: number, startLng: number, destLat: number, destLng: number, resourceType?: string) {
    return this.request<{ status: string; route: any }>('/geo/route', {
      method: 'POST',
      body: JSON.stringify({
        start_lat: startLat,
        start_lng: startLng,
        dest_lat: destLat,
        dest_lng: destLng,
        resource_type: resourceType,
      }),
    });
  }
}

export const api = new ApiService();

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

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
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errorData = await res.json();
        errorMsg = errorData.detail || errorData.message || res.statusText;
      } catch {
        errorMsg = res.statusText;
      }
      throw new Error(errorMsg);
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

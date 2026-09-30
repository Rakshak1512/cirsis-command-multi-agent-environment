import { create } from 'zustand';
import { User, Incident, Resource, ResponsePlan, Assignment, NotificationItem, AuditLogItem, UserRole } from '../types';
import { api } from '../services/api';
import { wsClient, ConnectionStatus } from '../services/websocket';

interface CrisisState {
  user: User | null;
  token: string | null;
  connectionStatus: ConnectionStatus;
  incidents: Incident[];
  resources: Resource[];
  assignments: Assignment[];
  plans: ResponsePlan[];
  notifications: NotificationItem[];
  auditLogs: AuditLogItem[];
  selectedIncident: Incident | null;
  isLoading: boolean;
  activeFilter: {
    severity: string | null;
    type: string | null;
    status: string | null;
  };
  liveBanner: {
    title: string;
    message: string;
    type: 'CRITICAL' | 'ALERT' | 'SUCCESS';
  } | null;

  // Actions
  setUser: (user: User | null, token?: string) => void;
  logout: () => void;
  setSelectedIncident: (incident: Incident | null) => void;
  setFilter: (filter: Partial<CrisisState['activeFilter']>) => void;
  clearLiveBanner: () => void;
  
  // Async Sync & Actions
  fetchInitialData: () => Promise<void>;
  initWebSocket: () => void;
  triggerReplan: (incidentId: string, reason: string, severity?: string) => Promise<void>;
  overrideCommander: (overrideData: any) => Promise<void>;
  acceptAssignment: (assignmentId: string, notes?: string) => Promise<void>;
  rejectAssignment: (assignmentId: string, reason?: string) => Promise<void>;
  prepareTraumaBays: (assignmentId: string) => Promise<void>;
  updateAssignmentStatus: (assignmentId: string, status: string, notes?: string) => Promise<void>;
  updateHospitalCapacity: (resourceId: string, data: { available_units?: number; capacity?: number; icu_beds?: number; trauma_bays?: number }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  streamResponderLocation: (resourceId: string, location: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
}

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('crisis_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useCrisisStore = create<CrisisState>((set, get) => ({
  user: getStoredUser(),
  token: localStorage.getItem('crisis_token') || null,
  connectionStatus: wsClient.status,
  incidents: [],
  resources: [],
  assignments: [],
  plans: [],
  notifications: [],
  auditLogs: [],
  selectedIncident: null,
  isLoading: false,
  activeFilter: {
    severity: null,
    type: null,
    status: null,
  },
  liveBanner: null,

  setUser: (user, token) => {
    if (user) localStorage.setItem('crisis_user', JSON.stringify(user));
    else localStorage.removeItem('crisis_user');

    if (token) localStorage.setItem('crisis_token', token);
    else localStorage.removeItem('crisis_token');

    set({ user, token: token || null });
    // Reconnect socket session with new credentials
    wsClient.disconnect();
    wsClient.connect();
    get().fetchInitialData();
  },

  logout: () => {
    localStorage.removeItem('crisis_user');
    localStorage.removeItem('crisis_token');
    wsClient.disconnect();
    set({ user: null, token: null, notifications: [], assignments: [] });
  },

  setSelectedIncident: (incident) => set({ selectedIncident: incident }),

  setFilter: (newFilter) =>
    set((state) => ({ activeFilter: { ...state.activeFilter, ...newFilter } })),

  clearLiveBanner: () => set({ liveBanner: null }),

  fetchInitialData: async () => {
    set({ isLoading: true });
    try {
      const currentUser = get().user;
      const role = currentUser?.role;

      const [incidents, resources, plans, notifications, auditLogs, assignments] = await Promise.all([
        api.getIncidents(),
        api.getResources(),
        api.getPlans(),
        api.getNotifications(role ? { role } : undefined).catch(() => []),
        api.getAuditLogs().catch(() => []),
        api.getAssignments().catch(() => []),
      ]);

      const sortedNotifs = Array.isArray(notifications)
        ? [...notifications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [];

      set({
        incidents: Array.isArray(incidents) ? incidents : [],
        resources: Array.isArray(resources) ? resources : [],
        plans: Array.isArray(plans) ? plans : [],
        notifications: sortedNotifs,
        auditLogs: Array.isArray(auditLogs) ? auditLogs : [],
        assignments: Array.isArray(assignments) ? assignments : [],
        selectedIncident: (incidents && incidents[0]) || null,
        isLoading: false,
      });
    } catch (err) {
      console.warn('Error fetching initial crisis data:', err);
      set({ isLoading: false });
    }
  },

  initWebSocket: () => {
    // Listen for connection status changes
    wsClient.onStatusChange((status) => {
      set({ connectionStatus: status });
    });

    // Register fallback poll callback for when WS is interrupted
    wsClient.setFallbackPoll(() => {
      get().fetchInitialData();
    });

    wsClient.connect();

    wsClient.on('INCIDENT_CREATED', (newIncident: Incident) => {
      set((state) => ({
        incidents: [newIncident, ...state.incidents.filter((i) => i.id !== newIncident.id)],
        selectedIncident: newIncident,
        liveBanner: {
          title: `NEW CRITICAL INCIDENT: ${newIncident.title}`,
          message: `Plan V1 automatically executed. ${newIncident.severity} severity detected.`,
          type: 'CRITICAL',
        },
      }));
    });

    wsClient.on('INCIDENT_UPDATED', (updatedIncident: Incident) => {
      set((state) => ({
        incidents: state.incidents.map((i) => (i.id === updatedIncident.id ? updatedIncident : i)),
        selectedIncident:
          state.selectedIncident?.id === updatedIncident.id ? updatedIncident : state.selectedIncident,
      }));
    });

    wsClient.on('RESOURCES_UPDATED', (resources: Resource[]) => {
      set({ resources });
    });

    wsClient.on('ASSIGNMENT_UPDATED', (updatedAsg: Assignment) => {
      set((state) => ({
        assignments: state.assignments.some((a) => a.id === updatedAsg.id)
          ? state.assignments.map((a) => (a.id === updatedAsg.id ? updatedAsg : a))
          : [updatedAsg, ...state.assignments],
      }));
    });

    wsClient.on('RESOURCE_ACCEPTED', () => {
      get().fetchInitialData();
    });

    wsClient.on('RESOURCE_REJECTED', () => {
      get().fetchInitialData();
    });

    wsClient.on('RESOURCE_LOCATION_UPDATED', (payload: any) => {
      set((state) => ({
        resources: state.resources.map((r) =>
          r.id === payload.resource_id
            ? {
                ...r,
                latitude: payload.latitude,
                longitude: payload.longitude,
                accuracy: payload.accuracy,
                last_location_update: payload.timestamp,
                is_live_location: true,
                updated_at: payload.timestamp || new Date().toISOString(),
              }
            : r
        ),
      }));
    });

    wsClient.on('ETA_UPDATED', (payload: any) => {
      set((state) => ({
        assignments: state.assignments.map((a) =>
          a.incident_id === payload.incident_id && a.resource_id === payload.resource_id
            ? { ...a, distance_km: payload.distance_km, eta_minutes: payload.eta_minutes }
            : a
        ),
      }));
    });

    wsClient.on('PLAN_UPDATED', (newPlan: ResponsePlan) => {
      set((state) => {
        const updatedPlans = [newPlan, ...state.plans.filter((p) => p.id !== newPlan.id)];
        return {
          plans: updatedPlans,
          liveBanner: {
            title: `DYNAMIC REPLANNING: ${newPlan.version} ACTIVATED`,
            message: `${newPlan.change_reason || 'Autonomous replanning executed with zero downtime.'}`,
            type: 'ALERT',
          },
        };
      });
    });

    wsClient.on('NOTIFICATIONS_UPDATED', (notifications: NotificationItem[]) => {
      const sorted = Array.isArray(notifications)
        ? [...notifications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [];
      set({ notifications: sorted });
    });

    wsClient.on('DEMO_RESET', () => {
      get().fetchInitialData();
    });
  },

  acceptAssignment: async (assignmentId: string, notes?: string) => {
    try {
      const updated = await api.acceptAssignment(assignmentId, notes);
      set((state) => ({
        assignments: state.assignments.map((a) => (a.id === assignmentId ? updated : a)),
      }));
      await get().fetchInitialData();
    } catch (e) {
      console.error('Accept assignment error:', e);
      throw e;
    }
  },

  rejectAssignment: async (assignmentId: string, reason?: string) => {
    try {
      const updated = await api.rejectAssignment(assignmentId, reason);
      set((state) => ({
        assignments: state.assignments.map((a) => (a.id === assignmentId ? updated : a)),
      }));
      await get().fetchInitialData();
    } catch (e) {
      console.error('Reject assignment error:', e);
      throw e;
    }
  },

  prepareTraumaBays: async (assignmentId: string) => {
    try {
      const updated = await api.prepareTraumaBays(assignmentId);
      set((state) => ({
        assignments: state.assignments.map((a) => (a.id === assignmentId ? updated : a)),
      }));
      await get().fetchInitialData();
    } catch (e) {
      console.error('Prepare trauma bays error:', e);
      throw e;
    }
  },

  updateAssignmentStatus: async (assignmentId: string, status: string, notes?: string) => {
    try {
      const updated = await api.updateAssignmentStatus(assignmentId, status, notes);
      set((state) => ({
        assignments: state.assignments.map((a) => (a.id === assignmentId ? updated : a)),
      }));
      await get().fetchInitialData();
    } catch (e) {
      console.error('Update assignment status error:', e);
      throw e;
    }
  },

  updateHospitalCapacity: async (resourceId: string, data) => {
    try {
      const updated = await api.updateHospitalCapacity(resourceId, data);
      set((state) => ({
        resources: state.resources.map((r) => (r.id === resourceId ? updated : r)),
      }));
    } catch (e) {
      console.error('Update hospital capacity error:', e);
      throw e;
    }
  },

  markNotificationRead: async (id: string) => {
    // Optimistic local update
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    try {
      await api.markNotificationRead(id);
    } catch (e) {
      console.warn('Mark read error:', e);
    }
  },

  markAllNotificationsRead: async () => {
    // Optimistic local update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    try {
      await api.markAllNotificationsRead();
    } catch (e) {
      console.warn('Mark all read error:', e);
    }
  },

  streamResponderLocation: async (resourceId: string, location: { latitude: number; longitude: number; accuracy?: number }) => {
    try {
      await api.updateResourceLocation(resourceId, {
        ...location,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('Stream location error:', e);
    }
  },

  triggerReplan: async (incidentId, reason, severity) => {
    try {
      const plan = await api.triggerReplanning({
        incident_id: incidentId,
        reason,
        escalate_severity: severity,
      });
      set((state) => ({
        plans: [plan, ...state.plans.filter((p) => p.id !== plan.id)],
      }));
    } catch (e) {
      console.error('Replanning error:', e);
    }
  },

  overrideCommander: async (overrideData) => {
    try {
      await api.commanderOverride(overrideData);
      get().fetchInitialData();
    } catch (e) {
      console.error('Override error:', e);
    }
  },
}));

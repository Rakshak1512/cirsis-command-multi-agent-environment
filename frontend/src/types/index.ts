export type UserRole = 'CITIZEN' | 'FIRE_TEAM' | 'HOSPITAL' | 'COMMANDER' | 'DISPATCHER' | 'ADMIN';

export type IncidentType = 'fire' | 'road_accident';

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentUrgency = 'CRITICAL' | 'URGENT' | 'MODERATE' | 'ROUTINE';

export type IncidentStatus = 'REPORTED' | 'ASSESSED' | 'ALLOCATED' | 'EN_ROUTE' | 'ON_SCENE' | 'RESOLVED' | 'CANCELLED';

export type ResourceType = 'fire_team' | 'ambulance' | 'hospital';

export type ResourceStatus = 'AVAILABLE' | 'DISPATCHED' | 'BUSY' | 'UNAVAILABLE';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_verified: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  latitude: float;
  longitude: float;
  address: string;
  contact: string;
  current_incident_id?: string;
  current_assignment?: string;
  capacity: number;
  available_units: number;
  specialization?: string[];
  equipment?: string[];
  updated_at: string;
  last_location_update?: string;
  is_live_location?: boolean;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export type float = number;

export interface Assignment {
  id: string;
  incident_id: string;
  plan_id: string;
  resource_id: string;
  resource_name: string;
  resource_type: ResourceType;
  status: string;           // DISPATCHED, ASSIGNED, ACCEPTED, EN_ROUTE, ARRIVED, RESPONDING, RESOLVED, REJECTED
  response_status?: string; // ASSIGNED, ACCEPTED, REJECTED
  eta_minutes: number;
  distance_km: number;
  route_summary: string;
  assigned_at: string;
  updated_at: string;
}

export interface ResponsePlan {
  id: string;
  incident_id: string;
  version: string;
  status: string;
  assignments: Assignment[];
  alternative_resources: any[];
  change_reason?: string;
  why_plan_changed?: string[];
  triggered_by: string;
  created_at: string;
  activated_at: string;
}

export interface IncidentAssessment {
  incident_type: IncidentType;
  severity: IncidentSeverity;
  urgency: IncidentUrgency;
  people_at_risk: number;
  vehicles_involved?: number;
  burn_hazard?: boolean;
  extrication_needed?: boolean;
  required_resources: string[];
  reasoning: string[];
  source_conflict?: boolean;
  conflict_notes?: string;
  confidence_score: number;
}

export interface Incident {
  id: string;
  incident_type: IncidentType;
  title: string;
  description: string;
  severity: IncidentSeverity;
  urgency: IncidentUrgency;
  status: IncidentStatus;
  people_affected: number;
  latitude: number;
  longitude: number;
  accuracy?: number;              // GPS accuracy in meters at time of report
  location_captured_at?: string;  // ISO timestamp when citizen GPS was captured
  address: string;
  image_url?: string;
  video_url?: string;
  reported_by_id?: string;
  source_type: string;
  source_confidence: number;
  assessment?: IncidentAssessment;
  current_plan_id?: string;
  current_plan_version?: string;
  plans: ResponsePlan[];
  timeline: Array<{
    timestamp: string;
    event: string;
    details: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  recipient_role?: string;
  recipient_user_id?: string;
  resource_id?: string;
  title: string;
  message: string;
  incident_id?: string;
  plan_version?: string;
  type: 'CRITICAL' | 'ALERT' | 'SUCCESS' | 'INFO';
  status?: string;
  read: boolean;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  action: string;
  previous_value?: string;
  new_value?: string;
  reason?: string;
  plan_version?: string;
  incident_id?: string;
  timestamp: string;
}

import { Incident } from '../types';

export interface IncidentSharePayload {
  title: string;
  text: string;
  url: string;
  mapUrl: string;
  incidentId: string;
}

export class UniversalShareService {
  /**
   * Check if native Web Share API is available and can share payload.
   */
  canShareNative(data?: ShareData): boolean {
    if (typeof navigator === 'undefined' || !navigator.share) {
      return false;
    }
    if (navigator.canShare && data) {
      try {
        return navigator.canShare(data);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if native file sharing is supported.
   */
  canShareFiles(files: File[]): boolean {
    if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
      return false;
    }
    try {
      return navigator.canShare({ files });
    } catch {
      return false;
    }
  }

  /**
   * Formats incident data into the standard Crisis Command emergency alert structure.
   */
  formatIncidentShare(incident: Incident, assignedResourcesStr?: string, hospitalName?: string): IncidentSharePayload {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const secureUrl = `${origin}/citizen/incident/${incident.id}`;
    const mapUrl = `https://www.openstreetmap.org/?mlat=${incident.latitude}&mlon=${incident.longitude}#map=16/${incident.latitude}/${incident.longitude}`;

    // Extract assignments from active plan if available
    const activePlan = incident.plans?.find((p) => p.status === 'ACTIVE') || incident.plans?.[incident.plans.length - 1];
    let assigned = assignedResourcesStr;
    let hospital = hospitalName;

    if (activePlan?.assignments && !assigned) {
      const names = activePlan.assignments.map((a) => a.resource_name);
      assigned = names.length > 0 ? names.join(', ') : 'Immediate Response Units Dispatched';
      const hosp = activePlan.assignments.find((a) => a.resource_type === 'hospital');
      if (hosp) hospital = hosp.resource_name;
    }

    const typeStr = incident.incident_type.replace('_', ' ').toUpperCase();
    const planVer = incident.current_plan_version || 'PLAN V1';

    const text = 
`CRISIS COMMAND ALERT

Incident: ${typeStr}
Severity: ${incident.severity}
Location: ${incident.address}
People affected: ${incident.people_affected}
Assigned resources: ${assigned || 'Emergency Task Force Alpha'}
Hospital: ${hospital || 'Regional Trauma Center'}
ETA: 4-6 mins
Plan: ${planVer}
Incident ID: ${incident.id}

URL:
${secureUrl}`;

    return {
      title: 'Crisis Command Emergency Alert',
      text,
      url: secureUrl,
      mapUrl,
      incidentId: incident.id,
    };
  }

  /**
   * Primary share trigger directly from user action (button click).
   * Attempts navigator.share() directly. Returns true if native share succeeded,
   * false if native share is unsupported or user cancelled/failed (triggering fallback).
   */
  async shareIncident(incident: Incident): Promise<{ success: boolean; fallbackNeeded: boolean; payload: IncidentSharePayload }> {
    const payload = this.formatIncidentShare(incident);

    const shareData: ShareData = {
      title: payload.title,
      text: payload.text,
      url: payload.url,
    };

    if (this.canShareNative(shareData)) {
      try {
        await navigator.share(shareData);
        return { success: true, fallbackNeeded: false, payload };
      } catch (err: any) {
        // If user cancelled, don't show fallback; if real error, fallback
        if (err.name === 'AbortError') {
          return { success: false, fallbackNeeded: false, payload };
        }
        console.warn('Native share encountered an issue, offering fallback:', err);
        return { success: false, fallbackNeeded: true, payload };
      }
    }

    // Native Web Share API unavailable (e.g. desktop non-Safari or unsecure context)
    return { success: false, fallbackNeeded: true, payload };
  }

  /**
   * Share file report or incident media via native device share when supported.
   */
  async shareReportFile(file: File, title: string = 'Crisis Command Incident Report'): Promise<boolean> {
    if (this.canShareFiles([file])) {
      try {
        await navigator.share({
          title,
          text: `Official Crisis Command Incident Report - ${file.name}`,
          files: [file],
        });
        return true;
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn('Native file share failed:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Clipboard fallback: Copy formatted alert details
   */
  async copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clipboard fallback: Copy secure incident link
   */
  async copyUrl(url: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const universalShareService = new UniversalShareService();

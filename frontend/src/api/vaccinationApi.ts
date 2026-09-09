import api from './instance';

export interface AgeInfo {
  formatted: string;
  is_newborn: boolean;
  days: number;
  weeks: number;
  months: number;
  years: number;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  date_of_birth: string;
  gender: string;
  location?: string;
  district?: string;
  state?: string;
  is_je_endemic?: boolean;
  age_info?: AgeInfo;
  created_at?: number;
}

export interface VaccineItem {
  vaccine_id: string;
  vaccine_name: string;
  full_name: string;
  dose: string;
  route: string;
  recommended_age: string;
  window_start: string;
  window_end: string;
  scheduled_window: string;
  status: 'COMPLETED' | 'UPCOMING' | 'DUE' | 'OVERDUE' | 'NOT_APPLICABLE';
  days_offset: number;
  record?: any;
  administered_date?: string | null;
  facility_name?: string | null;
  notes?: string | null;
}

export interface Milestone {
  milestone_id: string;
  milestone_label: string;
  vaccines: VaccineItem[];
}

export interface ChildSchedule {
  child_id: string;
  child_name: string;
  date_of_birth: string;
  gender: string;
  location?: string;
  district?: string;
  state?: string;
  is_je_endemic?: boolean;
  age_info?: AgeInfo;
  metrics: {
    total: number;
    completed: number;
    upcoming: number;
    due: number;
    overdue: number;
    progress_percentage: number;
  };
  timeline: Milestone[];
}

export const vaccinationApi = {
  getChildren: async (): Promise<Child[]> => {
    const res = await api.get('/vaccinations/children');
    return res.data;
  },

  createChild: async (data: {
    name: string;
    date_of_birth: string;
    gender?: string;
    location?: string;
    district?: string;
    state?: string;
    is_je_endemic?: boolean;
  }): Promise<Child> => {
    const res = await api.post('/vaccinations/children', data);
    return res.data;
  },

  getChildDetail: async (childId: string): Promise<Child> => {
    const res = await api.get(`/vaccinations/children/${childId}`);
    return res.data;
  },

  deleteChild: async (childId: string): Promise<any> => {
    const res = await api.delete(`/vaccinations/children/${childId}`);
    return res.data;
  },

  getChildSchedule: async (childId: string): Promise<ChildSchedule> => {
    const res = await api.get(`/vaccinations/children/${childId}/schedule`);
    return res.data;
  },

  getNextVaccination: async (childId: string): Promise<any> => {
    const res = await api.get(`/vaccinations/children/${childId}/next`);
    return res.data;
  },

  getChildGaps: async (childId: string): Promise<any> => {
    const res = await api.get(`/vaccinations/children/${childId}/gaps`);
    return res.data;
  },

  recordVaccination: async (childId: string, data: {
    vaccine_id: string;
    vaccine_name: string;
    administered_date: string;
    facility_id?: string;
    facility_name?: string;
    notes?: string;
    dose?: string;
  }): Promise<any> => {
    const res = await api.post(`/vaccinations/children/${childId}/records`, data);
    return res.data;
  },

  deleteVaccinationRecord: async (childId: string, recordId: string): Promise<any> => {
    const res = await api.delete(`/vaccinations/children/${childId}/records/${recordId}`);
    return res.data;
  },

  setReminder: async (data: {
    child_id: string;
    vaccine_id: string;
    vaccine_name: string;
    reminder_date?: string;
  }): Promise<any> => {
    const res = await api.post('/vaccinations/reminders', data);
    return res.data;
  },

  getReminders: async (): Promise<any[]> => {
    const res = await api.get('/vaccinations/reminders');
    return res.data;
  },

  explainVaccine: async (data: {
    vaccine_name: string;
    question?: string;
    child_age?: string;
  }): Promise<{ vaccine_name: string; explanation: string; disclaimer: string }> => {
    const res = await api.post('/vaccinations/ai-explain', data);
    return res.data;
  }
};

export default vaccinationApi;

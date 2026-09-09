import api from './instance';
import {
  FollowUpRecord,
  FollowUpSummary,
  CreateFollowUpInput,
  UpdateFollowUpInput,
  RescheduleFollowUpInput,
  FollowUpChangeRequestInput,
  FollowUpCompleteInput,
  AIExplanationOutput
} from '../types/followup';

export const followupApi = {
  getSummary: async (patientId?: string): Promise<FollowUpSummary> => {
    const res = await api.get('/follow-ups/summary', { params: { patient_id: patientId } });
    return res.data;
  },

  getUpcoming: async (patientId?: string): Promise<FollowUpRecord[]> => {
    const res = await api.get('/follow-ups/upcoming', { params: { patient_id: patientId } });
    return res.data;
  },

  getPending: async (patientId?: string): Promise<FollowUpRecord[]> => {
    const res = await api.get('/follow-ups/pending', { params: { patient_id: patientId } });
    return res.data;
  },

  getOverdue: async (patientId?: string): Promise<FollowUpRecord[]> => {
    const res = await api.get('/follow-ups/overdue', { params: { patient_id: patientId } });
    return res.data;
  },

  getHistory: async (patientId?: string): Promise<FollowUpRecord[]> => {
    const res = await api.get('/follow-ups/history', { params: { patient_id: patientId } });
    return res.data;
  },

  list: async (params?: { patient_id?: string; status?: string; type?: string; priority?: string }): Promise<FollowUpRecord[]> => {
    const res = await api.get('/follow-ups', { params });
    return res.data;
  },

  getById: async (id: string): Promise<FollowUpRecord> => {
    const res = await api.get(`/follow-ups/${id}`);
    return res.data;
  },

  create: async (data: CreateFollowUpInput): Promise<FollowUpRecord> => {
    const res = await api.post('/follow-ups', data);
    return res.data;
  },

  update: async (id: string, data: UpdateFollowUpInput): Promise<FollowUpRecord> => {
    const res = await api.put(`/follow-ups/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete(`/follow-ups/${id}`);
    return res.data;
  },

  accept: async (id: string): Promise<FollowUpRecord> => {
    const res = await api.post(`/follow-ups/${id}/accept`);
    return res.data;
  },

  requestChange: async (id: string, data: FollowUpChangeRequestInput): Promise<FollowUpRecord> => {
    const res = await api.post(`/follow-ups/${id}/change-request`, data);
    return res.data;
  },

  approveChange: async (id: string): Promise<FollowUpRecord> => {
    const res = await api.post(`/follow-ups/${id}/change-request/approve`);
    return res.data;
  },

  rejectChange: async (id: string): Promise<FollowUpRecord> => {
    const res = await api.post(`/follow-ups/${id}/change-request/reject`);
    return res.data;
  },

  decline: async (id: string): Promise<FollowUpRecord> => {
    const res = await api.post(`/follow-ups/${id}/decline`);
    return res.data;
  },

  complete: async (id: string, data?: FollowUpCompleteInput | string): Promise<FollowUpRecord> => {
    const payload = typeof data === 'string' ? { completion_notes: data } : (data || {});
    const res = await api.post(`/follow-ups/${id}/complete`, payload);
    return res.data;
  },

  cancel: async (id: string, reason?: string): Promise<FollowUpRecord> => {
    const res = await api.post(`/follow-ups/${id}/cancel`, { reason });
    return res.data;
  },

  reschedule: async (id: string, data: RescheduleFollowUpInput): Promise<FollowUpRecord> => {
    const res = await api.post(`/follow-ups/${id}/reschedule`, data);
    return res.data;
  },

  explainAI: async (payload: { follow_up_id?: string; doctor_instructions?: string; purpose?: string }): Promise<AIExplanationOutput> => {
    const res = await api.post('/follow-ups/ai-explain', payload);
    return res.data;
  }
};

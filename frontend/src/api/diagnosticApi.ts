import api from './instance';
import {
  DiagnosticAvailabilityResponse,
  DiagnosticSuggestion,
  FacilityDiagnosticResponse,
  DiagnosticService,
  DiagnosticRecommendation,
  AddDiagnosticServicePayload,
  UpdateDiagnosticServicePayload,
  CreateRecommendationPayload,
} from '../types/diagnostic';

export const diagnosticApi = {
  // ---- Public / Patient ----

  /** Autocomplete search for diagnostic test names. */
  searchDiagnostics: async (query: string, category?: string): Promise<DiagnosticSuggestion[]> => {
    const res = await api.get('/diagnostics/search', { params: { query, category } });
    return res.data.suggestions || [];
  },

  /** Find nearby facilities that provide a specific diagnostic test. */
  checkAvailability: async (params: {
    query: string;
    status?: string;
    category?: string;
    facility_type?: string;
    city?: string;
    user_lat?: number;
    user_lon?: number;
  }): Promise<DiagnosticAvailabilityResponse> => {
    const res = await api.get('/diagnostics/availability', { params });
    return res.data;
  },

  // ---- Patient ----

  /** Patient views their own diagnostic recommendations. */
  getMyRecommendations: async (status?: string): Promise<DiagnosticRecommendation[]> => {
    const res = await api.get('/diagnostics/recommendations', { params: { status } });
    return res.data || [];
  },

  /** Patient or doctor updates a recommendation status. */
  updateRecommendationStatus: async (
    recommendationId: string,
    status: string,
    notes?: string
  ): Promise<{ message: string }> => {
    const res = await api.put(`/diagnostics/recommendations/${recommendationId}/status`, { status, notes });
    return res.data;
  },

  // ---- Doctor ----

  /** Doctor creates a diagnostic recommendation for a patient. */
  createRecommendation: async (
    payload: CreateRecommendationPayload
  ): Promise<{ message: string; recommendation: DiagnosticRecommendation }> => {
    const res = await api.post('/diagnostics/recommendations', payload);
    return res.data;
  },

  /** Doctor views all recommendations they have issued. */
  getDoctorRecommendations: async (status?: string): Promise<DiagnosticRecommendation[]> => {
    const res = await api.get('/diagnostics/recommendations/by-doctor', { params: { status } });
    return res.data || [];
  },

  // ---- Hospital / Facility Staff ----

  /** Hospital admin views their facility's diagnostic services. */
  getFacilityServices: async (params?: {
    search?: string;
    availability?: string;
    category?: string;
  }): Promise<FacilityDiagnosticResponse> => {
    const res = await api.get('/diagnostics/services/facility', { params });
    return res.data;
  },

  /** Hospital admin adds a diagnostic service. */
  addService: async (
    payload: AddDiagnosticServicePayload
  ): Promise<{ message: string; service: DiagnosticService }> => {
    const res = await api.post('/diagnostics/services', payload);
    return res.data;
  },

  /** Hospital admin updates a diagnostic service (availability, hours, etc.). */
  updateService: async (
    serviceId: string,
    payload: UpdateDiagnosticServicePayload
  ): Promise<{ message: string; service: DiagnosticService }> => {
    const res = await api.put(`/diagnostics/services/${serviceId}`, payload);
    return res.data;
  },

  /** Hospital admin removes a diagnostic service from their facility. */
  deleteService: async (serviceId: string): Promise<{ message: string; service_id: string }> => {
    const res = await api.delete(`/diagnostics/services/${serviceId}`);
    return res.data;
  },
};

export default diagnosticApi;

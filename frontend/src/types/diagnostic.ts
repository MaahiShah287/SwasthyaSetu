// Diagnostic service availability status
export type DiagnosticAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';

// Diagnostic recommendation lifecycle
export type RecommendationStatus = 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

// Priority levels for recommendations
export type RecommendationPriority = 'Routine' | 'Urgent' | 'Emergency';

// --- Facility-side service record ---
export interface DiagnosticService {
  service_id: string;
  facility_id: string;
  facility_name?: string;
  service_name: string;
  category: string;
  availability: DiagnosticAvailability;
  appointment_required: boolean;
  operating_hours: string;
  price_inr: string;
  notes: string;
  last_updated: number;
  last_updated_text?: string;
}

// --- Public availability search result ---
export interface DiagnosticFacilityInfo {
  facility_id: string;
  name: string;
  type: string;
  category: string;
  facility_type: string;
  address: string;
  city: string;
  district: string;
  phone: string;
  emergency_phone: string;
  operating_hours: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  directions_url: string;
}

export interface DiagnosticAvailabilityResult {
  service_id: string;
  service_name: string;
  category: string;
  availability: DiagnosticAvailability;
  appointment_required: boolean;
  operating_hours: string;
  price_inr: string;
  notes: string;
  last_updated: number;
  last_updated_text: string;
  distance_km: number;
  facility: DiagnosticFacilityInfo;
}

export interface DiagnosticAvailabilityResponse {
  query: string;
  total_results: number;
  available_count: number;
  limited_count: number;
  unavailable_count: number;
  user_coordinates: { latitude: number; longitude: number };
  results: DiagnosticAvailabilityResult[];
}

// --- Search suggestion ---
export interface DiagnosticSuggestion {
  service_name: string;
  category: string;
  facility_count: number;
}

// --- Doctor → Patient Recommendation ---
export interface DiagnosticRecommendation {
  recommendation_id: string;
  patient_email: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_email: string;
  consultation_id?: string;
  appointment_id?: string;
  service_name: string;
  category: string;
  reason: string;
  priority: RecommendationPriority;
  instructions: string;
  notes: string;
  status: RecommendationStatus;
  status_notes?: string;
  created_at: number;
  updated_at: number;
  created_at_text?: string;
}

// --- Hospital facility service response ---
export interface FacilityDiagnosticResponse {
  facility: { facility_id: string; name: string };
  stats: { total: number; available: number; limited: number; unavailable: number };
  services: DiagnosticService[];
}

// --- API Payload types ---
export interface AddDiagnosticServicePayload {
  service_name: string;
  category?: string;
  availability: DiagnosticAvailability;
  appointment_required: boolean;
  operating_hours?: string;
  price_inr?: string;
  notes?: string;
}

export interface UpdateDiagnosticServicePayload {
  availability?: DiagnosticAvailability;
  appointment_required?: boolean;
  operating_hours?: string;
  price_inr?: string;
  notes?: string;
}

export interface CreateRecommendationPayload {
  patient_email: string;
  service_name: string;
  category?: string;
  reason: string;
  priority: RecommendationPriority;
  instructions?: string;
  notes?: string;
  consultation_id?: string;
  appointment_id?: string;
}

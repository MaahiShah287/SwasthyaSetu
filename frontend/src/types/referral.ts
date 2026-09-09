export interface Facility {
  facility_id: string;
  name: string;
  type: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  emergency_phone: string;
  operating_hours: string;
  is_24x7_emergency: boolean;
  status: 'Operational' | 'Limited Services' | 'Overcrowded' | 'Closed';
  total_beds: number;
  available_beds: number;
  icu_beds_available: number;
  oxygen_beds_available: number;
  services: string[];
  specialists: string[];
  has_lab: boolean;
  has_pharmacy: boolean;
  has_telemedicine: boolean;
  telemedicine_url?: string | null;
  last_updated: number;
}

export interface ScoreBreakdown {
  service_match: number;
  urgency_compatibility: number;
  distance_proximity: number;
  availability: number;
  capability: number;
  stale_data_penalty: number;
}

export interface ScoredFacility {
  facility: Facility;
  distance_km: number;
  total_score: number;
  match_percentage: number;
  rationale: string;
  data_freshness_text: string;
  is_stale: boolean;
  score_breakdown: ScoreBreakdown;
}

export interface ServiceAnalysis {
  primary_required_service: string;
  secondary_services: string[];
  is_telemedicine_suitable: boolean;
  specialty_needed?: string | null;
  clinical_rationale: string;
}

export interface CarePathwayData {
  required_service: string;
  urgency_level: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF-CARE / INFORMATION';
  has_suitable_match: boolean;
  best_match?: ScoredFacility | null;
  second_option?: ScoredFacility | null;
  third_option?: ScoredFacility | null;
  fallback_options: ScoredFacility[];
  no_match_message?: string | null;
  patient_location: {
    lat: number;
    lon: number;
  };
}

export interface ReferralRecommendationResponse {
  triage_summary: string;
  urgency_level: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF-CARE / INFORMATION';
  red_flag_triggered?: boolean;
  service_analysis: ServiceAnalysis;
  care_pathway: CarePathwayData;
  disclaimer: string;
  timestamp: number;
}

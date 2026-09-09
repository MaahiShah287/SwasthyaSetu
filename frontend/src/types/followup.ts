export type FollowUpType = 
  | 'DOCTOR_VISIT'
  | 'TREATMENT_REVIEW'
  | 'REFERRAL'
  | 'LAB_TEST'
  | 'DIAGNOSTIC_REVIEW'
  | 'TELEMEDICINE'
  | 'MEDICATION_REVIEW'
  | 'POST_DISCHARGE'
  | 'ROUTINE_CHECKUP'
  | 'RECOVERY_MONITORING'
  | 'CHRONIC_CARE'
  | 'POST_PROCEDURE'
  | 'GENERAL_FOLLOWUP'
  | 'OTHER';

export type FollowUpStatus = 
  | 'PENDING'
  | 'PENDING_PATIENT'
  | 'CHANGE_REQUESTED'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'DUE_TODAY'
  | 'DUE'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'DECLINED';

export type FollowUpPriority = 
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export interface ChangeRequest {
  requested_date: string;
  requested_time?: string;
  message?: string;
  requested_at: number;
}

export interface FollowUpRecord {
  follow_up_id: string;
  patient_id: string;
  created_by: string;
  created_by_role: string;
  doctor_id?: string;
  doctor_name?: string;
  hospital_id?: string;
  hospital_name?: string;
  appointment_id?: string;
  consultation_id?: string;
  referral_id?: string;
  medical_record_id?: string;
  medical_record_ids?: string[];
  follow_up_type: FollowUpType;
  title: string;
  description?: string;
  purpose?: string;
  doctor_instructions?: string;
  doctor_notes?: string;
  treatment_name?: string;
  recommended_department?: string;
  due_date: string; // YYYY-MM-DD
  due_time?: string; // HH:MM
  status: FollowUpStatus;
  priority: FollowUpPriority;
  change_request?: ChangeRequest;
  reminder_enabled: boolean;
  reminder_days_before: number;
  outcome?: string;
  completed_at?: number;
  completed_by?: string;
  completion_notes?: string;
  days_overdue?: number;
  is_online?: boolean;
  meeting_link?: string;
  created_at: number;
  updated_at: number;
}

export interface FollowUpSummary {
  patient_id: string;
  total: number;
  due_today: number;
  upcoming: number;
  overdue: number;
  completed: number;
  pending_referrals: number;
  pending_reports: number;
  treatment_followups: number;
}

export interface CreateFollowUpInput {
  patient_id?: string;
  doctor_id?: string;
  doctor_name?: string;
  hospital_id?: string;
  hospital_name?: string;
  appointment_id?: string;
  consultation_id?: string;
  referral_id?: string;
  medical_record_id?: string;
  medical_record_ids?: string[];
  follow_up_type: FollowUpType;
  title: string;
  description?: string;
  purpose?: string;
  doctor_instructions?: string;
  doctor_notes?: string;
  treatment_name?: string;
  recommended_department?: string;
  due_date: string;
  due_time?: string;
  priority?: FollowUpPriority;
  is_online?: boolean;
  reminder_enabled?: boolean;
  reminder_days_before?: number;
  auto_confirm?: boolean;
}

export interface UpdateFollowUpInput {
  title?: string;
  description?: string;
  purpose?: string;
  doctor_instructions?: string;
  due_date?: string;
  due_time?: string;
  priority?: FollowUpPriority;
  reminder_enabled?: boolean;
  reminder_days_before?: number;
  medical_record_id?: string;
  medical_record_ids?: string[];
  referral_id?: string;
}

export interface RescheduleFollowUpInput {
  new_due_date: string;
  new_due_time?: string;
  reason?: string;
}

export interface FollowUpChangeRequestInput {
  requested_date: string;
  requested_time?: string;
  message?: string;
}

export interface FollowUpCompleteInput {
  completion_notes?: string;
  outcome?: string;
  doctor_notes?: string;
  treatment_progress?: string;
  referral_required?: boolean;
  create_next_follow_up?: boolean;
}

export interface AIExplanationOutput {
  simplified_explanation: string;
  actionable_steps: string[];
  key_reminders: string[];
  disclaimer: string;
}


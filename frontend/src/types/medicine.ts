export type StockStatus = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface FacilityInfo {
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

export interface MedicineAvailabilityResult {
  inventory_id: string;
  medicine_name: string;
  generic_name: string;
  strength: string;
  form: string;
  category: string;
  quantity: number;
  minimum_stock: number;
  status: StockStatus;
  unit: string;
  batch_number: string;
  expiry_date: string;
  price_inr: string;
  last_updated: number;
  last_updated_text: string;
  last_updated_full: string;
  data_notice: string;
  distance_km: number;
  facility: FacilityInfo;
}

export interface MedicineAvailabilityResponse {
  query: string;
  total_results: number;
  available_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  user_coordinates: {
    latitude: number;
    longitude: number;
  };
  results: MedicineAvailabilityResult[];
}

export interface MedicineSuggestion {
  medicine_name: string;
  generic_name: string;
  strength: string;
  form: string;
  category: string;
}

export interface MedicineInventoryItem {
  inventory_id: string;
  facility_id: string;
  facility_name?: string;
  medicine_name: string;
  generic_name: string;
  strength: string;
  form: string;
  category: string;
  quantity: number;
  minimum_stock: number;
  status: StockStatus;
  batch_number: string;
  expiry_date: string;
  unit: string;
  price_inr: string;
  last_updated: number;
  last_updated_text?: string;
  is_expiring_soon?: boolean;
  days_to_expiry?: number;
}

export interface FacilityInventoryStats {
  total_medicines: number;
  available_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
}

export interface FacilityInventoryResponse {
  facility: {
    facility_id: string;
    name: string;
    admin_email?: string;
  };
  stats: FacilityInventoryStats;
  items: MedicineInventoryItem[];
}

export interface AddMedicinePayload {
  facility_id?: string;
  medicine_name: string;
  generic_name?: string;
  strength: string;
  form: string;
  category?: string;
  quantity: number;
  minimum_stock: number;
  batch_number?: string;
  expiry_date?: string;
  unit?: string;
  price_inr?: string;
}

export interface UpdateQuantityPayload {
  quantity: number;
  adjustment_reason?: string;
}

export interface UpdateMedicinePayload {
  medicine_name?: string;
  generic_name?: string;
  strength?: string;
  form?: string;
  category?: string;
  quantity?: number;
  minimum_stock?: number;
  batch_number?: string;
  expiry_date?: string;
  unit?: string;
  price_inr?: string;
}

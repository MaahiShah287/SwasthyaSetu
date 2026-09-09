import api from './instance';
import {
  MedicineAvailabilityResponse,
  MedicineSuggestion,
  FacilityInventoryResponse,
  MedicineInventoryItem,
  AddMedicinePayload,
  UpdateQuantityPayload,
  UpdateMedicinePayload
} from '../types/medicine';

export const medicineApi = {
  // Patient & Public: Search autocomplete
  searchMedicines: async (query: string, category?: string): Promise<MedicineSuggestion[]> => {
    const res = await api.get('/medicines/search', {
      params: { query, category }
    });
    return res.data.suggestions || [];
  },

  // Patient & Public: Search nearby facility availability
  checkAvailability: async (params: {
    query?: string;
    medicine_name?: string;
    strength?: string;
    status?: string;
    facility_type?: string;
    city?: string;
    user_lat?: number;
    user_lon?: number;
  }): Promise<MedicineAvailabilityResponse> => {
    const res = await api.get('/medicines/availability', { params });
    return res.data;
  },

  // Hospital & Staff: Get facility inventory & stats
  getFacilityInventory: async (
    facilityId: string,
    params?: { search?: string; status?: string; category?: string }
  ): Promise<FacilityInventoryResponse> => {
    const res = await api.get(`/medicines/inventory/facility/${facilityId}`, { params });
    return res.data;
  },

  // Hospital & Staff: Add medicine to inventory
  addMedicine: async (payload: AddMedicinePayload): Promise<MedicineInventoryItem> => {
    const res = await api.post('/medicines/inventory', payload);
    return res.data;
  },

  // Hospital & Staff: Quick quantity update
  updateQuantity: async (
    inventoryId: string,
    quantity: number,
    adjustmentReason?: string
  ): Promise<MedicineInventoryItem> => {
    const res = await api.put(`/medicines/inventory/${inventoryId}/quantity`, {
      quantity,
      adjustment_reason: adjustmentReason || 'Routine stock check'
    });
    return res.data;
  },

  // Hospital & Staff: Full medicine edit
  updateMedicineDetails: async (
    inventoryId: string,
    payload: UpdateMedicinePayload
  ): Promise<MedicineInventoryItem> => {
    const res = await api.put(`/medicines/inventory/${inventoryId}`, payload);
    return res.data;
  },

  // Hospital & Staff: Delete medicine
  deleteMedicine: async (inventoryId: string): Promise<{ message: string; inventory_id: string }> => {
    const res = await api.delete(`/medicines/inventory/${inventoryId}`);
    return res.data;
  },

  // AI Medicine Explanation (strictly clinical mechanism & instructions, no invented stock)
  explainMedicine: async (medicineName: string, strength?: string): Promise<{
    medicine_name: string;
    strength?: string;
    explanation: string;
    disclaimer: string;
  }> => {
    const res = await api.post('/medicines/ai-explain', {
      medicine_name: medicineName,
      strength
    });
    return res.data;
  }
};

export default medicineApi;

export type ItemType = 'flight_segment' | 'hotel_room' | 'transfer' | 'activity' | 'meal_plan' | 'dmc_package' | 'vehicle' | 'train' | 'insurance';

export type SupplierStatus = 'pending' | 'confirmation_requested' | 'on_hold' | 'confirmed' | 'modified' | 'cancelled' | 'completed';

export interface BookingItem {
  id: string;
  booking_id: string;
  item_type: ItemType;
  label: string;
  start_date: string | null;
  end_date: string | null;
  cost_price: number | null;
  sell_price: number | null;
  // "As sold" baseline frozen at booking creation — never edited by ops.
  quoted_cost?: number | null;
  quoted_vendor_name?: string | null;
  supplier_status: SupplierStatus;
  supplier_reference: string | null;
  supplier_confirmed_at: string | null;
  supplier_notes: string | null;
  vendor_name: string | null;
  vendor_email: string | null;
  portal_name: string | null;
  payment_due_date: string | null;
  details: Record<string, unknown>;
  sort_order: number;
  // Vehicle-specific fields
  availability_type?: 'point_to_point' | 'at_disposal' | null;
  daily_start_time?: string | null;
  daily_end_time?: string | null;
  driver_name?: string | null;
  driver_license?: string | null;
  driver_license_valid_until?: string | null;
  driver_insurance_type?: 'basic' | 'premium' | null;
  driver_notes?: string | null;
  itinerary?: Array<{ date: string; time: string; location: string; notes?: string }> | null;
  include_payment_in_voucher?: boolean;
  // Manager approval fields
  manager_approved?: boolean;
  manager_approved_by?: string | null;
  manager_approved_at?: string | null;
  approval_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlightSegmentDetails {
  flight_number?: string;
  airline?: string;
  departure_time?: string;
  arrival_time?: string;
  origin_city?: string;
  origin_iata?: string;
  destination_city?: string;
  destination_iata?: string;
  cabin_class?: string;
  route?: string;
  seat?: string;
  pnr?: string;
}

export interface HotelRoomDetails {
  hotel_name?: string;
  room_type?: string;
  city?: string;
  checkin?: string;
  checkout?: string;
  nights?: number;
  meal_plan?: string;
  rooms_count?: number;
  star_rating?: number;
  conf_number?: string;
}

export interface TransferDetails {
  from_location?: string;
  to_location?: string;
  vehicle_type?: string;
  pickup_time?: string;
  notes?: string;
}

export interface ActivityDetails {
  activity_name?: string;
  date?: string;
  time?: string;
  duration_hours?: number;
  location?: string;
  guide_name?: string;
  activity_ref?: string;
}

export interface MealPlanDetails {
  location?: string;
  meals_included?: string;
  notes?: string;
}

export interface VehicleDetails {
  vehicle_type?: string;
  vehicle_brand?: string;
  registration_number?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  dropoff_date?: string;
  availability_type?: 'point_to_point' | 'at_disposal';
  daily_start_time?: string;
  daily_end_time?: string;
  driver_included?: boolean;
  driver_name?: string;
  driver_license?: string;
  driver_license_valid_until?: string;
  driver_insurance_type?: 'basic' | 'premium';
  itinerary?: Array<{ date: string; time: string; location: string; notes?: string }>;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  flight_segment: 'Flight',
  hotel_room: 'Hotel',
  transfer: 'Transfer',
  activity: 'Activity',
  meal_plan: 'Meal Plan',
  dmc_package: 'DMC Package',
  vehicle: 'Vehicle',
  train: 'Train',
  insurance: 'Insurance',
};

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  pending: 'Pending',
  confirmation_requested: 'Request Sent',
  on_hold: 'On Hold',
  confirmed: 'Confirmed',
  modified: 'Modified',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const SUPPLIER_STATUS_COLORS: Record<SupplierStatus, string> = {
  pending: 'bg-red-100 text-red-700',
  confirmation_requested: 'bg-yellow-100 text-yellow-700',
  on_hold: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-green-100 text-green-700',
  modified: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-700',
  completed: 'bg-blue-100 text-blue-700',
};

/** Valid next statuses for the ops workflow */
export const STATUS_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  pending: ['confirmation_requested', 'on_hold', 'confirmed', 'cancelled'],
  confirmation_requested: ['on_hold', 'confirmed', 'cancelled'],
  on_hold: ['confirmation_requested', 'confirmed', 'cancelled'],
  confirmed: ['modified', 'completed', 'cancelled'],
  modified: ['confirmation_requested', 'confirmed', 'cancelled'],
  cancelled: ['pending'],
  completed: [],
};

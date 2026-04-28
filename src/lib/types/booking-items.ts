export type ItemType = 'flight_segment' | 'hotel_room' | 'transfer' | 'activity' | 'meal_plan';

export type SupplierStatus = 'pending' | 'requested' | 'confirmed' | 'modified' | 'cancelled' | 'completed';

export interface BookingItem {
  id: string;
  booking_id: string;
  item_type: ItemType;
  label: string;
  start_date: string | null;
  end_date: string | null;
  cost_price: number | null;
  sell_price: number | null;
  supplier_status: SupplierStatus;
  supplier_reference: string | null;
  supplier_confirmed_at: string | null;
  supplier_notes: string | null;
  details: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FlightSegmentDetails {
  flight_number?: string;
  airline?: string;
  departure_time?: string;
  arrival_time?: string;
  route?: string;
  seat?: string;
  pnr?: string;
}

export interface HotelRoomDetails {
  hotel_name?: string;
  room_type?: string;
  checkin?: string;
  checkout?: string;
  nights?: number;
  meal_plan?: string;
  rooms_count?: number;
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

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  flight_segment: 'Flight',
  hotel_room: 'Hotel',
  transfer: 'Transfer',
  activity: 'Activity',
  meal_plan: 'Meal Plan',
};

export const SUPPLIER_STATUS_COLORS: Record<SupplierStatus, string> = {
  pending: 'bg-red-100 text-red-700',
  requested: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  modified: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-700',
  completed: 'bg-blue-100 text-blue-700',
};

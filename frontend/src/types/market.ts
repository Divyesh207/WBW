// Mirrors backend/app/models/marketplace.py and marketplace_service.py responses.

export type Role = "manufacturer" | "supplier";
export type Category = "recycled" | "waste_based" | "bio_based" | "low_impact_virgin";
export type Grade = "A" | "B" | "C";
export type Availability = "in_stock" | "limited" | "out_of_stock";
export type RequestStatus = "pending" | "quoted" | "accepted" | "rejected" | "cancelled" | "ordered";
export type OrderStatus = "placed" | "confirmed" | "dispatched" | "delivered" | "cancelled";

export interface User {
  id: number;
  email: string;
  name: string;
  organisation: string;
  role: Role;
  is_demo: boolean;
  supplier_id: number | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LibraryLink {
  material_id: string;
  name: string;
  emission_factor: number;
  embodied_energy: number;
  water: number;
  source_type: string;
}

export interface Listing {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_city: string;
  supplier_is_demo: boolean;
  title: string;
  material_id: string | null;
  category: Category;
  form: string;
  description: string;
  price_per_kg: number;
  currency: string;
  quality_grade: Grade;
  recycled_content_pct: number;
  available_kg: number;
  min_order_kg: number;
  lead_time_days: number;
  location: string;
  availability: Availability;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  library: LibraryLink | null;
  quantity_check?: { quantity_kg: number; total_cost: number; can_supply: boolean; issues: string[] };
}

export interface SupplierProfile {
  id: number;
  user_id: number;
  company_name: string;
  description: string;
  city: string;
  state: string;
  contact_email: string;
  phone: string;
  website: string;
  certifications: string[];
  supplier_type: "recycler" | "waste_producer" | "material_supplier";
  is_demo: boolean;
  active_listings?: number;
  completed_orders?: number;
  listings?: Listing[];
}

export interface ListingDetail extends Listing {
  supplier: SupplierProfile;
}

export interface MaterialRequest {
  id: number;
  manufacturer_id: number;
  manufacturer_name: string;
  manufacturer_organisation: string;
  supplier_id: number;
  supplier_name: string;
  listing_id: number;
  listing_title: string;
  listing_price_per_kg: number | null;
  currency: string;
  quantity_kg: number;
  target_price_per_kg: number | null;
  required_by: string | null;
  message: string;
  status: RequestStatus;
  quoted_price_per_kg: number | null;
  agreed_price_per_kg: number | null;
  estimated_total: number | null;
  supplier_response: string;
  repeat_of_request_id: number | null;
  repeat_of_order_id: number | null;
  assessment_id: number | null;
  order_id: number | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

export interface OrderEvent {
  id: number;
  status: OrderStatus;
  note: string;
  actor_role: Role;
  actor_name: string;
  created_at: string;
}

export interface Order {
  id: number;
  request_id: number;
  manufacturer_id: number;
  manufacturer_name: string;
  manufacturer_organisation: string;
  supplier_id: number;
  supplier_name: string;
  listing_id: number;
  listing_title: string;
  material_id: string | null;
  quantity_kg: number;
  price_per_kg: number;
  currency: string;
  total_amount: number;
  delivery_address: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  events?: OrderEvent[];
  actions?: OrderStatus[];
}

export interface Comparison {
  quantity_kg: number | null;
  listings: Listing[];
  best: Record<"lowest_price" | "highest_quality" | "most_available" | "highest_recycled_content" | "shortest_lead_time" | "lowest_illustrative_carbon", number | null>;
  note: string;
}

export interface MarketMeta {
  categories: Record<Category, string>;
  quality_grades: Record<Grade, string>;
  supplier_types: Record<string, string>;
  order_statuses: OrderStatus[];
  currency: string;
  materials: { id: string; name: string; family: string }[];
}

export interface ManufacturerDashboard {
  role: "manufacturer";
  requests_by_status: Partial<Record<RequestStatus, number>>;
  orders_by_status: Partial<Record<OrderStatus, number>>;
  open_requests: number;
  awaiting_your_action: number;
  open_orders: number;
  committed_spend: number;
  material_ordered_kg: number;
  suppliers_used: number;
  recent_orders: Order[];
  recommended_matches: { material_id: string; name: string; assessments: number; listings: Listing[] }[];
}

export interface SupplierDashboard {
  role: "supplier";
  active_listings: number;
  low_stock: Listing[];
  requests_by_status: Partial<Record<RequestStatus, number>>;
  orders_by_status: Partial<Record<OrderStatus, number>>;
  pending_requests: number;
  open_orders: number;
  delivered_revenue: number;
  pipeline_value: number;
  material_supplied_kg: number;
  recent_requests: MaterialRequest[];
  recent_orders: Order[];
}

export interface ListingInput {
  title: string;
  material_id: string | null;
  category: Category;
  form: string;
  description: string;
  price_per_kg: number;
  quality_grade: Grade;
  recycled_content_pct: number;
  available_kg: number;
  min_order_kg: number;
  lead_time_days: number;
  location: string;
  is_active: boolean;
}

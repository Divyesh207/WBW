import { request } from "./api";
import type {
  AuthResponse,
  Comparison,
  Listing,
  ListingDetail,
  ListingInput,
  ManufacturerDashboard,
  MarketMeta,
  MaterialRequest,
  Order,
  OrderStatus,
  Role,
  SupplierDashboard,
  SupplierProfile,
  User,
} from "../types/market";

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) search.set(k, String(v));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  organisation?: string;
  company_name?: string;
  city?: string;
  state?: string;
  supplier_type?: string;
}

export interface ListingFilters {
  q?: string;
  category?: string;
  material_id?: string;
  min_grade?: string;
  location?: string;
  max_price?: number | null;
  in_stock?: boolean;
  sort?: string;
}

export const authApi = {
  login: (email: string, password: string) => post<AuthResponse>("/auth/login", { email, password }),
  register: (body: RegisterInput) => post<AuthResponse>("/auth/register", body),
  logout: () => post<void>("/auth/logout"),
  me: () => request<User>("/auth/me"),
};

export const marketApi = {
  meta: () => request<MarketMeta>("/market/meta"),
  listings: (filters: ListingFilters = {}) => request<Listing[]>(`/market/listings${qs({ ...filters })}`),
  listing: (id: number | string) => request<ListingDetail>(`/market/listings/${id}`),
  compare: (ids: number[], quantity?: number | null) => request<Comparison>(`/market/listings/compare${qs({ ids: ids.join(","), quantity_kg: quantity })}`),
  supplier: (id: number | string) => request<SupplierProfile>(`/market/suppliers/${id}`),
  dashboard: <T extends ManufacturerDashboard | SupplierDashboard>() => request<T>("/market/dashboard"),

  // supplier self-service
  myProfile: () => request<SupplierProfile>("/market/supplier/profile"),
  updateProfile: (body: Omit<SupplierProfile, "id" | "user_id" | "is_demo" | "active_listings" | "completed_orders" | "listings">) => put<SupplierProfile>("/market/supplier/profile", body),
  myListings: () => request<Listing[]>("/market/supplier/listings"),
  createListing: (body: ListingInput) => post<Listing>("/market/supplier/listings", body),
  updateListing: (id: number, body: ListingInput) => put<Listing>(`/market/supplier/listings/${id}`, body),
  deleteListing: (id: number) => request<{ result: "deleted" | "archived" }>(`/market/supplier/listings/${id}`, { method: "DELETE" }),

  // requests
  requests: (status = "") => request<MaterialRequest[]>(`/market/requests${qs({ status })}`),
  request: (id: number | string) => request<MaterialRequest>(`/market/requests/${id}`),
  sendRequest: (body: { listing_id: number; quantity_kg: number; target_price_per_kg?: number | null; required_by?: string | null; message?: string; assessment_id?: number | null }) =>
    post<MaterialRequest>("/market/requests", body),
  respond: (id: number, body: { action: "accept" | "quote" | "reject"; message?: string; quoted_price_per_kg?: number | null }) => post<MaterialRequest>(`/market/requests/${id}/respond`, body),
  cancelRequest: (id: number) => post<MaterialRequest>(`/market/requests/${id}/cancel`),
  placeOrder: (id: number, delivery_address: string) => post<Order>(`/market/requests/${id}/order`, { delivery_address }),
  repeatRequest: (id: number, quantity_kg?: number | null) => post<MaterialRequest>(`/market/requests/${id}/repeat`, { quantity_kg: quantity_kg || null }),

  // orders
  orders: (status = "") => request<Order[]>(`/market/orders${qs({ status })}`),
  order: (id: number | string) => request<Order>(`/market/orders/${id}`),
  updateOrder: (id: number, status: OrderStatus, note = "") => post<Order>(`/market/orders/${id}/status`, { status, note }),
  repeatOrder: (id: number, quantity_kg?: number | null) => post<MaterialRequest>(`/market/orders/${id}/repeat`, { quantity_kg: quantity_kg || null }),
};

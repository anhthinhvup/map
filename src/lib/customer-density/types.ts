export interface CustomerPoint {
  pointId: string;
  customerContactId: string | null;
  customerCode: string | null;
  customerName: string;
  addressText: string;
  lat: number;
  lng: number;
  source: "customer_contacts" | "order_customer_snapshots";
  districtId?: string | null;
}

export interface DistrictProperties {
  districtId: string;
  districtName: string;
  customerCount: number;
  shareOfHanoi: number; // percentage
  colorBucket: number;  // 0: very low, 1: low, 2: medium, 3: high, 4: very high
}

export interface DistrictSummary {
  districtId: string;
  districtName: string;
  customerCount: number;
  shareOfHanoi: number;
  colorBucket: number;
}

export interface HanoiSummary {
  totalCustomers: number;
  totalDistrictsCount: number;
  totalDistrictsWithCustomers: number;
  topDistrictName: string;
  topDistrictCount: number;
  emptyDistrictsCount: number;
  outsideCustomersCount: number;
}

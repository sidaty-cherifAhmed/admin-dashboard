export interface DashboardSalesByPoint {
  salesPointId: number;
  salesPointName: string;
  zone: string;
  totalQuantity: number;
  totalAmount: number;
}

export interface DashboardSalesByZone {
  zone: string;
  totalQuantity: number;
  totalAmount: number;
}

export type DashboardTopSalesPoint = DashboardSalesByPoint;
export type DashboardTopSalesZone = DashboardSalesByZone;

export type DashboardSalesMetric = 'totalAmount' | 'totalQuantity';

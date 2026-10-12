export interface ShipmentTrackingResult {
 order_id: string;
 order_number: string;
 outcome: 'delivered' | 'in_transit' | 'failed' | 'skipped';
 message: string;
 code?: string;
}

export interface ShipmentTrackingRun {
 id: string;
 site: string;
 source: 'automatic' | 'manual';
 status: 'running' | 'success' | 'partial' | 'failed' | 'empty';
 started_at: string;
 finished_at: string | null;
 checked: number;
 delivered: number;
 in_transit: number;
 failed: number;
 skipped: number;
 message: string | null;
 results?: ShipmentTrackingResult[];
}

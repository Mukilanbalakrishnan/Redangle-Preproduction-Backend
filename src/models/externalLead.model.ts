export interface ExternalLead {
  external_id: number;
  lead_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  event_type?: string;
  event_date?: string;
  priority?: string;
  status?: string;

  invoice_total?: number;
  invoice_paid?: number;
  invoice_balance?: number;
  invoice_data?: any; // To store itemsByCategory and full invoice details from the API
}
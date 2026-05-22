import axios from "axios";
import { serviceAClient } from "../config/axios";
import { insertExternalLead } from "../queries/externalLead.query";

export class LeadSyncError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = "LEAD_SYNC_FAILED") {
    super(message);
    this.name = "LeadSyncError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const syncCompletedLeads = async () => {
  const serviceAUrl = process.env.SERVICE_A_URL;

  if (!serviceAUrl) {
    throw new LeadSyncError(
      "SERVICE_A_URL is not configured",
      500,
      "SERVICE_A_URL_MISSING"
    );
  }

  try {
    const response = await serviceAClient.get(
      "/api/reports/lead-summary"
    );

    const leadsData = response.data?.data || response.data;
    const leads = Array.isArray(leadsData) ? leadsData : [];

    const syncableLeads = leads.filter(
      (lead: any) => lead.isDeleted !== true
    );

    for (const lead of syncableLeads) {
      const invoice = lead.invoiceDetails?.[0] || {};

      await insertExternalLead({
        external_id: lead.leadSerialNumber || String(lead.id),
        lead_serial_number: lead.leadSerialNumber,
        lead_name: lead.leadName,
        email: lead.email,
        phone: lead.phone,
        location: lead.location,
        event_type: lead.eventType,
        event_date: lead.eventDate,
        priority: lead.priority,

        invoice_id: invoice.invoiceId,
        discount: invoice.discount,

        invoice_total: invoice.totalAmount,
        invoice_paid: invoice.paid,
        invoice_balance: invoice.balance,
        
        invoice_data: invoice,

        status: "new"
      });
    }

    return syncableLeads.length;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
        throw new LeadSyncError(
          `Service A is unavailable at ${serviceAUrl}`,
          503,
          "SERVICE_A_UNAVAILABLE"
        );
      }

      if (error.response) {
        throw new LeadSyncError(
          `Service A responded with status ${error.response.status}`,
          502,
          "SERVICE_A_BAD_RESPONSE"
        );
      }

      if (error.request) {
        throw new LeadSyncError(
          `Unable to reach Service A at ${serviceAUrl}`,
          503,
          "SERVICE_A_UNREACHABLE"
        );
      }
    }

    throw error;
  }
};

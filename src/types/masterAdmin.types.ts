export type MasterAdminFlowType = "all" | "pre_wedding" | "post_wedding";
export type MasterAdminPhase = "all" | "pre_production" | "event" | "post_production";

export interface MasterAdminListFilters {
  flowType?: MasterAdminFlowType;
  phase?: MasterAdminPhase;
  status?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface MasterAdminClient {
  id: string;
  serialNumber: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  eventType: string;
  eventDate: string | null;
  flowType: string;
  currentPhase: string;
  phaseStatus: string;
  phaseOwner: string;
  preProductionStep: string;
  assignmentStatus: string;
  assignedTeamSummary: string;
  invoiceId: string;
  invoiceTotal: number;
  invoicePaid: number;
  invoiceBalance: number;
  status: string;
  createdAt: string | null;
}

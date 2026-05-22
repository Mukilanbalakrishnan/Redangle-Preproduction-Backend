import { Request, Response } from "express";
import {
  getMasterAdminAttendance,
  getMasterAdminClient,
  getMasterAdminClientEmployees,
  getMasterAdminClientReport,
  getMasterAdminClients,
  getMasterAdminDashboard,
  getMasterAdminEmployees,
  getMasterAdminInvoices,
  getMasterAdminReports,
  getMasterAdminWorkTracker,
} from "../services/masterAdmin.service";

const filtersFromRequest = (req: Request) => ({
  flowType: req.query.flowType as any,
  phase: req.query.phase as any,
  status: req.query.status as string | undefined,
  fromDate: req.query.fromDate as string | undefined,
  toDate: req.query.toDate as string | undefined,
  search: req.query.search as string | undefined,
});

const sendData = (res: Response, data: unknown) => res.json({ success: true, data });
const paramValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : String(value || "");

const handle = async (res: Response, action: () => Promise<unknown>) => {
  try {
    const data = await action();
    if (!res.headersSent) sendData(res, data);
  } catch (error: any) {
    console.error("MASTER ADMIN ERROR:", error);
    res.status(500).json({ success: false, message: error.message || "Master Admin request failed" });
  }
};

export const masterAdminDashboard = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminDashboard());

export const masterAdminClients = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminClients(filtersFromRequest(req)));

export const masterAdminClient = (req: Request, res: Response) =>
  handle(res, async () => {
    const client = await getMasterAdminClient(paramValue(req.params.clientId));
    if (!client) {
      res.status(404).json({ success: false, message: "Client not found" });
      return undefined;
    }
    return client;
  });

export const masterAdminEmployees = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminEmployees(filtersFromRequest(req)));

export const masterAdminWorkTracker = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminWorkTracker(filtersFromRequest(req)));

export const masterAdminInvoices = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminInvoices(filtersFromRequest(req)));

export const masterAdminAttendance = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminAttendance(filtersFromRequest(req)));

export const masterAdminReports = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminReports(filtersFromRequest(req)));

export const masterAdminClientEmployees = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminClientEmployees(paramValue(req.params.clientId)));

export const masterAdminClientWorkTracker = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminWorkTracker({}, paramValue(req.params.clientId)));

export const masterAdminClientInvoice = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminInvoices({}, paramValue(req.params.clientId)));

export const masterAdminClientAttendance = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminAttendance({}, paramValue(req.params.clientId)));

export const masterAdminClientReport = (req: Request, res: Response) =>
  handle(res, () => getMasterAdminClientReport(paramValue(req.params.clientId)));

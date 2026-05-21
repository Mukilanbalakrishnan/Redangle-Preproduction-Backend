import {
  createLeaveTablesQuery,
  createLeaveRequestQuery,
  getLeaveRequestsByEmployeeQuery,
  getAllLeaveRequestsQuery,
  updateLeaveStatusQuery
} from "../queries/leave.query";
import { CreateLeaveRequestDTO, UpdateLeaveStatusDTO } from "../types/leave.types";

// Ensure tables exist on startup (simple migration)
createLeaveTablesQuery().catch(console.error);

export const createLeaveRequestService = async (data: CreateLeaveRequestDTO) => {
  return await createLeaveRequestQuery(data);
};

export const getLeaveRequestsByEmployeeService = async (employee_id: string) => {
  return await getLeaveRequestsByEmployeeQuery(employee_id);
};

export const getAllLeaveRequestsService = async (viewer_role?: string) => {
  return await getAllLeaveRequestsQuery(viewer_role);
};

export const updateLeaveStatusService = async (id: number, data: UpdateLeaveStatusDTO) => {
  return await updateLeaveStatusQuery(id, data);
};

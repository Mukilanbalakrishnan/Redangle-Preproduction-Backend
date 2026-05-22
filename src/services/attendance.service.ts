import {
  clockInQuery,
  clockOutQuery,
  getAttendanceQuery,
  createTablesQuery
} from "../queries/attendance.query";
import { ClockInDTO, ClockOutDTO } from "../types/attendance.types";

// Ensure tables exist on startup (simple migration)
createTablesQuery().catch(console.error);

export const clockInService = async (data: ClockInDTO) => {
  return await clockInQuery(data);
};

export const clockOutService = async (data: ClockOutDTO) => {
  return await clockOutQuery(data);
};

export const getAttendanceService = async (employee_id: string) => {
  return await getAttendanceQuery(employee_id);
};

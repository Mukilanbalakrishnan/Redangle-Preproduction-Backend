import { Request, Response } from "express"
import {
  createEmployeeService,
  getEmployeesService,
  updateEmployeeService,
  deleteEmployeeService
} from "../services/employee.service"
import {
  getEmployeeDashboardQuery,
  getAssignedProjectsQuery,
  getMyWorkQuery,
  getAttendanceQuery,
  getLeaveRequestsQuery,
  createLeaveRequestQuery,
  getTodayAttendanceQuery,
  punchInQuery,
  punchOutQuery,
} from "../queries/employee.queries"

export const createEmployeeController = async (
  req: Request,
  res: Response
) => {
  try {

    const body: any = req.body

    const files = req.files as any

    const profileImage =
      files?.profile_image?.[0]?.filename || null

    const identityDocument =
      files?.identity_document?.[0]?.filename || null

    const data = await createEmployeeService({
      employee_id: body.employee_id,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      contact_number: body.contact_number,
      dob: body.dob,
      address: body.address,
      work_location: body.work_location,
      role: body.role || (body.roles ? JSON.parse(body.roles).join(', ') : ''),
      roles: body.roles ? JSON.parse(body.roles) : undefined,
      experience: body.experience,
      date_of_join: body.date_of_join,
      description: body.description,
      created_by: body.created_by,
      profile_image: profileImage,
      identity_document: identityDocument,
      password: body.password
    })

    res.status(201).json({
      success: true,
      data
    })
    console.log("BODY:", req.body)
    console.log("FILES:", req.files)

  } catch (error: any) {

    console.error("CREATE EMPLOYEE ERROR:", error)

    res.status(500).json({
      success: false,
      message: error.message
    })

  }
}



export const getEmployeesController = async (req: Request, res: Response) => {
  try {

    const data = await getEmployeesService()

    res.json({
      success: true,
      data
    })

  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message
    })

  }
}


export const updateEmployeeController = async (req: Request, res: Response) => {
  try {

    const id = req.params.id as string

    const updateBody = { ...req.body }
    if (updateBody.roles && typeof updateBody.roles === 'string') {
      try {
        updateBody.roles = JSON.parse(updateBody.roles)
      } catch (e) { }
    }

    const data = await updateEmployeeService(id, updateBody)

    res.json({
      success: true,
      data
    })

  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message
    })

  }
}


export const deleteEmployeeController = async (req: Request, res: Response) => {
  try {

    const id = req.params.id as string

    await deleteEmployeeService(id)

    res.json({
      success: true,
      message: "Employee deleted"
    })

  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message
    })

  }
}

// ================= DASHBOARD CONTROLLERS =================

export const getEmployeeDashboard = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await getEmployeeDashboardQuery(employeeId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("GET EMPLOYEE DASHBOARD ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAssignedProjects = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await getAssignedProjectsQuery(employeeId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("GET ASSIGNED PROJECTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyWork = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await getMyWorkQuery(employeeId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("GET MY WORK ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAttendance = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await getAttendanceQuery(employeeId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("GET ATTENDANCE ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLeaveRequests = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await getLeaveRequestsQuery(employeeId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("GET LEAVE REQUESTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitLeaveRequest = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const { leaveType, fromDate, toDate, reason } = req.body;
    const data = await createLeaveRequestQuery(employeeId, leaveType, fromDate, toDate, reason);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    console.error("SUBMIT LEAVE REQUEST ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTodayAttendance = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await getTodayAttendanceQuery(employeeId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("GET TODAY ATTENDANCE ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const punchIn = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await punchInQuery(employeeId);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    console.error("PUNCH IN ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const punchOut = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;
    const data = await punchOutQuery(employeeId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("PUNCH OUT ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

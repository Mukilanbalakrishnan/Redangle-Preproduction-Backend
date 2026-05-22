import { Request, Response } from "express"
import { getEmployeeDashboardService } from "../services/employeeDashboard.service"

export const getEmployeeDashboardController = async (
  req: Request,
  res: Response
) => {

  try {

    const employeeId = req.params.employeeId as string

    const dashboardData = await getEmployeeDashboardService(employeeId)

    res.json({
      success: true,
      data: dashboardData
    })

  } catch (error) {

    console.error("Employee dashboard error:", error)

    res.status(500).json({
      success: false,
      message: "Failed to load dashboard"
    })
  }

}
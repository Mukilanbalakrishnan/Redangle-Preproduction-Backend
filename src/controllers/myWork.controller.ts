import { Request, Response } from "express"
import { getMyWorkService } from "../services/myWork.service"

export const getMyWork = async (req: Request, res: Response) => {
  try {

    const employeeId = Number(req.params.employeeId)

    const data = await getMyWorkService(employeeId)

    res.json({
      success: true,
      data
    })

  } catch (error) {

    console.error(error)

    res.status(500).json({
      success: false,
      message: "Failed to load work items"
    })
  }
}
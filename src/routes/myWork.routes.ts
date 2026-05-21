import { Router } from "express"
import { getMyWork } from "../controllers/myWork.controller"

const router = Router()

router.get(
  "/employee/:employeeId/my-work",
  getMyWork
)

export default router
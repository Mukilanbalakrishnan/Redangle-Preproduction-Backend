import { Router } from "express"
import multer from "multer"

import {
  getEmployeesController,
  createEmployeeController,
  updateEmployeeController,
  deleteEmployeeController
} from "../controllers/employee.controller"

import { acceptAssignment } from "../controllers/assignment.controller"

const router = Router()

/* multer config */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname)
  }
})

const upload = multer({ storage })

router.get("/employees", getEmployeesController)

/* IMPORTANT CHANGE */
router.post(
  "/employees",
  upload.fields([
    { name: "profile_image", maxCount: 1 },
    { name: "identity_document", maxCount: 1 }
  ]),
  createEmployeeController
)

router.put("/employees/:id", updateEmployeeController)

router.delete("/employees/:id", deleteEmployeeController)




router.post("/assignment/accept", acceptAssignment)
export default router
import { Router } from "express";
import {
  getUserRoles,
  addUserRole,
  removeUserRole,
  setUserRoles,
} from "../controllers/userRoles.controller";

const router = Router();

router.get("/users/:id/roles", getUserRoles);
router.post("/users/:id/roles", addUserRole);
router.delete("/users/:id/roles", removeUserRole);
router.put("/users/:id/roles", setUserRoles);

export default router;

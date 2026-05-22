import { Request, Response } from "express";
import {
  getUserRolesQuery,
  addRoleToUserQuery,
  removeRoleFromUserQuery,
  setUserRolesQuery,
} from "../queries/userRoles.query";

export const getUserRoles = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await getUserRolesQuery(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: { id: user.id, roles: user.roles } });
  } catch (error) {
    console.error("Get user roles error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const addUserRole = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const { role } = req.body;

    if (isNaN(userId) || !role) {
      return res.status(400).json({ success: false, message: "User ID and role are required" });
    }

    const user = await addRoleToUserQuery(userId, role);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found or role already assigned" });
    }

    return res.json({ success: true, message: "Role added", data: { id: user.id, roles: user.roles } });
  } catch (error) {
    console.error("Add user role error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const removeUserRole = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const { role } = req.body;

    if (isNaN(userId) || !role) {
      return res.status(400).json({ success: false, message: "User ID and role are required" });
    }

    const user = await removeRoleFromUserQuery(userId, role);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: "Role removed", data: { id: user.id, roles: user.roles } });
  } catch (error) {
    console.error("Remove user role error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const setUserRoles = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const { roles } = req.body;

    if (isNaN(userId) || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ success: false, message: "User ID and non-empty roles array are required" });
    }

    const user = await setUserRolesQuery(userId, roles);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: "Roles updated", data: { id: user.id, roles: user.roles } });
  } catch (error) {
    console.error("Set user roles error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

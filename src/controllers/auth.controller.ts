import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";

const JWT_SECRET = process.env.JWT_SECRET || "redangle_jwt_secret_2025";
const JWT_EXPIRES_IN = "8h";

const normalizeRole = (role: unknown): string => {
    const key = String(role || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-");

    const aliases: Record<string, string> = {
        "crm": "crm",
        "preproduction-crm": "pre-production-crm",
        "pre-production-crm": "pre-production-crm",
        "pre-production-crm-admin": "pre-production-crm",
        "pre-production-crm-manager": "pre-production-crm",
        "postproduction-crm": "post-production-crm",
        "post-production-crm": "post-production-crm",
        "post-production-crm-admin": "post-production-crm",
        "post-production-crm-manager": "post-production-crm",
        "event-crm": "post-production-crm",
        "event-crm-admin": "post-production-crm",
        "event-crm-manager": "post-production-crm",
        "master-admin": "master-admin",
        "masteradmin": "master-admin",
        "admin": "admin",
        "event-coordinator": "event-coordinator",
        "photographer": "photographer",
        "videographer": "videographer",
        "drone": "drone",
        "data-management": "data-manager",
        "data-manager": "data-manager",
        "operational-manager": "operational-manager",
        "traditional-video-editor": "traditional-video-editor",
        "traditional-photo-editor": "retouch-editor",
        "retouch-editor": "retouch-editor",
        "album-designer": "album-designer",
        "candid-video-editor": "candid-video-editor",
        "save-the-date-post": "employee-1",
        "save-the-date-video": "employee-2",
        "outdoor-retouch": "employee-4",
        "retouch-photo": "employee-4",
        "employee-1": "employee-1",
        "employee-2": "employee-2",
        "employee-4": "employee-4",
        "client": "client",
    };

    return aliases[key] || key;
};

const normalizeRoles = (roles: unknown[], fallbackRole: unknown): string[] => {
    const rawRoles = roles && roles.length > 0 ? roles : [fallbackRole];
    return Array.from(new Set(rawRoles.map(normalizeRole).filter(Boolean)));
};

const splitCrmPriority = ["master-admin", "pre-production-crm", "post-production-crm"];

const resolveRedirectPath = (userRoles: string[], fallbackRole: unknown, roleRouteMap: Record<string, string>) => {
    const splitCrmRole = splitCrmPriority.find(role => userRoles.includes(role));
    if (splitCrmRole) {
        return roleRouteMap[splitCrmRole];
    }

    const mediaRoleSet = new Set(["photographer", "videographer", "drone"]);
    const allMediaRoles = userRoles.length > 0 && userRoles.every(r => mediaRoleSet.has(r));

    if (userRoles.length > 1 && !allMediaRoles) return "/multi-role";
    if (allMediaRoles) return "/media";
    return roleRouteMap[userRoles[0]] || roleRouteMap[normalizeRole(fallbackRole)] || "/crm";
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Find user in the database
        const result = await pool.query(
            `SELECT id, name, email, password_hash, role, roles, is_active FROM users WHERE email = $1 LIMIT 1`,
            [email.toLowerCase().trim()]
        );

        console.log(`[AUTH DEBUG] Login attempt for: ${email.toLowerCase().trim()}`);
        console.log(`[AUTH DEBUG] DB Found users: ${result.rows.length}`);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact admin.",
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        console.log(`[AUTH DEBUG] isPasswordValid: ${isPasswordValid}`);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const roleRouteMap: Record<string, string> = {
            crm: "/crm",
            "pre-production-crm": "/pre-production-crm",
            "post-production-crm": "/post-production-crm",
            "master-admin": "/master-admin",
            admin: "/admin",
            "event-coordinator": "/event-coordinator",
            photographer: "/media",
            videographer: "/media",
            "employee-1": "/employee",
            "employee-2": "/employee",
            "employee-4": "/employee",
            "data-manager": "/data-manager",
            "drone": "/media",
            "operational-manager": "/operational-manager",
            "traditional-video-editor": "/employee",
            "retouch-editor": "/employee",
            "album-designer": "/employee",
            "candid-video-editor": "/employee",
            client: "/client",
        };

        // Look up employee_id and profile_image from employees table
        let empId: string | null = null;
        let profileImage: string | null = null;
        let employeeRoles: string[] | null = null;
        try {
            const empResult = await pool.query(
                `SELECT employee_id, first_name, last_name, role, roles, profile_image, identity_document FROM employees WHERE LOWER(email) = $1 LIMIT 1`,
                [user.email.toLowerCase()]
            );
            if (empResult.rows.length > 0) {
                empId = empResult.rows[0].employee_id;
                profileImage = empResult.rows[0].profile_image || null;
                employeeRoles = empResult.rows[0].roles && empResult.rows[0].roles.length > 0
                    ? empResult.rows[0].roles
                    : [empResult.rows[0].role].filter(Boolean);
            }
        } catch (e) {
            // employees table might not have this user
        }

        // Compute roles array (employee admin edits are stored in employees first)
        const sourceRoles = employeeRoles && employeeRoles.length > 0 ? employeeRoles : user.roles;
        const userRoles = normalizeRoles(sourceRoles, user.role);
        const redirectPath = resolveRedirectPath(userRoles, user.role, roleRouteMap);

        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: normalizeRole(user.role), roles: userRoles },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: normalizeRole(user.role),
                    roles: userRoles,
                    employee_id: empId,
                    profile_image: profileImage,
                    redirectPath,
                },
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: String(error)
        });
    }
};

export const registerUser = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password, and role are required",
            });
        }

        // Check if email already exists
        const existing = await pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [email.toLowerCase().trim()]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert user
        const newUser = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, roles, is_active, created_at)
       VALUES ($1, $2, $3, $4, ARRAY[$5::varchar], true, NOW())
       RETURNING id, name, email, role, roles`,
            [name, email.toLowerCase().trim(), passwordHash, role, role]
        );

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: newUser.rows[0],
        });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const verifyToken = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        const result = await pool.query(
            `SELECT id, name, email, role, roles, is_active FROM users WHERE id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            return res.status(401).json({ success: false, message: "Invalid or expired session" });
        }

        const roleRouteMap: Record<string, string> = {
            crm: "/crm",
            "pre-production-crm": "/pre-production-crm",
            "post-production-crm": "/post-production-crm",
            "master-admin": "/master-admin",
            admin: "/admin",
            "event-coordinator": "/event-coordinator",
            photographer: "/media",
            videographer: "/media",
            "employee-1": "/employee",
            "employee-2": "/employee",
            "employee-4": "/employee",
            "data-manager": "/data-manager",
            "drone": "/media",
            "operational-manager": "/operational-manager",
            "traditional-video-editor": "/employee",
            "retouch-editor": "/employee",
            "album-designer": "/employee",
            "candid-video-editor": "/employee",
            client: "/client",
        };

        const user = result.rows[0];

        // Look up employee_id, profile image, and employee-managed roles
        let empId: string | null = null;
        let profileImageVT: string | null = null;
        let employeeRoles: string[] | null = null;
        try {
            const empResult = await pool.query(
                `SELECT employee_id, role, roles, profile_image FROM employees WHERE LOWER(email) = $1 LIMIT 1`,
                [user.email.toLowerCase()]
            );
            if (empResult.rows.length > 0) {
                empId = empResult.rows[0].employee_id;
                profileImageVT = empResult.rows[0].profile_image || null;
                employeeRoles = empResult.rows[0].roles && empResult.rows[0].roles.length > 0
                    ? empResult.rows[0].roles
                    : [empResult.rows[0].role].filter(Boolean);
            }
        } catch (e) {
            // employees table might not have this user
        }

        const sourceRoles = employeeRoles && employeeRoles.length > 0 ? employeeRoles : user.roles;
        const userRoles = normalizeRoles(sourceRoles, user.role);
        const redirectPath = resolveRedirectPath(userRoles, user.role, roleRouteMap);

        return res.json({
            success: true,
            data: { ...user, role: normalizeRole(user.role), roles: userRoles, employee_id: empId, profile_image: profileImageVT, redirectPath },
        });
    } catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};

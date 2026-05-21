import express from "express";
import path from "path";

import cors from "cors";
import dashboardRoutes from "./src/routes/dashboard.routes";
import { startLeadSyncJob } from "./src/scheduler/leadSync.scheduler";
import emailRoutes from "./src/routes/email.routes";
import eventDetails from "./src/routes/eventDetails.routes";
import creativeConfirmationRoutes
  from "./src/routes/creativeConfirmation.routes";
import stageRoutes
  from "./src/routes/stageTracking.routes";
import creativePlanningRoutes
  from "./src/routes/creativePlanning.routes";
import assignTeamRoutes from "./src/routes/assignTeam.route";
import employeeRoutes from "./src/routes/employee.route";
import authRoutes from "./src/routes/auth.routes";
import attendanceRoutes from "./src/routes/attendance.routes";
import leaveRoutes from "./src/routes/leave.routes";
import projectRoutes from "./src/routes/project.routes";
import eventCoordinatorRoutes from "./src/routes/eventCoordinator.routes";
import workTrackingRoutes from "./src/routes/workTracking.route";
import externalLeadRoutes from "./src/routes/externalLead.routes";

import employeeDashboardRoutes from "./src/routes/employee.routes";
import notificationRoutes from "./src/routes/notification.routes";
import crmRoutes from "./src/routes/crm.routes";
import dataManagerRoutes from "./src/routes/dataManager.routes";
import pixofficeRoutes from "./src/routes/pixoffice.routes";
import adminRoutes from "./src/routes/admin.routes";
import userRolesRoutes from "./src/routes/userRoles.routes";
import masterAdminRoutes from "./src/routes/masterAdmin.routes";
import { ensurePasswordResetTable } from "./src/queries/passwordReset.query";

// Load environment variables
import dotenv from "dotenv";
const result = dotenv.config();
console.log("ENV LOAD RESULT:", result);

const app = express();

// ================= MIDDLEWARE =================

// Enable CORS
app.use(
  cors({
    origin: "*", // change to frontend URL in production
  })
);

// Parse JSON body
app.use(express.json());

// Parse URL encoded data
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (profile images, etc.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= ROUTES =================

// Health check route
app.get("/", (req, res) => {
  res.send("Project B Backend Running 🚀");
});

// Lead summary route (from Project A)
app.use("/api", dashboardRoutes);
app.use("/api", emailRoutes);
app.use("/api/event-details", eventDetails);
app.use("/api", creativeConfirmationRoutes);
app.use("/api", stageRoutes);
app.use("/api", creativePlanningRoutes);
app.use("/api", assignTeamRoutes);
app.use("/api", employeeRoutes);
app.use("/api", workTrackingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", leaveRoutes);
app.use("/api", projectRoutes);
app.use("/api/event-coordinator", eventCoordinatorRoutes);
app.use("/api", employeeDashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", crmRoutes);
app.use("/api/data-manager", dataManagerRoutes);
app.use("/api/externalLeads", externalLeadRoutes);
app.use("/api/pixoffice", pixofficeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", userRolesRoutes);
app.use("/api/master-admin", masterAdminRoutes);


// ================= ERROR HANDLER =================

app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global err:", err.stack);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: err.stack
  });
});

// ================= SERVER START =================

const PORT = process.env.PORT || 5001;

app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  startLeadSyncJob();
  await ensurePasswordResetTable();
  console.log("✅ Password reset OTP table ready");
});

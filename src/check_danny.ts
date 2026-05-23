import { pool } from './config/db';

async function run() {
  try {
    const employeesRes = await pool.query(
      `SELECT employee_id, first_name, last_name, email FROM employees`
    );
    console.log("EMPLOYEES:", employeesRes.rows);

    const usersRes = await pool.query(
      `SELECT * FROM users`
    );
    console.log("USERS:", usersRes.rows);

    // Let's run getEmployeeDashboardQuery for 'EMP-14' and 14
    const { getEmployeeDashboardQuery, getMyWorkQuery, getAssignedProjectsQuery } = require('./queries/employee.queries');
    
    console.log("--- TESTING DASHBOARD FOR EMP-14 ---");
    const dashboardEmp14 = await getEmployeeDashboardQuery('EMP-14');
    console.log("DASHBOARD (EMP-14):", JSON.stringify(dashboardEmp14, null, 2));

    console.log("--- TESTING DASHBOARD FOR 14 ---");
    const dashboard14 = await getEmployeeDashboardQuery(14);
    console.log("DASHBOARD (14):", JSON.stringify(dashboard14, null, 2));

    console.log("--- TESTING MY WORK FOR EMP-14 ---");
    const workEmp14 = await getMyWorkQuery('EMP-14');
    console.log("MY WORK (EMP-14):", workEmp14);

    console.log("--- TESTING MY WORK FOR 14 ---");
    const work14 = await getMyWorkQuery(14);
    console.log("MY WORK (14):", work14);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

run();

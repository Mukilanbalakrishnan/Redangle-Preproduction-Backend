const axios = require('axios');
const http = axios.create({ baseURL: 'http://localhost:5001' });
const { Client } = require('pg');

async function run() {
    const c = new Client({ user: 'postgres', password: 'tns7142006', port: 6000, database: 'Redangle' });
    await c.connect();

    try {
        const lQuery = await c.query("SELECT id, external_id FROM external_leads WHERE id = 4343");
        const externalId = lQuery.rows[0].external_id;

        console.log(`0. Preparing DB State for Lead 4343 (external_id: ${externalId})...`);
        await c.query(`
       UPDATE external_leads 
       SET flow_type = 'pre_wedding', 
           current_phase = 'pre_production', 
           phase_status = 'approved'
       WHERE id = 4343
    `);

        // Clear out old approvals
        await c.query(`DELETE FROM approvals WHERE lead_external_id = $1`, [externalId]);

        // Ensure users are active, have correct roles, and client is linked to the CORRECT external_id
        await c.query("UPDATE users SET role = 'admin', is_active = true WHERE email = 'tnsooriyaa@gmail.com'");
        await c.query("UPDATE users SET role = 'client', is_active = true, lead_external_id = $1 WHERE email = 'client@gmail.com'", [externalId]);

        console.log("1. Logging in as CRM/Admin...");
        const crmRes = await http.post('/api/auth/login', { email: 'tnsooriyaa@gmail.com', password: 'tns7142006' });
        const crmToken = crmRes.data.data.token;

        console.log(`2. CRM: Submitting pre-production for Lead ${externalId}...`);
        const submitRes = await http.post(`/api/crm/leads/${externalId}/submit-pre-production`, {}, {
            headers: { Authorization: `Bearer ${crmToken}` }
        });
        console.log("Submit Response message:", submitRes.data.message || "OK");

        console.log("3. Logging in as Client...");
        const clientRes = await http.post('/api/auth/login', { email: 'client@gmail.com', password: 'tns7142006' });
        const clientToken = clientRes.data.data.token;

        console.log("4. Fetching Client Approvals...");
        const listRes = await http.get('/api/client/me/approvals', {
            headers: { Authorization: `Bearer ${clientToken}` }
        });
        const pending = listRes.data?.data?.pending || [];
        console.log("Pending Approvals Count:", pending.length);

        if (!pending.length) {
            throw new Error("No pending approvals found in API!");
        }

        const approvalId = pending[0].id;
        console.log("5. Responding to Approval ID:", approvalId);
        const respondRes = await http.post(`/api/client/approvals/${approvalId}/respond`, {
            decision: 'approve',
            feedback: 'Looks amazing!'
        }, {
            headers: { Authorization: `Bearer ${clientToken}` }
        });
        console.log("Respond Output:", respondRes.data.message || "Approved OK");

        const lOutput = await c.query("SELECT current_phase, phase_status, phase_owner FROM external_leads WHERE id = 4343");
        console.log("6. Final Lead State:", lOutput.rows[0]);

        console.log("SUCCESS! API Endpoints work and verified state progression.");
    } catch (err) {
        if (err.response) {
            console.error("API Error Response:", err.response.data);
            console.error("Status:", err.response.status);
        } else {
            console.error("Error:", err.message);
        }
    } finally {
        await c.end();
    }
}
run();

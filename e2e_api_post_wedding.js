const axios = require('axios');
const http = axios.create({ baseURL: 'http://localhost:5001' });
const { Client } = require('pg');

async function run() {
    const c = new Client({ user: 'postgres', password: 'tns7142006', port: 6000, database: 'Redangle' });
    await c.connect();

    try {
        const lQuery = await c.query("SELECT id, external_id FROM external_leads WHERE id = 4343");
        const externalId = lQuery.rows[0].external_id;

        console.log(`0. Preparing DB State for Post-Wedding Lead 4343 (external_id: ${externalId})...`);
        await c.query(`
       UPDATE external_leads 
       SET flow_type = 'post_wedding', 
           current_phase = 'event', 
           phase_status = 'approved'
       WHERE id = 4343
    `);

        // Clear out old approvals
        await c.query(`DELETE FROM approvals WHERE lead_external_id = $1`, [externalId]);

        // Ensure we have users prepared for roles
        await c.query("UPDATE users SET role = 'admin', is_active = true WHERE email = 'tnsooriyaa@gmail.com'");
        await c.query("UPDATE users SET role = 'client', is_active = true, lead_external_id = $1 WHERE email = 'client@gmail.com'", [externalId]);
        await c.query("INSERT INTO users (name, email, password_hash, role, roles, is_active, created_at) VALUES ('EC User', 'ec@gmail.com', (SELECT password_hash FROM users WHERE email='client@gmail.com'), 'event-coordinator', ARRAY['event-coordinator'], true, NOW()) ON CONFLICT DO NOTHING");
        await c.query("UPDATE users SET role = 'event-coordinator', is_active = true WHERE email='ec@gmail.com'");

        console.log("1. Logging in as Event Coordinator...");
        const ecRes = await http.post('/api/auth/login', { email: 'ec@gmail.com', password: 'tns7142006' });
        const ecToken = ecRes.data.data.token;

        console.log(`2. EC: Submitting event package for Lead ${externalId}...`);
        const submitRes = await http.post(`/api/event-coordinator/leads/${externalId}/submit-event-package`, {}, {
            headers: { Authorization: `Bearer ${ecToken}` }
        });
        console.log("EC Submit OK");

        console.log("3. Logging in as CRM...");
        const crmRes = await http.post('/api/auth/login', { email: 'tnsooriyaa@gmail.com', password: 'tns7142006' });
        const crmToken = crmRes.data.data.token;

        console.log("4. CRM: Fetching pending EC approvals...");
        const crmListRes = await http.get('/api/crm/approvals?status=ec_submitted', {
            headers: { Authorization: `Bearer ${crmToken}` }
        });
        const crmPending = crmListRes.data.data || [];
        console.log("CRM Pending Approvals Count:", crmPending.length);
        if (!crmPending.length) throw new Error("No pending EC approvals found!");
        const approvalId = crmPending[0].id;

        console.log("5. CRM: Approving Approval ID:", approvalId);
        await http.post(`/api/crm/approvals/${approvalId}/approve`, {}, {
            headers: { Authorization: `Bearer ${crmToken}` }
        });

        console.log("6. Logging in as Client...");
        const clientRes = await http.post('/api/auth/login', { email: 'client@gmail.com', password: 'tns7142006' });
        const clientToken = clientRes.data.data.token;

        console.log("7. Client: Fetching approvals...");
        const clientListRes = await http.get('/api/client/me/approvals', {
            headers: { Authorization: `Bearer ${clientToken}` }
        });
        const clientPending = clientListRes.data.data.pending || [];
        console.log("Client Pending Count:", clientPending.length);
        if (!clientPending.length) throw new Error("No pending client approvals found!");

        console.log("8. Client: Responding to Approval ID:", clientPending[0].id);
        await http.post(`/api/client/approvals/${clientPending[0].id}/respond`, { decision: 'approve' }, {
            headers: { Authorization: `Bearer ${clientToken}` }
        });

        const lOutput = await c.query("SELECT current_phase, phase_status, phase_owner FROM external_leads WHERE id = 4343");
        console.log("9. Final Lead State:");
        console.log(lOutput.rows[0]);
        if (lOutput.rows[0].current_phase !== 'pre_production') {
            throw new Error("Phase did not correctly advance to 'pre_production'!");
        }

        console.log("SUCCESS! Post-wedding API Endpoints work and verified state progression.");
    } catch (err) {
        if (err.response) {
            console.error("API Error Response:", err.response.data);
        } else {
            console.error("Error:", err.message);
        }
    } finally {
        await c.end();
    }
}
run();

const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    password: 'tns7142006',
    host: 'localhost',
    port: 6000,
    database: 'Redangle',
});

const leads = [
    {
        external_id: 'SEED-001',
        lead_serial_number: 'SEED-001',
        lead_name: 'Priya Ramesh',
        email: 'priya.ramesh@example.com',
        phone: '9876543210',
        location: 'Chennai',
        event_type: 'Wedding',
        event_date: '2026-11-15',
        priority: 'high',
        invoice_id: null,
        discount: 0,
        invoice_total: 0,
        invoice_paid: 0,
        invoice_balance: 0,
        invoice_data: null,
        status: 'new',
    },
    {
        external_id: 'SEED-002',
        lead_serial_number: 'SEED-002',
        lead_name: 'Arjun Mehta',
        email: 'arjun.mehta@example.com',
        phone: '9123456780',
        location: 'Coimbatore',
        event_type: 'Pre-Wedding',
        event_date: '2026-10-05',
        priority: 'medium',
        invoice_id: null,
        discount: 0,
        invoice_total: 0,
        invoice_paid: 0,
        invoice_balance: 0,
        invoice_data: null,
        status: 'new',
    },
    {
        external_id: 'SEED-003',
        lead_serial_number: 'SEED-003',
        lead_name: 'Kavitha Suresh',
        email: 'kavitha.suresh@example.com',
        phone: '9000112233',
        location: 'Madurai',
        event_type: 'Birthday',
        event_date: '2026-08-20',
        priority: 'low',
        invoice_id: null,
        discount: 0,
        invoice_total: 0,
        invoice_paid: 0,
        invoice_balance: 0,
        invoice_data: null,
        status: 'new',
    },
];

async function run() {
    await client.connect();

    for (const lead of leads) {
        const query = `
      INSERT INTO external_leads
        (external_id, lead_serial_number, lead_name, email, phone, location, event_type, event_date, priority,
         invoice_id, discount, invoice_total, invoice_paid, invoice_balance, invoice_data, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (external_id) DO UPDATE SET
        lead_serial_number = EXCLUDED.lead_serial_number,
        lead_name = EXCLUDED.lead_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        location = EXCLUDED.location,
        event_type = EXCLUDED.event_type,
        event_date = EXCLUDED.event_date,
        priority = EXCLUDED.priority,
        invoice_id = EXCLUDED.invoice_id,
        discount = EXCLUDED.discount,
        invoice_total = EXCLUDED.invoice_total,
        invoice_paid = EXCLUDED.invoice_paid,
        invoice_balance = EXCLUDED.invoice_balance,
        invoice_data = EXCLUDED.invoice_data,
        status = EXCLUDED.status
      RETURNING external_id, lead_name, email, status
    `;

        const values = [
            lead.external_id, lead.lead_serial_number, lead.lead_name, lead.email,
            lead.phone, lead.location, lead.event_type, lead.event_date, lead.priority,
            lead.invoice_id, lead.discount, lead.invoice_total, lead.invoice_paid,
            lead.invoice_balance, lead.invoice_data, lead.status,
        ];

        const result = await client.query(query, values);
        const row = result.rows[0];
        console.log(`✅ Inserted/Updated: [${row.external_id}] ${row.lead_name} (${row.email}) — status: ${row.status}`);
    }

    await client.end();
    console.log('\nDone — 3 leads seeded, no employee assigned.');
}

run().catch(console.error);

const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    password: 'tns7142006',
    host: 'localhost',
    port: 6000,
    database: 'Redangle',
});

const newLeads = [
    {
        external_id: 'LD-ALPHA',
        lead_name: 'Alpha',
        email: 'alpha@example.com',
        phone: '9000000001',
        location: 'Chennai',
        event_type: 'Wedding',
        event_date: '2026-12-01',
        priority: 'medium',
    },
    {
        external_id: 'LD-BETA',
        lead_name: 'Beta',
        email: 'beta@example.com',
        phone: '9000000002',
        location: 'Coimbatore',
        event_type: 'Reception',
        event_date: '2026-12-05',
        priority: 'medium',
    },
    {
        external_id: 'LD-GAMMA',
        lead_name: 'Gamma',
        email: 'gamma@example.com',
        phone: '9000000003',
        location: 'Madurai',
        event_type: 'Engagement',
        event_date: '2026-12-10',
        priority: 'medium',
    },
    {
        external_id: 'LD-DELTA',
        lead_name: 'Delta',
        email: 'delta@example.com',
        phone: '9000000004',
        location: 'Trichy',
        event_type: 'Birthday',
        event_date: '2026-12-15',
        priority: 'medium',
    },
    {
        external_id: 'LD-EPSILON',
        lead_name: 'Epsilon',
        email: 'epsilon@example.com',
        phone: '9000000005',
        location: 'Salem',
        event_type: 'Pre-Wedding',
        event_date: '2026-12-20',
        priority: 'medium',
    },
];

async function run() {
    await client.connect();

    const dependents = await client.query(`
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name IN ('external_lead_id') AND table_schema = 'public'
  `);

    console.log('Dependent tables found:', dependents.rows.map(r => r.table_name));

    await client.query('BEGIN');
    try {
        for (const r of dependents.rows) {
            console.log(`Clearing ${r.table_name} ...`);
            await client.query(`DELETE FROM ${r.table_name}`);
        }

        console.log('Clearing external_leads ...');
        await client.query('DELETE FROM external_leads');

        for (const lead of newLeads) {
            const q = `
        INSERT INTO external_leads
          (external_id, lead_serial_number, lead_name, email, phone, location,
           event_type, event_date, priority,
           invoice_id, discount, invoice_total, invoice_paid, invoice_balance, invoice_data,
           status, flow_type)
        VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,NULL,0,0,0,0,NULL,'new',NULL)
        RETURNING external_id, lead_name, flow_type
      `;
            const v = [
                lead.external_id, lead.lead_name, lead.email, lead.phone,
                lead.location, lead.event_type, lead.event_date, lead.priority,
            ];
            const res = await client.query(q, v);
            const row = res.rows[0];
            console.log(`✅ Inserted [${row.external_id}] ${row.lead_name} — flow_type: ${row.flow_type}`);
        }

        await client.query('COMMIT');
        console.log('\nDone — leads wiped and 5 new leads seeded with no flow_type assigned.');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        await client.end();
    }
}

run().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});

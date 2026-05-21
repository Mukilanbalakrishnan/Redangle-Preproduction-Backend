const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: 'tns7142006',
  host: 'localhost',
  port: 6000,
  database: 'Redangle',
});

const TARGETS = ['9104', '9105'];

async function findReferencingTables(c) {
  // Tables whose FK points at external_leads (any column).
  const r = await c.query(`
    SELECT
      tc.table_name      AS child_table,
      kcu.column_name    AS child_column,
      ccu.column_name    AS parent_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema    = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'external_leads'
      AND tc.table_schema = 'public';
  `);
  return r.rows;
}

async function run() {
  await client.connect();
  console.log('Connected. Targeting lead codes:', TARGETS);

  await client.query('BEGIN');
  try {
    // 1. Resolve actual external_leads rows
    const leadRows = await client.query(
      `SELECT external_id, lead_serial_number, lead_name, id
         FROM external_leads
        WHERE external_id::text = ANY($1)
           OR lead_serial_number = ANY($1)
           OR id::text = ANY($1)`,
      [TARGETS]
    );

    if (leadRows.rowCount === 0) {
      console.log('No matching leads found in external_leads. Aborting.');
      await client.query('ROLLBACK');
      return;
    }

    console.log('Found leads:');
    console.table(leadRows.rows);

    const externalIdsText = [
      ...new Set(
        leadRows.rows.flatMap(r => [
          r.external_id != null ? String(r.external_id) : null,
          r.lead_serial_number != null ? String(r.lead_serial_number) : null,
        ]).filter(Boolean)
      ),
    ];
    const internalIds = leadRows.rows.map(r => r.id).filter(v => v != null);
    const names = leadRows.rows.map(r => r.lead_name).filter(Boolean);

    console.log('External id keys:', externalIdsText);
    console.log('Internal ids:', internalIds);

    // 2. Discover every FK pointing to external_leads
    const fks = await findReferencingTables(client);
    console.log('FK references to external_leads:');
    console.table(fks);

    // 3. Delete from each child table using the appropriate value set
    for (const fk of fks) {
      const { child_table, child_column, parent_column } = fk;
      let values;
      if (parent_column === 'id') values = internalIds;
      else values = externalIdsText; // external_id, lead_serial_number, etc.

      if (!values.length) continue;

      const r = await client.query(
        `DELETE FROM "${child_table}" WHERE "${child_column}"::text = ANY($1::text[]) RETURNING *`,
        [values.map(String)]
      );
      console.log(`Deleted ${r.rowCount} row(s) from ${child_table} (${child_column} -> external_leads.${parent_column})`);
    }

    // 4. Best-effort: leads_detail (no FK, match on name)
    if (names.length) {
      const ld = await client.query(
        `SELECT to_regclass('public.leads_detail') AS t`
      );
      if (ld.rows[0].t) {
        const r = await client.query(
          `DELETE FROM leads_detail WHERE lead_name = ANY($1) RETURNING lead_id, lead_name`,
          [names]
        );
        console.log(`Deleted ${r.rowCount} row(s) from leads_detail`);
      }
    }

    // 5. Finally, the leads themselves
    const del = await client.query(
      `DELETE FROM external_leads
        WHERE external_id::text = ANY($1)
           OR lead_serial_number = ANY($1)
           OR id::text = ANY($1)
        RETURNING external_id, lead_name`,
      [TARGETS]
    );
    console.log(`Deleted ${del.rowCount} row(s) from external_leads:`);
    console.table(del.rows);

    await client.query('COMMIT');
    console.log('✅ Commit successful.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Rolled back due to error:', e.message);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();

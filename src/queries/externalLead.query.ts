import { pool } from "../config/db";

export const insertExternalLead = async (lead: any) => {

  const query = `
    INSERT INTO external_leads
    (external_id, lead_serial_number, lead_name, email, phone, location, event_type, event_date, priority, invoice_id, discount, invoice_total, invoice_paid, invoice_balance, invoice_data, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (external_id)
    DO UPDATE SET
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
  `;

  await pool.query(query, [
    lead.external_id,
    lead.lead_serial_number,
    lead.lead_name,
    lead.email,
    lead.phone,
    lead.location,
    lead.event_type,
    lead.event_date,
    lead.priority,
    lead.invoice_id,
    lead.discount,
    lead.invoice_total,
    lead.invoice_paid,
    lead.invoice_balance,
    lead.invoice_data,
    lead.status,
  ]);
};

export const getDashboardLeads = async () => {
  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT DISTINCT ON (COALESCE(lead_serial_number, external_id::text)) *
        FROM external_leads
        ORDER BY COALESCE(lead_serial_number, external_id::text), created_at DESC, id DESC
      ) e
      ORDER BY created_at DESC, id DESC
    `
  );



  return result.rows;


};

export const updateLeadStatusQuery = async (
  externalLeadId: string | number,
  status: string
): Promise<void> => {

  const query = `
    UPDATE external_leads
    SET status = $1,
        updated_at = NOW()
    WHERE external_id = $2 OR lead_serial_number = $2
  `;

  await pool.query(query, [status, String(externalLeadId)]);
};

export const getLeadById = async (id: string | number) => {
  const result = await pool.query(
    `SELECT * FROM external_leads WHERE external_id = $1 OR lead_serial_number = $1`,
    [String(id)]
  );
  return result.rows[0];
};

export const updateExternalLead = async (id: number, lead: any) => {
  let mappedStatus = lead.status;
  if (lead.status === 'New') mappedStatus = 'new';
  if (lead.status === 'In progress') mappedStatus = 'pending';
  if (lead.status === 'Completed') mappedStatus = 'completed';

  const query = `
    UPDATE external_leads
    SET lead_name = $1, email = $2, phone = $3, location = $4, event_type = $5, status = $6, updated_at = NOW()
    WHERE external_id = $7
    RETURNING *;
  `;
  const result = await pool.query(query, [
    lead.name || lead.lead_name,
    lead.email,
    lead.phone || lead.contact,
    lead.location,
    lead.type || lead.shootType || lead.event_type,
    mappedStatus,
    id
  ]);
  return result.rows[0];
};

export const deleteExternalLead = async (id: number) => {
  const query = `DELETE FROM external_leads WHERE external_id = $1`;
  await pool.query(query, [id]);
};

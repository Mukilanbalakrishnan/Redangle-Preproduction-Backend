import { pool } from "../config/db";

export const createPixofficeTableQuery = async () => {
    const query = `
      CREATE TABLE IF NOT EXISTS pixoffice_entries (
        id SERIAL PRIMARY KEY,
        external_lead_id INT,
        event_name VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        services JSONB,
        file_size VARCHAR(50),
        storage_path VARCHAR(255),
        qc_status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(query);
};

export const insertPixofficeEntryQuery = async (data: any) => {
    // Make sure table exists
    await createPixofficeTableQuery();

    const query = `
      INSERT INTO pixoffice_entries (
        external_lead_id, event_name, sub_category, services, file_size, storage_path, qc_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
        data.external_lead_id,
        data.event_name,
        data.sub_category,
        JSON.stringify(data.services),
        data.file_size,
        data.storage_path,
        'Pending'
    ];
    
    // Auto update event_details to reflect status change to Pixoffice
    const updateEventQuery = `
      UPDATE event_details 
      SET media_status = 'QC_Pending_Pixoffice', updated_at = NOW()
      WHERE external_lead_id = $1
    `;
    await pool.query(updateEventQuery, [data.external_lead_id]);

    const result = await pool.query(query, values);
    return result.rows[0];
};

export const getPixofficeStatsQuery = async () => {
    // Make sure table exists before querying stats
    await createPixofficeTableQuery();

    const pendingQuery = `SELECT COUNT(*) as cnt FROM pixoffice_entries WHERE qc_status = 'Pending'`;
    const completedQuery = `SELECT COUNT(*) as cnt FROM pixoffice_entries WHERE qc_status != 'Pending'`;

    const pendingResult = await pool.query(pendingQuery);
    const completedResult = await pool.query(completedQuery);

    return {
        pending: parseInt(pendingResult.rows[0].cnt, 10),
        completed: parseInt(completedResult.rows[0].cnt, 10)
    };
};

export const updatePixofficeStatusQuery = async (leadId: number | string, status: string) => {
    // Make sure table exists
    await createPixofficeTableQuery();

    const query = `
      UPDATE pixoffice_entries 
      SET qc_status = $2
      WHERE external_lead_id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [leadId, status]);
    return result.rows[0];
};

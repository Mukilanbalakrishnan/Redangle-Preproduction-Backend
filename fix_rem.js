const { Client } = require('pg');
const c = new Client({ user:'postgres', password:'tns7142006', host:'localhost', port:6000, database:'Redangle' });

(async () => {
  await c.connect();
  await c.query(`
    UPDATE event_details
    SET save_the_date_drive_link = NULL,
        save_the_date_upload_notes = NULL,
        save_the_date_submission_status = NULL,
        save_the_video_drive_link = NULL,
        save_the_video_upload_notes = NULL,
        save_the_video_submission_status = NULL,
        retouch_drive_link = NULL,
        retouch_upload_notes = NULL,
        retouch_submission_status = NULL,
        updated_at = NOW()
    WHERE external_lead_id = 'SEED-REM-001'
  `);
  console.log('Cleared stale Phase 2 links for Rem');
  await c.end();
})();

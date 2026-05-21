export const insertPhotoUploadQuery = `
INSERT INTO photo_upload (
  external_lead_id,
  client_name,
  event_type,
  drive_link,
  camera_used,
  num_images,
  upload_notes,
  uploaded_by
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
RETURNING *;
`

export const getPhotoUploadByLeadQuery = `
SELECT 
    drive_link,
    camera_used,
    num_images,
    upload_notes
FROM photo_upload
WHERE external_lead_id = $1
ORDER BY uploaded_at DESC
LIMIT 1;
`
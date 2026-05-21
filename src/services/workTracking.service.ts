import { getWorkTrackingQuery, normalizeWorkTrackingPhase, updateWorkTrackingQuery, deleteWorkTrackingQuery } from "../queries/workTracking.query"

export const getWorkTrackingService = async (phase?: string) => {

  const rows = await getWorkTrackingQuery(normalizeWorkTrackingPhase(phase))

  const formatted = rows.map((item: any) => ({
    id: item.id,
    external_lead_id: item.external_lead_id,
    client_name: item.client_name,
    event_type: item.event_type,
    event_date: item.event_date,
    flow_type: item.flow_type,
    current_phase: item.current_phase,
    phase_status: item.phase_status,
    phase_owner: item.phase_owner,
    pre_production_step: item.pre_production_step,
    event_status: item.event_status,
    media_status: item.media_status,
    drive_link: item.drive_link,
    video_drive_link: item.video_drive_link,
    drone_photo_drive_link: item.drone_photo_drive_link,
    drone_video_drive_link: item.drone_video_drive_link,
    save_the_date_drive_link: item.save_the_date_drive_link,
    save_the_date_submission_status: item.save_the_date_submission_status,
    save_the_video_drive_link: item.save_the_video_drive_link,
    save_the_video_submission_status: item.save_the_video_submission_status,
    retouch_drive_link: item.retouch_drive_link,
    retouch_submission_status: item.retouch_submission_status,

    completed_stages: item.completed_stages || [],

    assigned_team: (item.assigned_team || []).filter((emp: any) => emp.name),
    project_statuses: (item.project_statuses || []).filter((project: any) => project.project_type)
  }))

  return formatted
}

export const updateWorkTrackingService = async (id: number, data: any) => {
  return await updateWorkTrackingQuery(id, data);
}

export const deleteWorkTrackingService = async (id: number) => {
  return await deleteWorkTrackingQuery(id);
}

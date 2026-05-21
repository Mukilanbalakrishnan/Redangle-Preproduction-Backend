import { UpdateStageDTO }
from "../types/stageTracking.types";

import { updateCurrentStageQuery,getStagesByLeadQuery }
from "../queries/stageTracking.query";

export const updateCurrentStageService = async (
  external_lead_id: number | string,
  stage_name: string
) => {
  return await updateCurrentStageQuery(
    external_lead_id,
    stage_name
  );
};

export const getStagesByLeadService = async (
  externalLeadId: number | string
) => {

  return await getStagesByLeadQuery(externalLeadId);

};

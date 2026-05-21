import {
  CreateCreativePlanningDTO
} from "../types/creativePlanning.types";

import {
  upsertCreativePlanningQuery,
  getCreativePlanningQuery
} from "../queries/creativePlanning.query";

export const saveCreativePlanningService = async (
  data: CreateCreativePlanningDTO
) => {

  const planning =
    await upsertCreativePlanningQuery(data);

  return planning;
};


export const getCreativePlanningService = async (
  external_lead_id: number | string
) => {

  const planning =
    await getCreativePlanningQuery(external_lead_id);

  return planning;
};

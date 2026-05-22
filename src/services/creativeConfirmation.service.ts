import { CreateCreativeConfirmationDTO } 
from "../types/creativeConfirmation.types";

import { upsertCreativeConfirmationQuery, getCreativeConfirmationService as getCreativeConfirmationQuery }
from "../queries/creativeConfirmation.query";

export const saveCreativeConfirmationService = async (
  data: CreateCreativeConfirmationDTO
) => {
  // save confirmation
  const confirmation = await upsertCreativeConfirmationQuery(data);
  return confirmation;
};

export const getCreativeConfirmationService = async (
  external_lead_id: number | string
) => {
  const confirmation = await getCreativeConfirmationQuery(external_lead_id);
  return confirmation;
}

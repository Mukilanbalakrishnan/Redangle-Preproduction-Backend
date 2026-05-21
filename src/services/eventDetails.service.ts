import { CreateEventDetailsDTO }
  from "../types/eventDetails.types";
import { createEventDetailsQuery, getEventDetailsByLeadIdQuery }
  from "../queries/eventDetails.query";
import { updateLeadStatusQuery }
  from "../queries/externalLead.query";

export const createEventDetailsService = async (
  data: CreateEventDetailsDTO
) => {

  // 1️⃣ store event details
  const event = await createEventDetailsQuery(data);

  // 2️⃣ update lead workflow status
  await updateLeadStatusQuery(
    data.external_lead_id,
    "contacted"
  );

  return event;
};

export const getEventDetailsByLeadIdService = async (
  externalLeadId: string
) => {
  return getEventDetailsByLeadIdQuery(externalLeadId);
};
import { Request, Response } from "express";
import { updateCurrentStageService,getStagesByLeadService }
from "../services/stageTracking.service";

export const updateCurrentStageController = async (
  req: Request,
  res: Response
) => {
  try {

    const { external_lead_id, stage_name } = req.body;

    const result = await updateCurrentStageService(
      external_lead_id,
      stage_name
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const getStagesByLeadController = async (
  req: Request,
  res: Response
) => {
  try {

    const leadId = String(req.params.leadId);

    const result =
      await getStagesByLeadService(leadId);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
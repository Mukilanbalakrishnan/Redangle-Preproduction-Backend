import { Request, Response } from "express";

import {
  saveCreativePlanningService,
  getCreativePlanningService
} from "../services/creativePlanning.service";


export const saveCreativePlanningController = async (
  req: Request,
  res: Response
) => {
  try {

    const body: any = req.body;

    if (typeof body.equipment_required === "string") {
      body.equipment_required = JSON.parse(body.equipment_required);
    }

    if (typeof body.lighting_setup === "string") {
      body.lighting_setup = JSON.parse(body.lighting_setup);
    }

    if (typeof body.props_required === "string") {
      body.props_required = JSON.parse(body.props_required);
    }

    const data =
      await saveCreativePlanningService(body);

    res.status(201).json({
      success: true,
      data
    });

  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};



export const getCreativePlanningController = async (
  req: Request,
  res: Response
) => {
  try {

    const { external_lead_id } = req.params;

    const data =
      await getCreativePlanningService(
        String(external_lead_id)
      );

    res.json({
      success: true,
      data
    });

  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
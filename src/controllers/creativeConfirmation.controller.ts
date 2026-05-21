import { Request, Response } from "express";
import {
  saveCreativeConfirmationService,
  getCreativeConfirmationService
} from "../services/creativeConfirmation.service";

export const saveCreativeConfirmationController = async (
  req: Request,
  res: Response
) => {
  try {

    console.log("CREATIVE BODY:", req.body);
    console.log("CREATIVE FILES:", req.files);

    const body: any = req.body;

    // convert string -> array
    body.color_preferences = JSON.parse(body.color_preferences);

    // get previously uploaded images that were kept
    const existingImages = body.existing_reference_images ? JSON.parse(body.existing_reference_images) : [];

    // get uploaded images
    const files = req.files as Express.Multer.File[];
    const newImages = files?.map((file) => file.filename) || [];

    // Merge both arrays so old ones are not lost
    body.reference_images = [...existingImages, ...newImages];

    const data =
      await saveCreativeConfirmationService(body);

    res.status(201).json({
      success: true,
      data
    });

  } catch (error: any) {

    console.error("CREATIVE ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

export const getCreativeConfirmationController = async (
  req: Request,
  res: Response
) => {
  try {

    const { external_lead_id } = req.params;

    const data = await getCreativeConfirmationService(
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
import { Request, Response } from "express"
import { getWorkTrackingService, updateWorkTrackingService, deleteWorkTrackingService } from "../services/workTracking.service"

export const getWorkTrackingController = async (
  req: Request,
  res: Response
) => {

  try {

    const data = await getWorkTrackingService(req.query.phase as string | undefined)

    res.status(200).json({
      success: true,
      data
    })

  } catch (error) {

    console.error("Work tracking fetch failed", error)

    res.status(500).json({
      success: false,
      message: "Failed to fetch work tracking"
    })

  }
}

export const updateWorkTrackingController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = Number(req.params.id);
    const updated = await updateWorkTrackingService(id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Update failed" });
  }
};

export const deleteWorkTrackingController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = Number(req.params.id);
    await deleteWorkTrackingService(id);
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Delete failed" });
  }
};

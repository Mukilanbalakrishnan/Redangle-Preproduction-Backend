import { Request, Response } from "express";
import { sendEmailService } from "../services/email.service";

export const sendEmail = async (req: Request, res: Response) => {
  try {
    await sendEmailService(req);

    res.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Email sending failed",
    });
  }
};
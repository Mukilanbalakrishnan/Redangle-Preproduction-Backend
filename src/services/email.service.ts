import nodemailer from "nodemailer";
import { Request } from "express";

export const sendEmailService = async (req: Request) => {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const files = (req.files as Express.Multer.File[]) || [];

  await transporter.sendMail({
    from: `"Red Angle" <${process.env.EMAIL_USER}>`,
    to: JSON.parse(req.body.to),
    cc: req.body.cc || undefined,
    bcc: req.body.bcc || undefined,
    subject: req.body.subject,
    html: req.body.body.replace(/\n/g, "<br/>"),

    // ✅ attachments
    attachments: files.map(file => ({
      filename: file.originalname,
      content: file.buffer,
    })),
  });
};
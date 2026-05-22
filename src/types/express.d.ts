import "express";

declare global {
  namespace Express {
    interface Request {
      files?: Multer.File[];
      file?: Multer.File;
    }
  }
}
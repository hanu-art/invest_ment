import express from "express";
import { createKYC  , getKYC} from "../controller/kyc.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import upload from "../config/multer.config.js";

const router = express.Router();

// POST KYC with Aadhaar & PAN images
router.post("/post", verifyToken, upload.fields([
  { name: 'aadhaar_image', maxCount: 1 },
  { name: 'pancard_image', maxCount: 1 }
]), createKYC);

// GET KYC by user ID
router.get("/get", verifyToken, getKYC);

export default router;
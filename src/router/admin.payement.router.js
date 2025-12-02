import express from "express";
import { createPaymentMethod, getAllPaymentMethods, updatePaymentMethod } from "../controller/admin.payemnt.qr.js";

const router = express.Router();

router.post("/create", createPaymentMethod);
router.get("/all", getAllPaymentMethods);
router.put("/update/:id", updatePaymentMethod);

export default router;
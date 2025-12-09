// routes/stockRoutes.js
import express from "express";
import { 
  addStock,           // POST
  getMyStocks,        // GET all
  getStockById,       // GET single
  updateStock,        // PUT
  deleteStock         // DELETE
} from "../controller/stock.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/adminRole.middleware.js";

const router = express.Router();

// CRUD Routes
router.post("/create",adminOnly, verifyToken, addStock);           // Create
router.get("/get", verifyToken, getMyStocks);         // Read all
router.get("/get:id",adminOnly , verifyToken, getStockById);     // Read single
router.put("/put:id",adminOnly , verifyToken, updateStock);      // Update
router.delete("/delete/:id",adminOnly , verifyToken, deleteStock);   // Delete

export default router;
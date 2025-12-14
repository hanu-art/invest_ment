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

// CRUD Routes with file upload support
router.post("/create", adminOnly, verifyToken, (req, res, next) => {
  // Using the multer middleware from the controller
  addStock(req, res, next);
});

router.get("/get", verifyToken, getMyStocks);         // Read all
router.get("/get/:id", adminOnly, verifyToken, getStockById);     // Read single

// Update route with file upload support
router.put("/update/:id", adminOnly, verifyToken, (req, res, next) => {
  updateStock(req, res, next);
});

router.delete("/delete/:id", adminOnly, verifyToken, deleteStock);   // Delete

export default router;
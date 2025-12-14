import express from "express";
import { 
  addStock,           // POST
     // GET single
  updateStock,        // PUT
// DELETE
deleteStock  ,

getUserStocks
} from "../controller/stock.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/adminRole.middleware.js";

const router = express.Router();

// CRUD Routes with file upload support
 
router.post("/addstock" , addStock)

// Update route with file upload support
router.put("/update/:id", updateStock);


router.delete("/delete/:id", deleteStock);

router.get("getstock", getUserStocks);


export default router;
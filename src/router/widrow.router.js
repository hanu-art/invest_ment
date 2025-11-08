import express from "express"; 
import { requestWithdrawal } from "../controller/widrow.conroller.js";
import { getPendingWithdrawals } from "../controller/widrow.conroller.js";
import { processWithdrawal } from "../controller/widrow.conroller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/adminRole.middleware.js";

const router = express.Router()  



router.post("/widrowrequest" , verifyToken , requestWithdrawal) 
router.get("/pendingwidrow" , verifyToken , adminOnly , getPendingWithdrawals)
router.put("/processwidrowal" , verifyToken , adminOnly ,processWithdrawal)

export default router
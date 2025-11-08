
import { sendError } from "../utils/errorHandler.js";
import { sendSuccess } from "../utils/responseHandler.js";
import pool from "../config/database.config.js";

export const uploadPayment = async (req, res) => {
    try {
        // Check if file uploaded
        if (!req.file) {
            return sendError(res, 400, 'Please upload payment screenshot');
        }

        const { amount, transaction_id, payment_method = 'upi' } = req.body;
        const userId = req.user.id;

        // Validation
        if (!amount) {
            return sendError(res, 400, 'Amount is required');
        }

        // Database insert
        const [result] = await pool.execute(
            `INSERT INTO payment_screenshots 
             (user_id, screenshot_url, original_filename, amount, transaction_id, payment_method) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, req.file.path, req.file.originalname, amount, transaction_id, payment_method]
        );

        sendSuccess(res, {
            paymentId: result.insertId,
            status: 'pending'
        }, 'Payment uploaded successfully');

    } catch (error) {
        console.error('Upload error:', error);
        sendError(res, 500, 'Error uploading payment');
    }
}; 




// controllers/adminController.js mein add karo

// Get pending payments
export const getPendingPayments = async (req, res) => {
    try {
        const [payments] = await pool.execute(`
            SELECT ps.*, u.name as user_name, u.email 
            FROM payment_screenshots ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.status = 'pending'
            ORDER BY ps.created_at DESC    
        `);

        console.log(`Found ${payments.length} pending payments`);
        
        sendSuccess(res, payments, 'Pending payments retrieved');
    } catch (error) {
        console.error('Error fetching payments:', error);
        sendError(res, 500, 'Error fetching payments');
    }
};



// Verify payment
export const verifyPayment = async (req, res) => {
    try {
        const { paymentId, remarks = '' } = req.body;
        const adminId = req.user.id;

        // 1. Payment verify
        const [result] = await pool.execute(
            `UPDATE payment_screenshots 
             SET status = 'verified', verified_by = ?, verification_remarks = ?, verified_at = NOW()
             WHERE id = ? AND status = 'pending'`,
            [adminId, remarks, paymentId]
        );

        if (result.affectedRows === 0) {
            return sendError(res, 400, 'Payment not found');
        }

        // 2. Get payment details
        const [payments] = await pool.execute(
            `SELECT user_id, amount FROM payment_screenshots WHERE id = ?`,
            [paymentId]
        );
        const payment = payments[0];

        // 3. Update user balance
        await pool.execute(
            `UPDATE users 
             SET total_balance = total_balance + ?, total_coins = total_coins + ?
             WHERE id = ?`,
            [payment.amount, payment.amount, payment.user_id]
        );

        sendSuccess(res, { 
            paymentId, 
            amount: payment.amount 
        }, 'Payment verified and balance updated');

    } catch (error) {
        console.error('Verify error:', error);
        sendError(res, 500, 'Error verifying payment');
    }
}; 



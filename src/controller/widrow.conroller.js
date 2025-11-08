import pool from "../config/database.config.js";
import { sendError } from "../utils/errorHandler.js";
import { sendSuccess } from "../utils/responseHandler.js"; 





export const requestWithdrawal = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;

        console.log(` User ${userId} withdrawal request: ₹${amount}`);

        // Validation
        if (!amount || amount <= 0) {
            return sendError(res, 400, 'Valid amount required');
        }

        // Check user balance
        const [users] = await pool.execute(
            'SELECT total_balance, bank_account_number, bank_name, ifsc_code FROM users WHERE id = ?',
            [userId]
        );
        const user = users[0];

        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        if (user.total_balance < amount) {
            return sendError(res, 400, 'Insufficient balance');
        }

       

        // Create withdrawal request
        const [result] = await pool.execute(
            `INSERT INTO withdrawal_requests 
             (user_id, amount) 
             VALUES (?, ?)`,
            [userId, amount]
        );

        console.log(` Withdrawal request created: ${result.insertId}`);

        sendSuccess(res, {
            withdrawalId: result.insertId,
            amount: amount,
            status: 'pending'
        }, 'Withdrawal request submitted successfully');

    } catch (error) {
        console.error('Withdrawal request error:', error);
        sendError(res, 500, 'Error submitting withdrawal request');
    }
};   



export const getPendingWithdrawals = async (req, res) => {
    try {
        console.log(' Fetching pending withdrawals...');
        
        const [withdrawals] = await pool.execute(`
            SELECT 
                wr.id, wr.amount, wr.bank_account_number, 
                wr.bank_name, wr.ifsc_code, wr.created_at,
                u.id as user_id, u.name as user_name, u.email, u.phone,
                u.total_balance
            FROM withdrawal_requests wr
            JOIN users u ON wr.user_id = u.id
            WHERE wr.status = 'pending'
            ORDER BY wr.created_at DESC
        `);

        console.log(` Found ${withdrawals.length} pending withdrawals`);
        
        sendSuccess(res, withdrawals, 'Pending withdrawals retrieved successfully');

    } catch (error) {
        console.error('Error fetching pending withdrawals:', error);
        sendError(res, 500, 'Error fetching pending withdrawals');
    }
};  




// controllers/adminController.js

// PROCESS WITHDRAWAL (DIRECT APPROVE)
export const processWithdrawal = async (req, res) => {
    try {
        const { withdrawalId, remarks = '' } = req.body; //  STATUS REMOVE
        const adminId = req.user.id;

        console.log(`Admin ${adminId} approving withdrawal ${withdrawalId}`);

        // 1. Withdrawal details get karo (pehle hi)
        const [withdrawals] = await pool.execute(
            `SELECT user_id, amount FROM withdrawal_requests WHERE id = ? AND status = 'pending'`,
            [withdrawalId]
        );

        if (withdrawals.length === 0) {
            return sendError(res, 400, 'Withdrawal not found or already processed');
        }
        const withdrawal = withdrawals[0];

        // 2. Check user balance
        const [users] = await pool.execute(
            'SELECT total_balance FROM users WHERE id = ?',
            [withdrawal.user_id]
        );
        const user = users[0];

       
      //  STRING TO NUMBER CONVERSION
        const userBalance = parseFloat(user.total_balance);
        const withdrawalAmount = parseFloat(withdrawal.amount);




        if (userBalance <= withdrawalAmount) {
            return sendError(res, 400, 'User has insufficient balance');
        }

        // 3. Withdrawal status update karo (DIRECT 'processed')
        const [result] = await pool.execute(
            `UPDATE withdrawal_requests 
             SET status = 'processed', processed_by = ?, remarks = ?, processed_at = NOW()
             WHERE id = ? AND status = 'pending'`,
            [adminId, remarks, withdrawalId]
        );

        // 4. User balance update karo
        await pool.execute(
            `UPDATE users 
             SET total_balance = total_balance - ?,
                 total_coins = total_coins - ?
             WHERE id = ?`,
            [withdrawal.amount, withdrawal.amount, withdrawal.user_id]
        );

        console.log(`Approved withdrawal ${withdrawalId}. Deducted ₹${withdrawal.amount} from user ${withdrawal.user_id}`);

        sendSuccess(res, {
            withdrawalId: withdrawalId,
            amount: withdrawal.amount,
            userId: withdrawal.user_id
        }, 'Withdrawal approved successfully');

    } catch (error) {
        console.error('Process withdrawal error:', error);
        sendError(res, 500, 'Error processing withdrawal');
    }
};

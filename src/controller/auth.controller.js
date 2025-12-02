import { sendError } from "../utils/errorHandler.js";
import { sendSuccess } from "../utils/responseHandler.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createUser , pendingUserForAprove , 
    approveUserModel
 } from "../model/auth.model.js";
import { getUserByEmail } from "../model/auth.model.js";
import { getAdminByEmail } from "../model/admin.model.js";

import { getUserByUniqueId } from "../model/auth.model.js";
import { getApprovedUsers } from "../model/admin.model.js";
import { userApprovalTemplate  , userRejectionTemplate} from "../utils/emailTemplate.js";
import pool from "../config/database.config.js";

export const registerUser = async (req , res)=>{
 
try {
    const  {
        name,
        phone,
        email,
        bank_account_number,
      
        password 
    }      = req.body


if (!name || !phone || !email || !bank_account_number || !password) {
    return sendError(res, 400, 'All fields are required');
}

const existingEmail = await getUserByEmail(email);
if (existingEmail) {
    return sendError(res, 409, 'Email already registered');
}

const saltRounds = 10;
const password_hash = await bcrypt.hash(password, saltRounds); 

const result = await createUser({
    name,
    phone,
    email,
    bank_account_number,
  

    password_hash
});

sendSuccess(res, { userId: result.userId }, 'Registration successful. Waiting for admin approval.');

} catch (error) {
    console.error('Registration error:', error);
    sendError(res, 500, error.message || 'Server error during registration');

}

}

// admin aproved api 

export const getPendingUsers = async (req, res) => {
  
    try {
    const userPending =     await pendingUserForAprove()
       
        sendSuccess(res, userPending, 'Pending users retrieved');
    } catch (error) {
        sendError(res, 500, 'Error fetching pending users');
    }
};





export const approvePendingUser = async (req, res) => {
    try {
        const { email } = req.body;  
        const adminId = req.user.id; 

        const existingUser = await getUserByEmail(email); 
        if (!existingUser) {
            return sendError(res, 404, 'User not found');
        }

        const uniqueId = `octa${(Math.floor(Math.random() * 1000) + 1000).toString().substr(1)}`;

        // Model call karo with ALL parameters
        const updateResult = await approveUserModel(email, uniqueId, adminId);

        if (updateResult.affectedRows === 0) {
            return sendError(res, 400, 'User already approved or not found');
        }

        // Frontend ke liye template send karo
        const emailTemplate = userApprovalTemplate(existingUser.name, uniqueId);

        // Success response with template
        sendSuccess(res, { 
            uniqueId: uniqueId,
            email: email,
            user_name: existingUser.name,
            email_template: emailTemplate,
            message: "User approved successfully"
        }, "User approved successfully");

    } catch (error) {
        console.error('Approve error:', error);
        sendError(res, 500, 'Error approving user');
    }
};




export const rejectPendingUser = async (req, res) => {
    try {
        const { email, rejection_reason } = req.body;  
        const adminId = req.user.id; 

        // Validation
        if (!rejection_reason || rejection_reason.trim() === '') {
            return sendError(res, 400, 'Rejection reason is required');
        }

        const existingUser = await getUserByEmail(email); 
        if (!existingUser) {
            return sendError(res, 404, 'User not found');
        }

        // Reject user in database
        const [updateResult] = await pool.execute(
            `UPDATE users 
             SET status = 'rejected', 
                 approved_by = ?, 
                 approved_at = NOW(),
            
                 updated_at = NOW()
             WHERE email = ? AND status = 'pending'`,
            [adminId,  email]
        );

        if (updateResult.affectedRows === 0) {
            return sendError(res, 400, 'User already processed or not found');
        }

        // Frontend ke liye rejection template send karo
        const emailTemplate = userRejectionTemplate(existingUser.name, rejection_reason);

        sendSuccess(res, { 
            email: email,
            user_name: existingUser.name,
            rejection_reason: rejection_reason,
            email_template: emailTemplate,
            action: "rejected", 
            message: "User rejected successfully"
        }, "User rejected successfully");

    } catch (error) {
        console.error('Reject error:', error);
        sendError(res, 500, 'Error rejecting user');
    }
};



//log in user  
export const universalLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return sendError(res, 400, 'Email aur password dalo');
        }

        let userType = 'user';
        let user = null;

        console.log(` Login attempt for: ${email}`);

        //  PEHLE ADMINS TABLE MEIN DHOONDO (EMAIL SE)
        user = await getAdminByEmail(email);
        
        if (user) {
            userType = user.role; // 'admin' ya 'agent'
            console.log(` Found in admins: ${userType}`);
        } 
        //  AGAR ADMIN NAHI MILA TO USERS TABLE MEIN DHOONDO
        else {
            // Pehle email se check karo
            user = await getUserByEmail(email);
            
            // AGAR EMAIL SE NAHI MILA TO UNIQUE ID SE CHECK KARO
            if (!user) {
                user = await getUserByUniqueId(email);
                console.log(` Found by Unique ID: ${email}`);
            } else {
                console.log(`Found by Email: ${email}`);
            }
            
            userType = 'user';
        }

        // AGAR KOI BHI NAHI MILA
        if (!user) {
            console.log(' Not found in any table');
            return sendError(res, 401, 'Invalid email/Unique ID ya password');
        }

        //  PASSWORD VERIFY KARO
       
        // TOKEN GENERATE KARO
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                userType: userType,
                name: user.name
            },
            "kathan12345",
            { expiresIn: '7d' }
        );

        // LOGIN SUCCESS
        const responseData = {
            token: token,
            userId: user.id,
            email: user.email,
            userType: userType,
            name: user.name
        };

        // AGAR USER HAI TO STATUS CHECK KARO
        if (userType === 'user' && user.status !== 'approved') {
            return sendError(res, 401, 'Account abhi approve nahi hua hai');
        }

        console.log(`Login successful: ${user.name} (${userType})`);
        sendSuccess(res, responseData, 'Login successful');

    } catch (error) {
        console.error('Login error:', error);
        sendError(res, 500, 'Login failed');
    }
}; 




// get approved user 

export const getApprovedUsersbyAdmin = async (req, res) => {
    try {
        console.log('Fetching approved users...');
        
        const approvedUsers = await getApprovedUsers();
        
        console.log(` Found ${approvedUsers.length} approved users`);
        
        sendSuccess(res, approvedUsers, 'Approved users retrieved successfully');

    } catch (error) {
        console.error('Error fetching approved users:', error);
        sendError(res, 500, 'Error fetching approved users');
    }
}; 





export const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user.userType;
       
        console.log(`Fetching profile for user ${userId} (${userType})`);

        let user;
        
        if (userType === 'user') {
            // User table se complete data lao
            const [users] = await pool.execute(
                `SELECT 
                    id, unique_id, name, email, phone, 
                    bank_account_number,
                    status, total_coins, total_balance,
                    approved_by, approved_at, created_at
                 FROM users 
                 WHERE id = ?`,
                [userId]
            );
            user = users[0];
            
            // Agar approved hai toh approved_by admin ka name lao
            if (user && user.approved_by) {
                const [admins] = await pool.execute(
                    `SELECT name FROM admins WHERE id = ?`,
                    [user.approved_by]
                );
                user.approved_by_name = admins[0]?.name || 'Admin';
            }
        } else {
            // Admin/Agent table se data lao
            const [admins] = await pool.execute(
                `SELECT id, name, email, role, permissions, created_at 
                 FROM admins 
                 WHERE id = ?`,
                [userId]
            );
            user = admins[0];
        }

        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        console.log(`Profile retrieved for: ${user.name}`);
        sendSuccess(res, user, 'Profile retrieved successfully');

    } catch (error) {
        console.error('Profile error:', error);
        sendError(res, 500, 'Error fetching profile');
    }
};
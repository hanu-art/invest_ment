import { sendError } from "../utils/errorHandler.js";
import { sendSuccess } from "../utils/responseHandler.js";
import pool from "../config/database.config.js";
import cloudinary from "../config/cloudanary.config.js";

// POST - Create/Submit KYC
export const createKYC = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      full_name,
      email,
      address,
      city,
      state,
      aadhaar_no,
      pan_number,
      account_no,
      bank,
      ifsc
    } = req.body;

    // Validate required fields
    if (!full_name || !aadhaar_no || !pan_number) {
      return sendError(res, 400, 'Full name, Aadhaar and PAN are required');
    }

    // Check if KYC already exists for user
    const [existing] = await pool.execute(
      'SELECT * FROM kyc WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      return sendError(res, 400, 'KYC already submitted for this user');
    }

    // Upload Aadhaar image to Cloudinary
    let aadhaar_image_url = null;
    if (req.files?.aadhaar_image) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'kyc_docs',
            public_id: `aadhaar_${userId}_${Date.now()}`,
            resource_type: 'image'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.files.aadhaar_image[0].buffer);
      });
      aadhaar_image_url = uploadResult.secure_url;
    }

    // Upload PAN image to Cloudinary
    let pancard_image_url = null;
    if (req.files?.pancard_image) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'kyc_docs',
            public_id: `pan_${userId}_${Date.now()}`,
            resource_type: 'image'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.files.pancard_image[0].buffer);
      });
      pancard_image_url = uploadResult.secure_url;
    }

    // Insert KYC into database
    const [result] = await pool.execute(
      `INSERT INTO kyc 
       (full_name, email, address, city, state, aadhaar_no, pan_number,
        account_no, bank, ifsc, aadhaar_image, pancard_image, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email || null,
        address || null,
        city || null,
        state || null,
        aadhaar_no,
        pan_number,
        account_no || null,
        bank || null,
        ifsc || null,
        aadhaar_image_url,
        pancard_image_url,
        userId
      ]
    );

    // Update user's KYC status
    await pool.execute(
      'UPDATE users SET kyc_status = "pending" WHERE id = ?',
      [userId]
    );

    sendSuccess(res, {
      kyc_id: result.insertId,
      user_id: userId,
      kyc_status: 'pending'
    }, 'KYC submitted successfully and under review');

  } catch (error) {
    console.error('KYC submit error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 400, 'Aadhaar or PAN already registered');
    }
    
    sendError(res, 500, 'Error submitting KYC');
  }
};

// GET - Get KYC details for logged in user
export const getKYC = async (req, res) => {
  try {
    const userId = req.user.id;

    const [kycData] = await pool.execute(
      `SELECT 
        kyc_id, full_name, email, address, city, state,
        aadhaar_no, pan_number, account_no, bank, ifsc,
        aadhaar_image, pancard_image, user_id
       FROM kyc 
       WHERE user_id = ?`,
      [userId]
    );

    if (kycData.length === 0) {
      return sendError(res, 404, 'KYC not found for this user');
    }

    // Hide sensitive data if needed
    const response = { ...kycData[0] };
    // delete response.aadhaar_image; // Optional
    // delete response.pancard_image;

    sendSuccess(res, response, 'KYC details retrieved');

  } catch (error) {
    console.error('Get KYC error:', error);
    sendError(res, 500, 'Error fetching KYC details');
  }
};
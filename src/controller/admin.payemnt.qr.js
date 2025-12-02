import cloudinary from "../config/cloudanary.config.js";
import { sendError } from "../utils/errorHandler.js";
import { sendSuccess } from "../utils/responseHandler.js";
import pool from "../config/database.config.js";




export const createPaymentMethod = async (req, res) => {
  try {
    const {
      payment_type, // 'qr_code', 'bank', 'upi'
      account_number,
      ifsc_code,
      bank_name,
      branch_name,
      upi_id
    } = req.body;

    // Validation
    if (!payment_type || !['qr_code', 'bank', 'upi'].includes(payment_type)) {
      return sendError(res, 400, 'Invalid payment type');
    }

    let qr_image_url = null;

    // Handle QR Code Upload
    if (payment_type === 'qr_code' && req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'admin_qr_codes',
            public_id: `qr_${Date.now()}`,
            resource_type: 'image'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      qr_image_url = uploadResult.secure_url;
    }

    // Bank validation
    if (payment_type === 'bank') {
      if (!account_number) return sendError(res, 400, 'Account number required');
      if (!ifsc_code) return sendError(res, 400, 'IFSC code required');
      if (!bank_name) return sendError(res, 400, 'Bank name required');
    }

    // UPI validation
    if (payment_type === 'upi') {
      if (!upi_id) return sendError(res, 400, 'UPI ID required');
    }

    // Insert into database
    const [result] = await pool.execute(
      `INSERT INTO admin_payment_methods 
       (payment_type, qr_image_url, account_number, ifsc_code, 
        bank_name, branch_name, upi_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        payment_type,
        qr_image_url,
        account_number || null,
        ifsc_code || null,
        bank_name || null,
        branch_name || null,
        upi_id || null
      ]
    );

    return sendSuccess(res, {
      id: result.insertId,
      payment_type,
      qr_image_url,
      account_number,
      ifsc_code,
      bank_name,
      branch_name,
      upi_id,
      is_active: true
    }, 'Payment method created successfully');

  } catch (error) {
    console.error('Create error:', error);
    return sendError(res, 500, 'Server error');
  }
};

// GET: All Payment Methods (Admin)
export const getAllPaymentMethods = async (req, res) => {
  try {
    const [methods] = await pool.execute(
      `SELECT * FROM admin_payment_methods ORDER BY created_at DESC`
    );

    return sendSuccess(res, methods, 'All payment methods');

  } catch (error) {
    console.error('Get all error:', error);
    return sendError(res, 500, 'Server error');
  }
};





// controllers/adminPaymentController.js - PUT API Addition
export const updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      payment_type,
      account_number,
      ifsc_code,
      bank_name,
      branch_name,
      upi_id,
      is_active
    } = req.body;

    // Check if payment method exists
    const [existing] = await pool.execute(
      `SELECT * FROM admin_payment_methods WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return sendError(res, 404, 'Payment method not found');
    }

    const current = existing[0];
    let qr_image_url = current.qr_image_url;

    // Handle QR code update
    if (req.file) {
      // Delete old QR from Cloudinary if exists
      if (current.qr_image_url) {
        try {
          const urlParts = current.qr_image_url.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split('.')[0];
          await cloudinary.uploader.destroy(`admin_qr_codes/${publicId}`);
        } catch (cloudinaryError) {
          console.log('Old QR delete error (non-critical):', cloudinaryError);
        }
      }

      // Upload new QR to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'admin_qr_codes',
            public_id: `qr_${id}_${Date.now()}`,
            resource_type: 'image',
            transformation: [
              { width: 500, height: 500, crop: 'limit' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      qr_image_url = uploadResult.secure_url;
    }

    // Prepare update data
    const updateData = {
      payment_type: payment_type || current.payment_type,
      qr_image_url: qr_image_url,
      account_number: account_number !== undefined ? account_number : current.account_number,
      ifsc_code: ifsc_code !== undefined ? ifsc_code : current.ifsc_code,
      bank_name: bank_name !== undefined ? bank_name : current.bank_name,
      branch_name: branch_name !== undefined ? branch_name : current.branch_name,
      upi_id: upi_id !== undefined ? upi_id : current.upi_id,
      is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : current.is_active
    };

    // Update in database
    const [result] = await pool.execute(
      `UPDATE admin_payment_methods 
       SET payment_type = ?,
           qr_image_url = ?,
           account_number = ?,
           ifsc_code = ?,
           bank_name = ?,
           branch_name = ?,
           upi_id = ?,
           is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        updateData.payment_type,
        updateData.qr_image_url,
        updateData.account_number,
        updateData.ifsc_code,
        updateData.bank_name,
        updateData.branch_name,
        updateData.upi_id,
        updateData.is_active,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return sendError(res, 500, 'Failed to update payment method');
    }

    // Get updated record
    const [updated] = await pool.execute(
      `SELECT * FROM admin_payment_methods WHERE id = ?`,
      [id]
    );

    return sendSuccess(res, updated[0], 'Payment method updated successfully');

  } catch (error) {
    console.error('Update payment method error:', error);
    
    if (error.message.includes('Cloudinary')) {
      return sendError(res, 500, 'Error uploading image');
    }
    
    return sendError(res, 500, 'Internal server error');
  }
};
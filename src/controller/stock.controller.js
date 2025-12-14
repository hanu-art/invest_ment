import pool from "../config/database.config.js";
import cloudinary from "../config/cloudanary.config.js";
import multer from "multer";

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
}).single('image');

// 1. POST - Add New Stock with Image
export const addStock = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading file'
      });
    }

    try {
      const userId = req.user.id;
      const {
        stock_name,
        stock_symbol,
        stock_buy_price,
        current_price,
        quantity,
        purchase_date
      } = req.body;

      // Validation
      if (!stock_name || !stock_buy_price || !quantity || !purchase_date) {
        return res.status(400).json({
          success: false,
          message: "Stock name, buy price, quantity and purchase date are required"
        });
      }

      let imageUrl = null;
      
      // Handle file upload to Cloudinary if file exists
      if (req.file) {
        try {
          const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'stock_images',
                public_id: `stock_${Date.now()}`,
                resource_type: 'auto'
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            
            uploadStream.end(req.file.buffer);
          });
          
          imageUrl = uploadResult.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: "Error uploading image to Cloudinary"
          });
        }
      }

      // Insert into database
      const [result] = await pool.execute(
        `INSERT INTO stocks 
         (user_id, stock_name, stock_symbol, stock_buy_price, 
          current_price, quantity, purchase_date, image_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          stock_name,
          stock_symbol || null,
          parseFloat(stock_buy_price),
          parseFloat(current_price || stock_buy_price),
          parseInt(quantity),
          purchase_date,
          imageUrl
        ]
      );

      res.status(201).json({
        success: true,
        message: "Stock added successfully",
        stock_id: result.insertId,
        image_url: imageUrl
      });

    } catch (error) {
      console.error("Add stock error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error adding stock" 
      });
    }
  });
};

// 2. GET - Get All Stocks for User
export const getMyStocks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'active' } = req.query;

    const [stocks] = await pool.execute(
      `SELECT * FROM stocks 
       WHERE user_id = ? AND status = ?
       ORDER BY purchase_date DESC`,
      [userId, status]
    );

    res.json({
      success: true,
      count: stocks.length,
      stocks: stocks
    });

  } catch (error) {
    console.error("Get stocks error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching stocks" 
    });
  }
};

// 3. GET - Get Single Stock by ID
export const getStockById = async (req, res) => {
  try {
    const userId = req.user.id;
    const stockId = req.params.id;

    const [stocks] = await pool.execute(
      `SELECT * FROM stocks 
       WHERE stock_id = ? AND user_id = ?`,
      [stockId, userId]
    );

    if (stocks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Stock not found"
      });
    }

    res.json({
      success: true,
      stock: stocks[0]
    });

  } catch (error) {
    console.error("Get stock by ID error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching stock" 
    });
  }
};

// 4. PUT - Update Stock with Image
export const updateStock = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading file'
      });
    }

    try {
      const userId = req.user.id;
      const stockId = req.params.id;
      const {
        stock_name,
        stock_symbol,
        stock_buy_price,
        current_price,
        quantity,
        purchase_date,
        status
      } = req.body;

      // Check if stock exists and belongs to user
      const [existing] = await pool.execute(
        `SELECT * FROM stocks 
         WHERE stock_id = ? AND user_id = ?`,
        [stockId, userId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Stock not found"
        });
      }

      let imageUrl = existing[0].image_url;
      
      // Handle file upload to Cloudinary if new file is provided
      if (req.file) {
        try {
          // Delete old image from Cloudinary if it exists
          if (imageUrl) {
            const publicId = imageUrl.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`stock_images/${publicId}`);
          }

          // Upload new image
          const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'stock_images',
                public_id: `stock_${stockId}_${Date.now()}`,
                resource_type: 'auto'
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            
            uploadStream.end(req.file.buffer);
          });
          
          imageUrl = uploadResult.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: "Error updating image in Cloudinary"
          });
        }
      }

      // Update stock in database
      await pool.execute(
        `UPDATE stocks 
         SET stock_name = COALESCE(?, stock_name),
             stock_symbol = COALESCE(?, stock_symbol),
             stock_buy_price = COALESCE(?, stock_buy_price),
             current_price = COALESCE(?, current_price),
             quantity = COALESCE(?, quantity),
             purchase_date = COALESCE(?, purchase_date),
             status = COALESCE(?, status),
             image_url = ?
         WHERE stock_id = ? AND user_id = ?`,
        [
          stock_name,
          stock_symbol,
          stock_buy_price ? parseFloat(stock_buy_price) : null,
          current_price ? parseFloat(current_price) : null,
          quantity ? parseInt(quantity) : null,
          purchase_date,
          status,
          imageUrl,
          stockId,
          userId
        ]
      );

      res.json({
        success: true,
        message: "Stock updated successfully",
        stock_id: stockId,
        image_url: imageUrl
      });

    } catch (error) {
      console.error("Update stock error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error updating stock" 
      });
    }
  });
};

// 5. DELETE - Delete Stock
export const deleteStock = async (req, res) => {
  try {
    const userId = req.user.id;
    const stockId = req.params.id;

    // Get stock to check if it has an image
    const [existing] = await pool.execute(
      `SELECT image_url FROM stocks 
       WHERE stock_id = ? AND user_id = ?`,
      [stockId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Stock not found"
      });
    }

    // Delete image from Cloudinary if it exists
    if (existing[0].image_url) {
      try {
        const publicId = existing[0].image_url.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`stock_images/${publicId}`);
      } catch (cloudinaryError) {
        console.error('Error deleting image from Cloudinary:', cloudinaryError);
        // Continue with stock deletion even if image deletion fails
      }
    }

    // Delete stock from database
    await pool.execute(
      `DELETE FROM stocks 
       WHERE stock_id = ? AND user_id = ?`,
      [stockId, userId]
    );

    res.json({
      success: true,
      message: "Stock deleted successfully"
    });

  } catch (error) {
    console.error("Delete stock error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error deleting stock" 
    });
  }
};
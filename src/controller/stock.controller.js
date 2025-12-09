import pool from "../config/database.config.js";  



// 1. POST - Add New Stock
export const addStock = async (req, res) => {
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

    const [result] = await pool.execute(
      `INSERT INTO stocks 
       (user_id, stock_name, stock_symbol, stock_buy_price, 
        current_price, quantity, purchase_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        stock_name,
        stock_symbol || null,
        parseFloat(stock_buy_price),
        parseFloat(current_price || stock_buy_price),
        parseInt(quantity),
        purchase_date
      ]
    );

    res.status(201).json({
      success: true,
      message: "Stock added successfully",
      stock_id: result.insertId
    });

  } catch (error) {
    console.error("Add stock error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error adding stock" 
    });
  }
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

// 4. PUT - Update Stock
export const updateStock = async (req, res) => {
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

    // Update stock
    const [result] = await pool.execute(
      `UPDATE stocks 
       SET stock_name = COALESCE(?, stock_name),
           stock_symbol = COALESCE(?, stock_symbol),
           stock_buy_price = COALESCE(?, stock_buy_price),
           current_price = COALESCE(?, current_price),
           quantity = COALESCE(?, quantity),
           purchase_date = COALESCE(?, purchase_date),
           status = COALESCE(?, status)
       WHERE stock_id = ? AND user_id = ?`,
      [
        stock_name,
        stock_symbol,
        stock_buy_price ? parseFloat(stock_buy_price) : null,
        current_price ? parseFloat(current_price) : null,
        quantity ? parseInt(quantity) : null,
        purchase_date,
        status,
        stockId,
        userId
      ]
    );

    res.json({
      success: true,
      message: "Stock updated successfully",
      stock_id: stockId
    });

  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating stock" 
    });
  }
};

// 5. DELETE - Delete Stock
export const deleteStock = async (req, res) => {
  try {
    const userId = req.user.id;
    const stockId = req.params.id;

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

    // Delete stock
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
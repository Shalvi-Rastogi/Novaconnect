const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const db = require("./db");
const multer = require("multer");
const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:3000",  // your frontend origin
    credentials: true                 // required to send session cookies
}));
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

const sessionStore = new MySQLStore({
  host: "localhost",
  user: "root",
  password: "",
  database: "seller_dashboard"
});

app.use(session({
  name: "connect.sid",
  secret: "banasthali_secret_key",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,   
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 10
  }
}));


const path = require("path");
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));
app.use('/images', express.static( 'images'));

// ===== MULTER CONFIG =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, //  max 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const isValid =
      allowed.test(file.mimetype) &&
      allowed.test(path.extname(file.originalname).toLowerCase());

    if (isValid) cb(null, true);
    else cb(new Error("Only JPG, JPEG, PNG allowed"));
  }
});

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

function isSellerLoggedIn(req, res, next) {
    if (req.session.user && req.session.user.role === "seller") {
        return next();
    }
    // Check if request expects HTML (browser navigation) or JSON (API call)
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/novaconnect_2ndpage.html');
    }
    return res.status(401).json({ message: "Unauthorized" });
}

function isBuyerLoggedIn(req, res, next) {
    if (req.session.user && req.session.user.role === "buyer") {
        return next();
    }
    // Check if request expects HTML (browser navigation) or JSON (API call)
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/novaconnect_2ndpage.html');
    }
    return res.status(401).json({ message: "Unauthorized" });
}

function isAdminLoggedIn(req, res, next) {
    if (req.session.user && req.session.user.role === "admin") {
        return next();
    }
    // Check if request expects HTML (browser navigation) or JSON (API call)
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/novaconnect_2ndpage.html');
    }
    return res.status(401).json({ message: "Unauthorized" });
}

app.get("/seller", isSellerLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname,  "..", "public", "shalviseller.html"));
});

app.get("/buyer", isBuyerLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "buyer_dashboard.html"));
});

app.get("/admin", isAdminLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "admin_dashboard.html"));
});



app.post("/seller/register", async (req, res) => {
  const { name, email, smartcard_id, hostel,  password } = req.body;


  try {
    // 1️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2️⃣ Get last seller_id
    const getLastIdSql =
      "SELECT seller_id FROM sellerdetails ORDER BY id DESC LIMIT 1";

    db.query(getLastIdSql, (err, result) => {
      if (err) {
        console.log(" Error fetching seller_id:", err);
        return res.status(500).send("Server error");
      }

      // 3️⃣ Generate next seller_id
      let nextSellerId = "S001";

      if (result.length > 0) {
        const lastId = result[0].seller_id; // e.g. S007
        const number = parseInt(lastId.substring(1)) + 1;
        nextSellerId = "S" + number.toString().padStart(3, "0");
      }

      // 4️⃣ Insert seller
      const insertSql = `
      INSERT INTO sellerdetails (seller_id, name, email, smartcard_id, hostel,  hashedPassword)
      VALUES (?, ?, ?, ?, ?, ?)
`;


      db.query(
        insertSql,
        [nextSellerId, name, email, smartcard_id, hostel, hashedPassword],

        (err, result) => {
          if (err) {
            console.log(" Insert error:", err);
            return res.status(500).send("Error saving seller");
          }
        req.session.user = { email, role: "seller" };
            req.session.save(() => {
              console.log("Seller created & logged in:", nextSellerId);
              res.json({ message: "Seller registered successfully", redirect: "/seller" });
            });


        }
      );
    });
  } catch (error) {
    console.log("Server error:", error);
    res.status(500).send("Internal error");
  }
});
app.post("/buyer/register", async (req, res) => {
 const { name,  email, smartcard_id, hostel, password } = req.body;


  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    
    const getLastIdSql =
      "SELECT buyer_id FROM buyerdetails WHERE buyer_id IS NOT NULL ORDER BY id DESC LIMIT 1";

    db.query(getLastIdSql, (err, result) => {
      if (err) {
        console.log("Fetch buyer_id error:", err);
        return res.status(500).send("Server error");
      }

    
      let nextBuyerId = "B001";

      if (result.length > 0) {
        const lastId = result[0].buyer_id; // B007
        const number = parseInt(lastId.substring(1)) + 1;
        nextBuyerId = "B" + number.toString().padStart(3, "0");
      }

      
      const insertSql = `
      INSERT INTO buyerdetails (buyer_id, name, email, smartcard_id, hostel,  hashedPassword)
      VALUES (?, ?, ?, ?, ?, ?)
`      ;


      db.query(
        insertSql,
        [nextBuyerId, name, email, smartcard_id , hostel, hashedPassword],

        (err, result) => {
          if (err) {
            console.log(" Buyer insert error:", err);
            return res.status(500).send("Error saving buyer");
          }

          req.session.user = { email, role: "buyer", buyer_id: nextBuyerId, name: name };
          req.session.save(() => {
            console.log("Buyer created & logged in:", nextBuyerId);
            res.json({ message: "Buyer registered successfully", redirect: "/buyer" });
          });


        }
      );
    });
  } catch (err) {
    console.log("Buyer server error:", err);
    res.status(500).send("Server error");
  }
});



// ===== ADD PRODUCT =====
app.post("/product", isSellerLoggedIn, upload.single("image"), (req, res) => {
  const { Product_name, description } = req.body;

  const price = parseFloat(req.body.price);
  const quantity = parseInt(req.body.quantity, 10);
  const image = req.file?.filename;

  // ✅ VALIDATIONS
  if (!Product_name || !image) {
    return res.status(400).json({
      message: "Product name & image are required"
    });
  }

  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({
      message: "Invalid price."
    });
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({
      message: "Quantity must be a whole number"
    });
  }

  const sql = `
    INSERT INTO product (Product_name, price, quantity, description, image)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [Product_name, price, quantity, description || "", image],
    (err, result) => {
      if (err) {
        console.error("DB Insert Error:", err);
        return res.status(500).json({ message: "Insert failed" });
      }

      res.json({ message: "Product added successfully" });
    }
  );
});

app.get("/products", (req, res) => {
  db.query("SELECT * FROM product ORDER BY product_id DESC", (err, results) => {
    if (err) {
      console.error("DB Fetch Error:", err);
      return res.status(500).json({ message: "Failed to fetch products", error: err.sqlMessage });
    }
    res.json(results);
  });
});
app.delete("/product/:id", isSellerLoggedIn, (req, res) => {
  const id = req.params.id;

  console.log("Delete request for ID:", id); 
  
  const sql = "DELETE FROM product WHERE product_id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Delete failed" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  });
});

app.put("/product/:id/quantity", isSellerLoggedIn, (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);
  const id = req.params.id;

  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({
      message: "Quantity must be an integer"
    });
  }

  const sql = "UPDATE product SET quantity = ? WHERE product_id = ?";

  db.query(sql, [quantity, id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Update failed" });
    }
    res.json({ message: "Stock updated" });
  });
});



// ===== ADMIN REGISTER =====
app.post("/admin/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get last admin_id
    const getLastIdSql =
      "SELECT admin_id FROM admindetails ORDER BY id DESC LIMIT 1";

    db.query(getLastIdSql, (err, result) => {
      if (err) {
        console.log("Fetch admin_id error:", err);
        return res.status(500).json({ message: "Server error" });
      }

      // Generate next admin_id
      let nextAdminId = "A001";

      if (result.length > 0) {
        const lastId = result[0].admin_id; // A007
        const number = parseInt(lastId.substring(1)) + 1;
        nextAdminId = "A" + number.toString().padStart(3, "0");
      }

      const insertSql = `
        INSERT INTO admindetails (admin_id, name, email, hashedPassword)
        VALUES (?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [nextAdminId, name, email, hashedPassword],
        (err) => {
          if (err) {
            console.log("Admin insert error:", err);
            return res.status(500).json({ message: "Error saving admin" });
          }

          req.session.user = { email, role: "admin" };
          req.session.save(() => {
            console.log("Admin created & logged in:", nextAdminId);
            res.json({ message: "Admin registered successfully", redirect: "/admin" });
          });
        }
      );
    });

  } catch (err) {
    console.log("Admin server error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const adminQuery  = "SELECT * FROM admindetails WHERE email=?";
  const sellerQuery = "SELECT * FROM sellerdetails WHERE email=?";
  const buyerQuery  = "SELECT * FROM buyerdetails WHERE email=?";

  db.query(adminQuery, [email], async (err, adminResult) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (adminResult.length > 0) {
      const match = await bcrypt.compare(password, adminResult[0].hashedPassword);
      if (match) {
        req.session.user = { email, role: "admin" };
        // ✅ Save session before responding
        req.session.save(() => {
          return res.json({ message: "Admin login successful", redirect: "/admin" });
        });
        return;
      } else return res.status(401).json({ message: "Invalid email or password" });
    }

    db.query(sellerQuery, [email], async (err, sellerResult) => {
      if (err) return res.status(500).json({ message: "Database error" });

      if (sellerResult.length > 0) {
        const match = await bcrypt.compare(password, sellerResult[0].hashedPassword);
        if (match) {
          req.session.user = { 
            email, 
            role: "seller", 
            seller_id: sellerResult[0].seller_id,
            name: sellerResult[0].name
          };
          req.session.save(() => {
            return res.json({ message: "Seller login successful", redirect: "/seller" });
          });
          return;
        } else return res.status(401).json({ message: "Invalid email or password" });
      }

      db.query(buyerQuery, [email], async (err, buyerResult) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (buyerResult.length > 0) {
          const match = await bcrypt.compare(password, buyerResult[0].hashedPassword);
          if (match) {
            req.session.user = { 
              email, 
              role: "buyer", 
              buyer_id: buyerResult[0].buyer_id,
              name: buyerResult[0].name
            };
            req.session.save(() => {
              return res.json({ message: "Buyer login successful", redirect: "/buyer" });
            });
            return;
          } else return res.status(401).json({ message: "Invalid email or password" });
        }

        return res.status(401).json({ message: "Invalid email or password" });
      });
    });
  });
});

// ===== SELLER PROFILE ENDPOINTS =====

// Get seller profile data
app.get("/seller/profile", isSellerLoggedIn, (req, res) => {
  const sellerId = req.session.user.seller_id;
  
  const query = "SELECT seller_id, name, email, smartcard_id, hostel FROM sellerdetails WHERE seller_id = ?";
  
  db.query(query, [sellerId], (err, result) => {
    if (err) {
      console.log("Error fetching seller profile:", err);
      return res.status(500).json({ message: "Database error" });
    }
    
    if (result.length === 0) {
      return res.status(404).json({ message: "Seller not found" });
    }
    
    res.json({ 
      success: true, 
      profile: result[0] 
    });
  });
});

// Update seller profile
app.put("/seller/profile", isSellerLoggedIn, (req, res) => {
  const sellerId = req.session.user.seller_id;
  const { name, smartcard_id, hostel } = req.body;
  
  console.log("📝 Profile update request:", { sellerId, name, smartcard_id, hostel });
  
  // Validate input
  if (!name || !smartcard_id || !hostel) {
    console.log("❌ Validation failed: Missing required fields");
    return res.status(400).json({ message: "All fields are required" });
  }
  
  const query = "UPDATE sellerdetails SET name = ?, smartcard_id = ?, hostel = ? WHERE seller_id = ?";
  
  console.log("🔄 Executing database update for seller:", sellerId);
  
  db.query(query, [name, smartcard_id, hostel, sellerId], (err, result) => {
    if (err) {
      console.log("❌ Database error:", err);
      return res.status(500).json({ message: "Database error: " + err.message });
    }
    
    console.log("✅ Database update result:", result);
    
    if (result.affectedRows === 0) {
      console.log("⚠️ No rows affected - seller not found:", sellerId);
      return res.status(404).json({ message: "Seller not found" });
    }
    
    console.log(`✅ Profile updated successfully for seller ${sellerId}`);
    
    // Update session data with new name
    req.session.user.name = name;
    req.session.save(() => {
      res.json({ 
        success: true, 
        message: "Profile updated successfully",
        updatedRows: result.affectedRows
      });
    });
  });
});

// ===== TEST ENDPOINT TO VERIFY DATABASE =====
app.get("/test/seller-table", isSellerLoggedIn, (req, res) => {
  const sellerId = req.session.user.seller_id;
  
  console.log("🔍 Testing database connection for seller:", sellerId);
  
  const query = "SELECT * FROM sellerdetails WHERE seller_id = ?";
  
  db.query(query, [sellerId], (err, result) => {
    if (err) {
      console.log("❌ Database test error:", err);
      return res.status(500).json({ 
        success: false, 
        error: err.message,
        message: "Database connection failed" 
      });
    }
    
    console.log("✅ Database test result:", result);
    
    res.json({
      success: true,
      seller_found: result.length > 0,
      seller_data: result[0] || null,
      table_exists: true
    });
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

app.get("/check-session", (req, res) => {
  if (req.session.user) {
    res.json({
      loggedIn: true,
      user: req.session.user
    });
  } else {
    res.json({ loggedIn: false });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

 
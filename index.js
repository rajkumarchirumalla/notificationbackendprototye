const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const os = require("os");
require("dotenv").config();

const { sequelize, Device } = require("./db");

// Firebase Admin Initialization
const serviceAccount = require("./firebase-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(bodyParser.json());

// Sync database
sequelize
  .sync()
  .then(() => {
    console.log("✅ MySQL database synced");
  })
  .catch((err) => {
    console.error("❌ Error syncing database:", err);
  });

// Register device token
app.post("/register", async (req, res) => {
  const { token, platform } = req.body;
  console.log(`Registering token: ${token} for platform: ${platform}`);

  if (!token || !platform) {
    return res.status(400).json({ error: "Token and platform are required" });
  }

  try {
    const [device, created] = await Device.findOrCreate({
      where: { token },
      defaults: { platform },
    });

    if (!created) {
      device.platform = platform;
      await device.save();
    }

    console.log(`✅ Registered token: ${token} for ${platform}`);
    res.status(200).json({ message: "Token registered successfully" });
  } catch (err) {
    console.error("❌ Error registering token:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send test notification to ALL devices
app.post("/send", async (req, res) => {
  const { title, body, image, data } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Title and body are required" });
  }

  try {
    const devices = await Device.findAll();
    const tokens = devices.map((device) => device.token);

    const messages = tokens.map((token) => ({
      token,
      notification: {
        title,
        body,
        ...(image && { image }), // optional image
      },
      data: {
        ...data, // optional custom data payload
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          color: "#3F51B5",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    }));

    if (admin.messaging().sendAll) {
      const response = await admin.messaging().sendAll(messages);
      console.log("✅ Batch sent:", response.successCount, "messages");
      res.json({ successCount: response.successCount });
    } else {
      let successCount = 0;
      for (const msg of messages) {
        try {
          await admin.messaging().send(msg);
          successCount++;
        } catch (err) {
          console.error(`❌ Failed to send to ${msg.token}:`, err.message);
        }
      }
      res.json({ successCount });
    }
  } catch (err) {
    console.error("❌ Error sending messages:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete specific token
app.delete("/unregister", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const deleted = await Device.destroy({ where: { token } });
    if (deleted === 0) {
      return res.status(404).json({ message: "Token not found" });
    }
    res.json({ message: "Token deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting token:", err);
    res.status(500).json({ error: "Failed to delete token" });
  }
});

// Delete all tokens
app.delete("/clear-devices", async (req, res) => {
  try {
    await Device.destroy({ where: {} });
    res.json({ message: "All device records deleted" });
  } catch (err) {
    console.error("❌ Error clearing devices:", err);
    res.status(500).json({ error: "Failed to clear devices" });
  }
});

// GET /users/api/getByDataSource/:dataSource?search=yourSearchTerm
app.get("/users/api/getByDataSource/:dataSource", (req, res) => {
  const dataSource = req.params.dataSource;
  const search = req.query.search?.toLowerCase() || "";

  // Example: Simulated full dataset
  const allDataSources = {
    example: [
      { id: 1, name: "name Alpha" },
      { id: 2, name: "name Beta" },
      { id: 3, name: "name Gamma" },
      { id: 4, name: "name Delta" },
      { id: 5, name: "name Epsilon" },
      { id: 6, name: "name Zeta" },
      { id: 7, name: "name Eta" },
      { id: 8, name: "name Theta" },
      { id: 9, name: "name Iota" },
      { id: 10, name: "name Kappa" },
    ],
    another: [
      { id: 11, name: "Item One" },
      { id: 12, name: "Item Two" },
      { id: 13, name: "Item Three" },
      { id: 14, name: "Item Four" },
      { id: 15, name: "Item Five" },
      { id: 16, name: "Item Six" },
      { id: 17, name: "Item Seven" },
      { id: 18, name: "Item Eight" },
      { id: 19, name: "Item Nine" },
      { id: 20, name: "Item Ten" },
    ],
  };

  const items = allDataSources[dataSource] || [];

  // Apply search filter if query exists
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search)
  );

  res.json(filtered);
});

// Utility: Get local IP address dynamically
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const ifaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[ifaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// Start server
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const localIP = getLocalIPAddress();

app.listen(PORT, HOST, () => {
  console.log(`🚀 FCM server running at http://${localIP}:${PORT}`);
});

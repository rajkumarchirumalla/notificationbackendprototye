

import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import os from "os";
import cron from "node-cron";
import dotenv from "dotenv";

import { Device } from "./db";
import { logger } from "./utils/logger";
import { requireApiKey } from "./middlewares/apiKey";
import { sendLimiter } from "./middlewares/rateLimiter";
import {admin} from "./firebase/admin";
import { MulticastMessage } from "firebase-admin/messaging";

dotenv.config();

const app = express();
app.use(bodyParser.json());

/**
 * Get the local IP address for development/local usage
 */
function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const ifaceList of Object.values(interfaces)) {
    for (const iface of ifaceList ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

/**
 * Register a device token
 */
app.post("/register", async (req: Request, res: Response) => {
  const { token, platform } = req.body;

  if (!token || !platform) {
    return res.status(400).json({ error: "Token and platform are required" });
  }

  try {
    const [device, created] = await Device.findOrCreate({
      where: { token },
      defaults: {token, platform },
    });

    if (!created) {
      device.platform = platform;
      await device.save();
    }

    logger.info(`✅ Registered token: ${token} (${platform})`);
    res.status(200).json({ message: "Token registered successfully" });
  } catch (error) {
    logger.error("❌ Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Send notification to all or filtered tokens
 */
app.post("/send",  sendLimiter, async (req: Request, res: Response) => {
  const { title, body, image, data, platform, topic } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Title and body are required" });
  }

  try {
    if (topic) {
      // Send to FCM topic
      const message: admin.messaging.Message = {
        topic,
        notification: { title, body, ...(image && { image }) },
        data: data || {},
        android: {
          notification: { sound: "default" },
          priority: "high" as const,
        },
        apns: {
          payload: { aps: { sound: "default" } },
        },
      };

      const response = await admin.messaging().send(message);
      logger.info(`📢 Topic message sent to "${topic}"`);
      return res.json({ messageId: response });
    }

    const devices = platform
      ? await Device.findAll({ where: { platform } })
      : await Device.findAll();

    const tokens = devices.map((device) => device.token).filter(Boolean);

    const multicastMessage: MulticastMessage = {
      tokens,
      notification: { title, body, ...(image && { image }) },
      data: data || {},
      android: {
        notification: { sound: "default" },
        priority: "high" as const,
      },
      apns: {
        payload: {
          aps: { sound: "default" },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(multicastMessage);

    // Cleanup invalid tokens
    let removed = 0;
    await Promise.all(
      response.responses.map(async (resp, index) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-argument"
          ) {
            await Device.destroy({ where: { token: tokens[index] } });
            removed++;
            logger.warn(`🗑️ Removed invalid token: ${tokens[index]}`);
          }
        }
      })
    );

    logger.info(`✅ Sent to ${response.successCount}, removed ${removed}`);
    res.json({
      successCount: response.successCount,
      failureCount: response.failureCount,
      removed,
    });
  } catch (err: any) {
    logger.error("❌ Error sending:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Subscribe token to a topic
 */
app.post("/subscribe-topic", requireApiKey, async (req: Request, res: Response) => {
  const { token, topic } = req.body;
  if (!token || !topic) return res.status(400).json({ error: "Token and topic required" });

  try {
    await admin.messaging().subscribeToTopic(token, topic);
    logger.info(`🔔 Subscribed ${token} to topic ${topic}`);
    res.json({ message: `Subscribed to ${topic}` });
  } catch (err: any) {
    logger.error("❌ Subscription error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Unsubscribe token from a topic
 */
app.post("/unsubscribe-topic", requireApiKey, async (req: Request, res: Response) => {
  const { token, topic } = req.body;
  if (!token || !topic) return res.status(400).json({ error: "Token and topic required" });

  try {
    await admin.messaging().unsubscribeFromTopic(token, topic);
    logger.info(`🔕 Unsubscribed ${token} from topic ${topic}`);
    res.json({ message: `Unsubscribed from ${topic}` });
  } catch (err: any) {
    logger.error("❌ Unsubscribe error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete a single token
 */
app.delete("/unregister", requireApiKey, async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token required" });

  try {
    const deleted = await Device.destroy({ where: { token } });
    if (deleted === 0) return res.status(404).json({ message: "Token not found" });
    res.json({ message: "Token deleted successfully" });
  } catch (err) {
    logger.error("❌ Unregister error:", err);
    res.status(500).json({ error: "Failed to delete token" });
  }
});

/**
 * Delete all device tokens
 */
app.delete("/clear-devices", requireApiKey, async (_req: Request, res: Response) => {
  try {
    await Device.destroy({ where: {} });
    res.json({ message: "All devices cleared" });
  } catch (err) {
    logger.error("❌ Clear error:", err);
    res.status(500).json({ error: "Failed to clear devices" });
  }
});

// Scheduled cleanup task
cron.schedule("0 */6 * * *", async () => {
  logger.info("🧹 Scheduled cleanup running");
  // Implement retry logic, expired message cleanup, etc.
});

// Start server
const PORT = process.env.PORT || 3000;
const localIP = getLocalIPAddress();

app.listen(PORT, () => {
  logger.info(`🚀 Server running at http://${localIP}:${PORT}`);
});

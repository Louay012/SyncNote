import express from "express";
import cors from "cors";
import { env } from "../config/env.js";
import { buildContext } from "../graphql/context.js";
import { signShortLivedToken } from "../utils/auth.js";

const router = express.Router();

function corsOptions() {
  return {
    origin: env.corsOrigin === "*" ? true : env.corsOrigin,
    credentials: true
  };
}

router.get(
  "/ws-token",
  cors(corsOptions()),
  async (req, res) => {
    try {
      const ctx = await buildContext(null, req, res);
      const user = ctx.currentUser;
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const token = signShortLivedToken(user.id, "5m");
      return res.status(200).json({ token });
    } catch (err) {
      console.error("/ws-token error", err);
      return res.status(500).json({ error: "server_error" });
    }
  }
);

export function attachWsTokenRoute(app) {
  app.use("/", router);
}

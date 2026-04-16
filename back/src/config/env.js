import dotenv from "dotenv";

dotenv.config();

const requiredKeys = ["POSTGRES_URI", "JWT_SECRET"];

for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  postgresUri: process.env.POSTGRES_URI,
  appUrl: process.env.APP_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "SyncNote <no-reply@syncnote.local>",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  graphqlIntrospection:
    String(process.env.GRAPHQL_INTROSPECTION || "").toLowerCase() === "true" ||
    (process.env.NODE_ENV || "development") !== "production",
  graphqlDocsEnabled:
    String(process.env.GRAPHQL_DOCS_ENABLED || "").toLowerCase() === "true" ||
    (process.env.NODE_ENV || "development") !== "production"
  ,
  // Yjs persistence tuning
  yjsSnapshotDebounceMs: Number(process.env.YJS_SNAPSHOT_DEBOUNCE_MS) || 2000,
  // Persist a full snapshot after this many incremental updates (0 = disabled)
  yjsSnapshotEveryUpdates: Number(process.env.YJS_SNAPSHOT_EVERY_UPDATES) || 100,
  // Keep at most this many history rows per document (0 = keep all)
  yjsHistoryKeepRows: Number(process.env.YJS_HISTORY_KEEP_ROWS) || 1000,
  // Also delete history rows older than this many days (0 = disabled)
  yjsHistoryMaxAgeDays: Number(process.env.YJS_HISTORY_MAX_AGE_DAYS) || 30
};

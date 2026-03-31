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
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  graphqlIntrospection:
    String(process.env.GRAPHQL_INTROSPECTION || "").toLowerCase() === "true" ||
    (process.env.NODE_ENV || "development") !== "production"
};

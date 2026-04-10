import { printSchema } from "graphql";
import { schema } from "./src/graphql/schema.js";

export default {
  introspection: {
    type: "raw",
    content: printSchema(schema)
  },
  website: {
    template: "carbon-multi-page",
    templateVersion: "6.2.0",
    output: "./public/graphql-docs",
    options: {
      appTitle: "SyncNote GraphQL API",
      siteRoot: "/docs/graphql"
    }
  },
  dev: {
    watch: [
      "./magidoc.mjs",
      "./src/graphql/schema.js",
      "./src/graphql/typeDefs.js",
      "./src/graphql/resolvers.js"
    ]
  }
};

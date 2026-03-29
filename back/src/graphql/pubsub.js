import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const EVENTS = {
  DOCUMENT_UPDATED: "DOCUMENT_UPDATED",
  COMMENT_ADDED: "COMMENT_ADDED"
};

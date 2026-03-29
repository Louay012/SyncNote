"use client";

import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  split,
  from
} from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

const HTTP_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_HTTP || "http://localhost:4000/graphql";
const WS_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_WS || "ws://localhost:4000/graphql";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function createApolloClient(token) {
  const httpLink = new HttpLink({
    uri: HTTP_URL,
    headers: authHeader(token)
  });

  const wsLink =
    typeof window === "undefined"
      ? null
      : new GraphQLWsLink(
          createClient({
            url: WS_URL,
            connectionParams: authHeader(token),
            shouldRetry: () => true
          })
        );

  const splitLink =
    typeof window !== "undefined" && wsLink
      ? split(
          ({ query }) => {
            const definition = getMainDefinition(query);
            return (
              definition.kind === "OperationDefinition" &&
              definition.operation === "subscription"
            );
          },
          wsLink,
          httpLink
        )
      : httpLink;

  return new ApolloClient({
    link: from([splitLink]),
    cache: new InMemoryCache()
  });
}

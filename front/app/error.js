"use client";

import ErrorPage from "@/components/ErrorPage";

export default function GlobalError({ error, reset }) {
  return <ErrorPage error={error} reset={reset} />;
}

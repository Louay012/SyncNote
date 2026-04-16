"use client"

import React, { useEffect, useState } from "react"
import Diary from "../../components/diary/DiaryLayout"
import { createApolloClient } from "@/lib/apollo"
import { GET_ME, CREATE_DOCUMENT } from "@/lib/graphql"

export default function DiaryPage() {
  const [documentId, setDocumentId] = useState(null)

  useEffect(() => {
    let mounted = true
    const client = createApolloClient("")

    ;(async () => {
      try {
        const { data } = await client.query({ query: GET_ME, fetchPolicy: "network-only" })
        const userId = data?.me?.id
        if (!userId) return

        const key = `diary:documentId:${userId}`
        const existing = typeof window !== "undefined" ? localStorage.getItem(key) : null
        if (existing) {
          if (mounted) setDocumentId(existing)
          return
        }

        const res = await client.mutate({
          mutation: CREATE_DOCUMENT,
          variables: { title: "Diary", content: "", isPublic: false }
        })
        const newId = res?.data?.createDocument?.id
        if (newId) {
          try { localStorage.setItem(key, newId) } catch (e) {}
          if (mounted) setDocumentId(newId)
        }
      } catch (e) {
        console.warn("DiaryPage: failed to ensure diary document", e)
      }
    })()

    return () => { mounted = false }
  }, [])

  return (
    <main>
      <Diary documentId={documentId} />
    </main>
  )
}

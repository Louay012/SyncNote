"use client";

import { useQuery, useMutation, gql } from "@apollo/client";
import { useCallback } from "react";

const LIST_DIARY_ENTRIES = gql`
  query ListDiaryEntries($documentId: ID!) {
    listDiaryEntries(documentId: $documentId) {
      id
      date
      mood
      text
      wordCount
      pageNumber
      createdAt
      updatedAt
    }
  }
`;

const CREATE_DIARY_ENTRY = gql`
  mutation CreateDiaryEntry($documentId: ID!, $date: String, $mood: String, $text: String!, $pageNumber: Int) {
    createDiaryEntry(documentId: $documentId, date: $date, mood: $mood, text: $text, pageNumber: $pageNumber) {
      id
      date
      mood
      text
      wordCount
      pageNumber
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_DIARY_ENTRY = gql`
  mutation UpdateDiaryEntry($id: ID!, $mood: String, $text: String!) {
    updateDiaryEntry(id: $id, mood: $mood, text: $text) {
      id
      date
      mood
      text
      wordCount
      pageNumber
      createdAt
      updatedAt
    }
  }
`;

export default function useDiaryEntries(documentId) {
  const { data, loading, error, refetch } = useQuery(LIST_DIARY_ENTRIES, { variables: { documentId }, skip: !documentId });

  const [createMutation] = useMutation(CREATE_DIARY_ENTRY);
  const [updateMutation] = useMutation(UPDATE_DIARY_ENTRY);

  // entries are returned ordered by pageNumber ascending from server; preserve that order
  const entries = (data && data.listDiaryEntries) ? data.listDiaryEntries.slice() : [];

  const createEntry = useCallback(async ({ date, mood = null, text = '' }) => {
    try {
      const vars = { documentId, date, mood, text };
      const res = await createMutation({ variables: vars });
      return res?.data?.createDiaryEntry || null;
    } catch (e) {
      console.warn('createDiaryEntry failed', e);
      return null;
    }
  }, [createMutation, documentId]);

  const updateEntry = useCallback(async (id, { mood = null, text = '' }) => {
    try {
      const vars = { id, mood, text };
      const res = await updateMutation({ variables: vars });
      return res?.data?.updateDiaryEntry || null;
    } catch (e) {
      console.warn('updateDiaryEntry failed', e);
      return null;
    }
  }, [updateMutation]);

  return {
    entries,
    loading,
    error,
    refetch,
    createEntry,
    updateEntry
  };
}

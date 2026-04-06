"use client";

import Color from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeStoredRichDocString, parseStoredRichDoc } from "@/lib/richTextDoc";

const remoteCursorPluginKey = new PluginKey("remoteCursorDecorations");

function buildRemoteCursorDecorations(doc, cursors = []) {
  const decorations = [];
  const maxPosition = Math.max(Number(doc?.content?.size) || 1, 1);

  cursors.forEach((entry) => {
    const userId = String(entry?.userId || "").trim();
    if (!userId) {
      return;
    }

    const from = Math.max(Number(entry?.from) || 1, 1);
    const position = Math.min(from, maxPosition);
    const color = entry?.cursorColor || null;
    const label = String(entry?.user?.name || "User").slice(0, 14);

    decorations.push(
      Decoration.widget(
        position,
        () => {
          const wrapper = document.createElement("span");
          wrapper.className = "rt-remote-cursor-wrap";

          const caret = document.createElement("span");
          caret.className = "rt-remote-cursor";
          if (color?.border) {
            caret.style.borderLeftColor = color.border;
          }

          const nameTag = document.createElement("span");
          nameTag.className = "rt-remote-cursor-label";
          nameTag.textContent = label;
          if (color?.bg) {
            nameTag.style.backgroundColor = color.bg;
          }
          if (color?.fg) {
            nameTag.style.color = color.fg;
          }
          if (color?.border) {
            nameTag.style.borderColor = color.border;
          }

          wrapper.append(caret, nameTag);
          return wrapper;
        },
        {
          side: -1,
          key: `remote-cursor-${userId}-${Number(entry?.seq) || 0}`
        }
      )
    );
  });

  return DecorationSet.create(doc, decorations);
}

const RemoteCursorExtension = Extension.create({
  name: "remoteCursorDecorations",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: remoteCursorPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(transaction, oldState) {
            const meta = transaction.getMeta(remoteCursorPluginKey);
            if (meta?.type === "set-remote-cursors") {
              return buildRemoteCursorDecorations(
                transaction.doc,
                Array.isArray(meta.cursors) ? meta.cursors : []
              );
            }

            if (transaction.docChanged) {
              return oldState.map(transaction.mapping, transaction.doc);
            }

            return oldState;
          }
        },
        props: {
          decorations(state) {
            return remoteCursorPluginKey.getState(state);
          }
        }
      })
    ];
  }
});

export default function RichTextEditor({
  value,
  disabled,
  onChange,
  onCursorOffsetChange,
  remoteCursors = []
}) {
  const [colorValue, setColorValue] = useState("#05668d");
  const suppressExternalOnChangeRef = useRef(false);

  const normalizedValue = useMemo(() => normalizeStoredRichDocString(value), [value]);

  function emitCursorPosition(currentEditor, options = {}) {
    const { requireFocus = true } = options;

    if (!currentEditor) {
      return;
    }

    if (requireFocus && !currentEditor.isFocused) {
      return;
    }

    const from = Math.max(Number(currentEditor.state.selection?.from) || 1, 1);
    const to = Math.max(Number(currentEditor.state.selection?.to) || from, from);

    onCursorOffsetChange?.({ from, to });
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      RemoteCursorExtension
    ],
    content: parseStoredRichDoc(normalizedValue),
    editorProps: {
      attributes: {
        class: "rt-editor-content"
      }
    },
    onFocus({ editor: currentEditor }) {
      emitCursorPosition(currentEditor, { requireFocus: false });
    },
    onUpdate({ editor: currentEditor }) {
      if (!suppressExternalOnChangeRef.current) {
        onChange?.(JSON.stringify(currentEditor.getJSON()));
      }
      emitCursorPosition(currentEditor);
    },
    onSelectionUpdate({ editor: currentEditor }) {
      emitCursorPosition(currentEditor);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = JSON.stringify(editor.getJSON());
    if (current !== normalizedValue) {
      const previousFrom = Math.max(Number(editor.state.selection?.from) || 1, 1);
      const previousTo = Math.max(Number(editor.state.selection?.to) || previousFrom, previousFrom);
      const previousDocSize = Math.max(Number(editor.state.doc.content?.size) || 1, 1);
      const shouldPreserveSelection = Boolean(editor.isFocused);

      suppressExternalOnChangeRef.current = true;
      try {
        editor.commands.setContent(parseStoredRichDoc(normalizedValue), false);

        if (!shouldPreserveSelection) {
          return;
        }

        const nextDocSize = Math.max(Number(editor.state.doc.content?.size) || 1, 1);
        const sizeDelta = nextDocSize - previousDocSize;

        const maxPosition = nextDocSize;
        const shiftedFrom = previousFrom + sizeDelta;
        const shiftedTo = previousTo + sizeDelta;
        const nextFrom = Math.min(Math.max(shiftedFrom, 1), maxPosition);
        const nextTo = Math.min(Math.max(shiftedTo, nextFrom), maxPosition);

        editor.commands.setTextSelection({ from: nextFrom, to: nextTo });
      } finally {
        suppressExternalOnChangeRef.current = false;
      }
    }
  }, [editor, normalizedValue]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.view.dispatch(
      editor.state.tr.setMeta(remoteCursorPluginKey, {
        type: "set-remote-cursors",
        cursors: remoteCursors
      })
    );
  }, [editor, remoteCursors]);

  function applyColor() {
    if (!editor) {
      return;
    }

    editor.chain().focus().setColor(colorValue).run();
  }

  return (
    <div className="rt-editor-shell">
      <div className="rt-toolbar" role="toolbar" aria-label="Rich text tools">
        <button
          type="button"
          className={editor?.isActive("bold") ? "format-btn active" : "format-btn"}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor || disabled}
        >
          Bold
        </button>
        <button
          type="button"
          className={editor?.isActive("underline") ? "format-btn active" : "format-btn"}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={!editor || disabled}
        >
          Underline
        </button>
        <label className="format-color-label">
          Text color
          <input
            type="color"
            className="format-color-input"
            value={colorValue}
            onChange={(event) => setColorValue(event.target.value)}
            disabled={!editor || disabled}
            aria-label="Pick text color"
          />
        </label>
        <button
          type="button"
          className="format-btn"
          onClick={applyColor}
          disabled={!editor || disabled}
        >
          Apply color
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

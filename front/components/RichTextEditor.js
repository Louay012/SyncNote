"use client";
const FONT_OPTIONS = [
  { label: "Curved Script", value: "'Brush Script MT', cursive" },
  { label: "Uncial", value: "Uncial, serif" },
  { label: "Plume", value: "'Comic Sans MS', cursive, sans-serif" },
  { label: "Cinzel Decorative", value: "'Cinzel Decorative', serif" },
  { label: "Fraktur", value: "'UnifrakturCook', cursive" },
  { label: "Serif", value: "serif" }
];

import Color from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
const preservedSelectionPluginKey = new PluginKey("preservedSelection");
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import TextStyle from "@tiptap/extension-text-style";
// Custom TextStyle extension to support fontFamily and fontSize
const CustomTextStyle = TextStyle.extend({
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily?.trim() || null,
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) return {};
              return { style: `font-family: ${attributes.fontFamily}` };
            }
          },
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            }
          }
        }
      }
    ];
  }
});
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeStoredRichDocString, parseStoredRichDoc } from "@/lib/richTextDoc";

// NOTE: manual remote-cursor decorations have been removed in favor of
// TipTap's built-in CollaborationCursor extension which integrates with
// the Yjs provider/awareness channel. See RealtimeEditor for provider wiring.

const FontSizeExtension = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"]
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }

              return {
                style: `font-size: ${attributes.fontSize}`
              };
            }
          }
        }
      }
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
        }
    };
  }
});

import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'

export default function RichTextEditor({
  value,
  disabled,
  onChange,
  // `remoteCursors` (socket/legacy feed) removed — use CollaborationCursor only
  storyMode = false,
  onSetEditorStyle,
  storyPaperId = "aged-scroll",
  storyPaperOptions = [],
  onStoryPaperChange,
  // optional Yjs integration
  ydoc = null,
  provider = null,
  user = null
}) {
  const [fontFamilyValue, setFontFamilyValue] = useState(FONT_OPTIONS[0].value);

  function applyFontFamily() {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontFamily: fontFamilyValue }).run();
  }
  const [colorValue, setColorValue] = useState("#05668d");
  const [fontSizeValue, setFontSizeValue] = useState("38");
  const suppressExternalOnChangeRef = useRef(false);
  const preservedSelectionRef = useRef(null);
  const previousSelectionRef = useRef(null);

  const normalizedValue = useMemo(() => normalizeStoredRichDocString(value), [value]);

  // Legacy socket-based cursor emission removed. Use Yjs awareness +
  // TipTap CollaborationCursor to publish local selection and render
  // remote cursors. Manual emission and socket fallbacks were removed
  // to avoid duplicate cursor traffic and race conditions.

  const extensions = useMemo(() => {
    const exts = [
      StarterKit.configure({ history: false }),
      Underline,
      CustomTextStyle,
      // preserved selection plugin
      new Plugin({
        key: preservedSelectionPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(transaction, oldState) {
            const meta = transaction.getMeta(preservedSelectionPluginKey);
            if (meta?.type === "set-preserved-selection") {
              if (meta?.from == null || meta?.to == null) return DecorationSet.empty;
              const deco = Decoration.inline(meta.from, meta.to, { class: "pm-preserved-selection" });
              return DecorationSet.create(transaction.doc, [deco]);
            }

            if (transaction.docChanged) {
              return oldState.map(transaction.mapping, transaction.doc);
            }

            return oldState;
          }
        },
        props: {
          decorations(state) {
            return preservedSelectionPluginKey.getState(state);
          }
        }
      }),
      Color,
      // RemoteCursorExtension removed — rely on CollaborationCursor + awareness.
    ];

    if (ydoc) {
      // TipTap Collaboration expects a Y.Doc. Explicitly bind to the
      // 'prosemirror' XmlFragment so all clients use the same field.
      exts.push(Collaboration.configure({ document: ydoc, field: 'prosemirror' }));
    }

    // Only add CollaborationCursor when a real provider and ydoc are available.
    // Do NOT pass a `user` fallback here — rely on the provider.awareness
    // states written by the application (server-provided auth name). If a
    // local `user` is passed here the extension may use it as a fallback
    // for rendering remote cursors which can cause every cursor to show the
    // same name. The app writes the authoritative `user` into awareness.
    if (provider && provider.awareness && ydoc) {
      // Pass provider and a custom render function so labels are
      // truncated, centered, and colored based on awareness user colors.
      const truncateName = (n) => {
        try {
          if (!n) return "";
          const s = String(n);
          return s.length > 8 ? `${s.slice(0, 8)}...` : s;
        } catch (e) {
          return String(n || "");
        }
      };

      const hexToRgb = (hex) => {
        if (!hex) return null;
        const m = String(hex).replace('#', '');
        if (m.length === 3) {
          return [parseInt(m[0] + m[0], 16), parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16)];
        }
        if (m.length !== 6) return null;
        return [parseInt(m.substring(0, 2), 16), parseInt(m.substring(2, 4), 16), parseInt(m.substring(4, 6), 16)];
      };

      const getContrast = (hex) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return '#ffffff';
        const [r, g, b] = rgb;
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return lum > 0.5 ? '#000000' : '#ffffff';
      };

      exts.push(
        CollaborationCursor.configure({
          provider,
          render: (u) => {
            try {
              const bg = u?.color || '#007aff';
              const fg = u?.colorFg || getContrast(bg);

              // Wrapper whose color property will be inherited by the caret
              // (so caret can use currentColor). We then style the label
              // explicitly for text/background colors.
              const caret = document.createElement('span');
              caret.className = 'collaboration-cursor__caret';
              // caret will inherit currentColor for border; set it directly
              caret.style.color = bg;

              const label = document.createElement('span');
              label.className = 'collaboration-cursor__label';
              label.style.backgroundColor = bg;
              label.style.color = fg;
              label.style.display = 'inline-flex';
              label.style.alignItems = 'center';
              label.style.justifyContent = 'center';
              label.textContent = truncateName(u?.name || '');

              // Append label as a child of the caret so absolute positioning
              // is anchored to the caret element (prevents labels sticking
              // to the top of the document).
              caret.appendChild(label);
              return caret;
            } catch (e) {
              const fallback = document.createElement('span');
              fallback.className = 'collaboration-cursor__label';
              fallback.textContent = u?.name || '';
              return fallback;
            }
          }
        })
      );
    }

    // If no provider/ydoc present, do not add any manual cursor rendering.

    return exts;
  }, [ydoc, provider, user]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: ydoc ? undefined : parseStoredRichDoc(normalizedValue),
    editorProps: {
      attributes: {
        class: "rt-editor-content"
      }
    },
    onFocus({ editor: currentEditor }) {
      // selection emission handled via provider.awareness in onSelectionUpdate
    },
    onUpdate({ editor: currentEditor }) {
      if (!suppressExternalOnChangeRef.current) {
        onChange?.(JSON.stringify(currentEditor.getJSON()));
      }
      // selection emission handled via provider.awareness in onSelectionUpdate
    },
    onSelectionUpdate({ editor: currentEditor }) {
      // selection will be written into provider.awareness below (if provider present)

      // When using a Yjs provider, write precise ProseMirror positions
      // (anchor/head) into the provider.awareness `selection` field so
      // remote peers receive exact positions rather than coarse line info.
      try {
        if (provider && provider.awareness && provider.__isSynced && currentEditor && currentEditor.state) {
          const sel = currentEditor.state.selection || {};
          const anchor = Number(sel.anchor || 0) || 0;
          const head = Number(sel.head || 0) || 0;
          // avoid noisy writes by comparing previous selection
          if (!previousSelectionRef.current || previousSelectionRef.current.anchor !== anchor || previousSelectionRef.current.head !== head) {
            previousSelectionRef.current = { anchor, head };
            try {
              const docSize = currentEditor?.state?.doc?.content?.size || null;
              provider.awareness.setLocalStateField('selection', { anchor, head, docSize });
            } catch (e) {
              // ignore awareness write errors
            }
          }
        }
      } catch (e) {}

      const currentFontSize = String(currentEditor.getAttributes("textStyle")?.fontSize || "").trim();
      if (currentFontSize.endsWith("px")) {
        const numericFontSize = Number.parseInt(currentFontSize, 10);
        if (Number.isFinite(numericFontSize)) {
          setFontSizeValue(String(numericFontSize));
        }
      }
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    // If a Yjs doc/provider is present, we are in collaboration mode.
    // Do NOT call `editor.commands.setContent` while collaborating —
    // TipTap will replace the document and break CRDT sync. Only
    // initialize content when not using Yjs.
    if (ydoc || provider) {
      return;
    }

    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    // Do not call setContent when the editor is connected to a Y.Doc/provider
    // — this will overwrite live CRDT state and break collaboration.
    if (ydoc || provider) return;

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

  // Manual socket-driven remote cursor decorations removed. Use
  // TipTap's CollaborationCursor (awareness) when a provider is available.


  function preserveSelectionAndRun(fn) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    fn();
    // Restore selection
    editor.commands.setTextSelection({ from, to });
  }

  function applyColor() {
    preserveSelectionAndRun(() => {
      editor.chain().focus().setColor(colorValue).run();
    });
  }

  function applyFontSize() {
    const parsed = Number.parseInt(String(fontSizeValue), 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clampedSize = Math.min(72, Math.max(12, parsed));
    setFontSizeValue(String(clampedSize));
    if (!editor) return;

    // Use preserved selection (captured when the font-size control was used)
    const sel = preservedSelectionRef.current || {
      from: Math.max(Number(editor.state.selection?.from) || 1, 1),
      to: Math.max(Number(editor.state.selection?.to) || 1, 1)
    };

    // Apply mark to the preserved selection and restore focus
    editor
      .chain()
      .focus()
      .setTextSelection({ from: sel.from, to: sel.to })
      .setMark('textStyle', { fontSize: `${clampedSize}px` })
      .run();

    // Ensure editor regains DOM focus and selection is visible
    try {
      setTimeout(() => {
        try {
          if (editor?.view?.focus) editor.view.focus();
          editor.commands.setTextSelection({ from: sel.from, to: sel.to });
        } catch (e) {
          // ignore
        }
      }, 0);
    } catch (e) {
      // ignore
    }

    // clear preserved selection and decoration
    preservedSelectionRef.current = null;
    try {
      editor.view.dispatch(
        editor.state.tr.setMeta(preservedSelectionPluginKey, {
          type: "set-preserved-selection",
          from: null,
          to: null
        })
      );
    } catch (e) {}
  }

  function changeFontSize(delta) {
    if (!editor) return;
    const parsed = Number.parseInt(String(fontSizeValue), 10) || 0;
    const next = Math.min(72, Math.max(12, parsed + delta));
    setFontSizeValue(String(next));

    const sel = preservedSelectionRef.current || {
      from: Math.max(Number(editor.state.selection?.from) || 1, 1),
      to: Math.max(Number(editor.state.selection?.to) || 1, 1)
    };

    // restore selection and apply immediately
    editor
      .chain()
      .focus()
      .setTextSelection({ from: sel.from, to: sel.to })
      .setMark('textStyle', { fontSize: `${next}px` })
      .run();

    // ensure selection visible
    setTimeout(() => {
      try {
        if (editor?.view?.focus) editor.view.focus();
        editor.commands.setTextSelection({ from: sel.from, to: sel.to });
      } catch (e) {}
    }, 0);

    // clear preserved selection decoration
    preservedSelectionRef.current = null;
    try {
      editor.view.dispatch(
        editor.state.tr.setMeta(preservedSelectionPluginKey, {
          type: "set-preserved-selection",
          from: null,
          to: null
        })
      );
    } catch (e) {}
  }

  function applyFontFamily() {
    preserveSelectionAndRun(() => {
      editor.chain().focus().setMark('textStyle', { fontFamily: fontFamilyValue }).run();
    });
  }

  return (
    <div className="rt-editor-shell">
      <div className="rt-toolbar" role="toolbar" aria-label="Rich text tools" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={editor?.isActive("bold") ? "format-btn icon-btn active" : "format-btn icon-btn"}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
          title="Bold"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={editor?.isActive("underline") ? "format-btn icon-btn active" : "format-btn icon-btn"}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={!editor}
          title="Underline"
          aria-label="Underline"
        >
          U
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
          <label className="format-color-label">
            Color
            <input
              type="color"
              className="format-color-input"
              value={colorValue}
              onChange={(event) => setColorValue(event.target.value)}
              disabled={!editor}
              aria-label="Pick text color"
            />
          </label>
          <button
            type="button"
            className="format-btn icon-btn"
            onClick={applyColor}
            disabled={!editor}
            title="Apply text color"
            aria-label="Apply text color"
          >
            C
          </button>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
          <label className="font-size-label" aria-label="Font size">
            Size
            <span style={{ marginLeft: 8, minWidth: 44, textAlign: 'center', fontWeight: 600 }}>{fontSizeValue}px</span>
          </label>

          <button
            type="button"
            className="format-btn icon-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              if (!editor) return;
              const from = Math.max(Number(editor.state.selection?.from) || 1, 1);
              const to = Math.max(Number(editor.state.selection?.to) || from, from);
              preservedSelectionRef.current = { from, to };
              try {
                editor.view.dispatch(
                  editor.state.tr.setMeta(preservedSelectionPluginKey, {
                    type: "set-preserved-selection",
                    from,
                    to
                  })
                );
              } catch (e) {}
              changeFontSize(-1);
            }}
            disabled={!editor}
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            A-
          </button>

          <button
            type="button"
            className="format-btn icon-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              if (!editor) return;
              const from = Math.max(Number(editor.state.selection?.from) || 1, 1);
              const to = Math.max(Number(editor.state.selection?.to) || from, from);
              preservedSelectionRef.current = { from, to };
              try {
                editor.view.dispatch(
                  editor.state.tr.setMeta(preservedSelectionPluginKey, {
                    type: "set-preserved-selection",
                    from,
                    to
                  })
                );
              } catch (e) {}
              changeFontSize(1);
            }}
            disabled={!editor}
            title="Increase font size"
            aria-label="Increase font size"
          >
            A+
          </button>
        </span>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}


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

export default function RichTextEditor({
  value,
  disabled,
  onChange,
  onCursorOffsetChange,
  remoteCursors = [],
  storyMode = false,
  onSetEditorStyle,
  storyPaperId = "aged-scroll",
  storyPaperOptions = [],
  onStoryPaperChange
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
      CustomTextStyle,
      // Plugin to render a preserved selection decoration when editor loses native focus
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
          disabled={!editor || disabled}
          title="Bold"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={editor?.isActive("underline") ? "format-btn icon-btn active" : "format-btn icon-btn"}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={!editor || disabled}
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
              disabled={!editor || disabled}
              aria-label="Pick text color"
            />
          </label>
          <button
            type="button"
            className="format-btn icon-btn"
            onClick={applyColor}
            disabled={!editor || disabled}
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
            disabled={!editor || disabled}
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
            disabled={!editor || disabled}
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
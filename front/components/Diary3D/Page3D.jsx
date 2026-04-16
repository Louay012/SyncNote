"use client"

import React, { useRef, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox, Html } from "@react-three/drei"
import * as THREE from "three"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"

export default function Page3D({
  index,
  frontContent,
  backContent,
  // optional HTML content (string) used by the rich editor
  frontHTML,
  backHTML,
  position = [0, 0, 0],
  isActive = false,
  animating = false,
  flipped = false,
  onClick,
  onFlipEnd,
  // called with (index, html)
  onContentChange,
  // when true the page renders an editable TipTap editor
  editing = false,
  colors = {},
  width = 3,
  height = 4,
  depth = 0.05,
  duration = 0.8,
}) {
  const meshRef = useRef()
  const animStart = useRef(null)
  const finished = useRef(false)
  const hovered = useRef(false)

  const [frontColor, setFrontColor] = useState(colors.pageBg || "#fffdf6")
  const [backColor, setBackColor] = useState(colors.pageBackBg || "#f7efe3")
  const [textColor, setTextColor] = useState(colors.textColor || "#222")
  const editorRef = useRef({ timer: null })

  // useEditor expects an options object; set `immediatelyRender` based on
  // `editing` so TipTap will only instantiate the editor when needed.
  const editor = useEditor({
    immediatelyRender: editing,
    extensions: [StarterKit],
    content: frontHTML || "<p></p>",
    onUpdate: ({ editor }) => {
      if (typeof onContentChange === "function") {
        if (editorRef.current.timer) clearTimeout(editorRef.current.timer)
        editorRef.current.timer = setTimeout(() => {
          onContentChange(index, editor.getHTML())
        }, 220)
      }
    },
  })

  useEffect(() => {
    setFrontColor(colors.pageBg || "#fffdf6")
    setBackColor(colors.pageBackBg || "#f7efe3")
    setTextColor(colors.textColor || "#222")
  }, [colors])

  useEffect(() => {
    // initialize rotation instantly when not animating
    if (!animating && meshRef.current) {
      meshRef.current.rotation.y = flipped ? -Math.PI : 0
      meshRef.current.rotation.x = 0
      finished.current = false
      animStart.current = null
    }
    if (animating) {
      finished.current = false
      animStart.current = null
    }
  }, [animating, flipped])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    // hover lift for active page
    const lift = hovered.current && isActive ? 0.06 : 0
    mesh.position.y = position[1] + lift
    mesh.position.x = position[0]
    mesh.position.z = position[2]

    // animate flip when animating flag is true
    if (animating && !finished.current) {
      if (animStart.current === null) animStart.current = state.clock.getElapsedTime()
      const elapsed = state.clock.getElapsedTime() - animStart.current
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const start = 0
      const end = flipped ? -Math.PI : 0
      mesh.rotation.y = THREE.MathUtils.lerp(start, end, ease)
      // slight page bending/curve on X for realism
      mesh.rotation.x = Math.sin(t * Math.PI) * 0.06

      if (t >= 1) {
        finished.current = true
        mesh.rotation.x = 0
        if (typeof onFlipEnd === "function") onFlipEnd(index)
      }
    }
  })

  function handlePointerOver(e) {
    e.stopPropagation()
    hovered.current = true
    document.body.style.cursor = "pointer"
  }
  function handlePointerOut(e) {
    e.stopPropagation()
    hovered.current = false
    document.body.style.cursor = ""
  }
  function handlePointerDown(e) {
    e.stopPropagation()
    if (!isActive) return
    // if currently editing, let the editor handle pointer events
    if (editing) return
    if (typeof onClick === "function") onClick(index)
  }

  return (
    <group>
      <RoundedBox
        ref={meshRef}
        args={[width, height, depth]}
        radius={0.08}
        smoothness={6}
        castShadow
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
      >
        <meshStandardMaterial attach="material" color={frontColor} roughness={0.92} metalness={0.02} />
      </RoundedBox>

      {/* Front HTML content placed slightly above the surface. When editing, render TipTap editor */}
      <Html position={[0, 0, depth / 2 + 0.002]} transform occlude center>
        <div
          style={{
            width: `${width * 72}px`,
            height: `${height * 72}px`,
            pointerEvents: editing ? "auto" : "none",
            color: textColor,
            boxSizing: "border-box",
            padding: 12,
          }}
        >
          {editing && editor ? (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, background: "rgba(255,255,255,0.8)", padding: 6, borderRadius: 6 }}>
                <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor} style={{ fontWeight: "bold" }}>
                  B
                </button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor} style={{ fontStyle: "italic" }}>
                  I
                </button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} disabled={!editor}>
                  H1
                </button>
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={!editor}>
                  • List
                </button>
              </div>

              <div style={{ flex: 1, overflow: "auto", background: "transparent" }}>
                <EditorContent editor={editor} />
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>{frontContent}</div>
          )}
        </div>
      </Html>

      {/* Back HTML (rotated) */}
      <Html position={[0, 0, -depth / 2 - 0.002]} rotation={[0, Math.PI, 0]} transform occlude center>
        <div style={{ width: `${width * 72}px`, height: `${height * 72}px`, pointerEvents: "none", color: textColor }}>
          {backContent}
        </div>
      </Html>
    </group>
  )
}

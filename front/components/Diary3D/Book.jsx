"use client"

import React, { useMemo, useState, useCallback, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { PerspectiveCamera, ContactShadows } from "@react-three/drei"
import { useDiaryTheme } from "./ThemeProvider"
import Page3D from "./Page3D"
import styles from "./diary.module.css"

function PageContent({ title, body }) {
  return (
    <>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.body} dangerouslySetInnerHTML={{ __html: body }} />
    </>
  )
}

export default function Book({ initialPages }) {
  const defaultPages = useMemo(
    () =>
      initialPages && initialPages.length
        ? initialPages
        : Array.from({ length: 6 }).map((_, i) => ({ title: `Entry ${i + 1}`, body: `This is page ${i + 1}. Write your thoughts here.` })),
    [initialPages]
  )

  const [pages, setPages] = useState(defaultPages)
  const [order, setOrder] = useState(() => defaultPages.map((_, i) => i))
  const [flipped, setFlipped] = useState(() => defaultPages.map(() => false))
  const [animatingPage, setAnimatingPage] = useState(null)
  const [animDirection, setAnimDirection] = useState(null)
  const [movedToBack, setMovedToBack] = useState(() => defaultPages.map(() => false))
  const { theme, setTheme, themes } = useDiaryTheme()

  const total = pages.length
  const duration = 800 // ms

  const [editingIndex, setEditingIndex] = useState(null)

  useEffect(() => {
    // sync arrays when pages change (adding/removing pages)
    setFlipped((prev) => {
      if (pages.length === prev.length) return prev
      if (pages.length > prev.length) return [...prev, ...Array(pages.length - prev.length).fill(false)]
      return prev.slice(0, pages.length)
    })
    setOrder((prev) => {
      if (pages.length === prev.length) return prev
      if (pages.length > prev.length) return [...prev, ...Array(pages.length - prev.length).fill().map((_, i) => prev.length + i)]
      return prev.filter((idx) => idx < pages.length)
    })
    setMovedToBack((prev) => {
      if (pages.length === prev.length) return prev
      if (pages.length > prev.length) return [...prev, ...Array(pages.length - prev.length).fill(false)]
      return prev.slice(0, pages.length)
    })
  }, [pages])

  const handleAddPage = () => {
    const idx = pages.length
    const newPage = { title: `New Entry ${idx + 1}`, body: `Write something on page ${idx + 1}.` }
    setPages((p) => [...p, newPage])
    setOrder((o) => [...o, idx])
    setFlipped((f) => [...f, false])
  }

  const handleNext = useCallback(() => {
    if (animatingPage !== null || order.length <= 1) return
    const top = order[0]
    setAnimatingPage(top)
    setAnimDirection("next")
    setFlipped((prev) => {
      const copy = [...prev]
      copy[top] = true
      return copy
    })
    // move page to back halfway through the animation so it finishes behind the stack
    setTimeout(() => {
      setOrder((old) => [...old.slice(1), old[0]])
      setMovedToBack((m) => {
        const copy = [...m]
        copy[top] = true
        return copy
      })
    }, duration / 2)
  }, [animatingPage, order, duration])

  const handlePrev = useCallback(() => {
    if (animatingPage !== null || order.length <= 1) return
    const last = order[order.length - 1]
    setAnimatingPage(last)
    setAnimDirection("prev")
    setFlipped((prev) => {
      const copy = [...prev]
      copy[last] = false
      return copy
    })
    // bring page to front halfway so the flip appears to come from behind
    setTimeout(() => {
      setOrder((old) => {
        const lastIdx = old[old.length - 1]
        return [lastIdx, ...old.slice(0, old.length - 1)]
      })
    }, duration / 2)
  }, [animatingPage, order, duration])

  const handleFlipEnd = useCallback(
    (idx) => {
      if (animatingPage !== idx) return
      // clear animation state and reset flip so the page sits flat at back
      setAnimatingPage(null)
      setAnimDirection(null)
      setMovedToBack((m) => {
        const copy = [...m]
        if (typeof copy[idx] !== "undefined") copy[idx] = false
        return copy
      })
      setFlipped((f) => {
        const copy = [...f]
        if (typeof copy[idx] !== "undefined") copy[idx] = false
        return copy
      })
    },
    [animatingPage]
  )

  const onPageClick = (index) => {
    const pos = order.indexOf(index)
    if (pos === 0) handleNext()
    else if (pos === order.length - 1) handlePrev()
  }

  const activeIndex = order && order.length ? order[0] : null

  const handleContentChange = useCallback((idx, html) => {
    setPages((old) => old.map((pg, i) => (i === idx ? { ...pg, body: html } : pg)))
  }, [])

  // read CSS vars from theme root so materials match the page colors
  const [colors, setColors] = useState({ pageBg: "#fffdf6", pageBackBg: "#f7efe3", textColor: "#222", accent: "#b9733a" })
  useEffect(() => {
    const root = typeof document !== "undefined" ? document.getElementById("diary-root") : null
    if (!root) return
    const s = getComputedStyle(root)
    setColors({
      pageBg: s.getPropertyValue("--page-bg")?.trim() || "#fffdf6",
      pageBackBg: s.getPropertyValue("--page-back-bg")?.trim() || "#f7efe3",
      textColor: s.getPropertyValue("--text-color")?.trim() || "#222",
      accent: s.getPropertyValue("--accent")?.trim() || "#b9733a",
    })
  }, [theme])

  return (
    <div className={styles.bookWrap}>
      <div className={styles.controls}>
        <div className={styles.themeSwitcher}>
          <label htmlFor="theme-select">Theme</label>
          <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
            {themes.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.nav}>
          <button onClick={handlePrev} aria-label="Previous page" className={styles.navBtn} disabled={order.length <= 1}>
            ←
          </button>
          <button onClick={handleNext} aria-label="Next page" className={styles.navBtn} disabled={order.length <= 1}>
            →
          </button>
          <button
            onClick={() => setEditingIndex((cur) => (cur === activeIndex ? null : activeIndex))}
            aria-label="Edit page"
            className={styles.navBtn}
            disabled={activeIndex === null}
          >
            {editingIndex === activeIndex ? "Done" : "Edit"}
          </button>
          <button onClick={handleAddPage} aria-label="Add page" className={styles.addBtn}>
            + Add Page
          </button>
        </div>
      </div>

      <div className={styles.book} aria-hidden={false}>
        <div className={styles.binding} aria-hidden="true">
          <div className={styles.coil} />
        </div>

        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 50 }}>
          <color attach="background" args={["#0000"]} />
          <ambientLight intensity={0.6} />
          <directionalLight castShadow position={[5, 6, 5]} intensity={0.9} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005} />

          <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />

          {/* Slight tilt of the whole notebook for a floating look */}
          <group rotation={[0.12, 0, -0.06]} position={[0, -0.12, 0]}>
            {pages.map((p, pageIdx) => {
              const pos = order.indexOf(pageIdx)
              const isFlipped = !!flipped[pageIdx]
              const isActive = pos === 0
              const animating = animatingPage === pageIdx
              // depth and vertical offset to simulate a stacked book
              const z = 0.18 - pos * 0.03
              const y = -pos * 0.03
              return (
                <Page3D
                  key={pageIdx}
                  index={pageIdx}
                  frontContent={<PageContent title={p.title} body={p.body} />}
                  backContent={<PageContent title={p.backTitle || ""} body={p.backBody || ""} />}
                  frontHTML={p.body}
                  backHTML={p.backBody || ""}
                  editing={editingIndex === pageIdx}
                  onContentChange={handleContentChange}
                  position={[0, y, z]}
                  isActive={isActive}
                  animating={animating}
                  flipped={isFlipped}
                  onClick={onPageClick}
                  onFlipEnd={handleFlipEnd}
                  duration={duration / 1000}
                  colors={colors}
                />
              )
            })}
          </group>

          <ContactShadows position={[0, -2.2, 0]} opacity={0.4} scale={8} blur={2} far={3} />
        </Canvas>
      </div>
    </div>
  )
}

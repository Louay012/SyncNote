"use client"

import React, { useEffect, useRef } from "react"
import styles from "./diary.module.css"

export default function Page({ index, frontContent, backContent, flipped, isActive, onFlipStart, onFlipEnd, zIndex, animating }) {
  const rootRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.style.zIndex = typeof zIndex !== "undefined" ? zIndex : 0
    const base = `${flipped ? "rotateY(-180deg)" : "rotateY(0deg)"} ${isActive ? "translateZ(40px) scale(1)" : "translateZ(0px) scale(0.96)"}`
    el.style.transition = "transform 0.8s cubic-bezier(0.2,0.85,0.2,1), box-shadow 0.6s"
    el.style.transform = base
  }, [flipped, isActive, zIndex])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const handler = (e) => {
      if (e.propertyName === "transform" && typeof onFlipEnd === "function") {
        onFlipEnd(index)
      }
    }
    el.addEventListener("transitionend", handler)
    return () => el.removeEventListener("transitionend", handler)
  }, [index, onFlipEnd])

  const onMouseMove = (e) => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    const tiltX = -y * 6
    const tiltZ = x * 3
    const baseFlip = flipped ? "rotateY(-180deg)" : "rotateY(0deg)"
    const baseScale = isActive ? "translateZ(40px) scale(1)" : "translateZ(0px) scale(0.96)"
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      el.style.transform = `${baseFlip} rotateX(${tiltX}deg) rotateZ(${tiltZ}deg) ${baseScale}`
      const shade = el.querySelector("." + styles.pageShade)
      if (shade) {
        shade.style.opacity = Math.min(Math.abs(x) * 2 + Math.abs(y), 0.9)
        shade.style.transform = `translateX(${x * 30}px)`
      }
    })
  }

  const onMouseLeave = () => {
    const el = rootRef.current
    if (!el) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const baseFlip = flipped ? "rotateY(-180deg)" : "rotateY(0deg)"
    const baseScale = isActive ? "translateZ(40px) scale(1)" : "translateZ(0px) scale(0.96)"
    el.style.transform = `${baseFlip} ${baseScale}`
    const shade = el.querySelector("." + styles.pageShade)
    if (shade) {
      shade.style.opacity = ""
      shade.style.transform = ""
    }
  }

  const handleClick = () => {
    if (typeof onFlipStart === "function") onFlipStart(index)
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.page} ${flipped ? styles.flipped : ""} ${isActive ? styles.pageActive : styles.pageInactive} ${animating ? styles.flipping : ""}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
    >
      <div className={`${styles.face} ${styles.front}`}>
        <div className={styles.content}>{frontContent}</div>
      </div>

      <div className={`${styles.face} ${styles.back}`}>
        <div className={styles.content}>{backContent}</div>
      </div>

      <div className={styles.pageShade} />
    </div>
  )
}

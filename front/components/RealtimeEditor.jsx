"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
// Dynamically import yjs and y-websocket on the client to avoid
// multiple Yjs instances during SSR/HMR which break constructor checks.
import RichTextEditor from "./RichTextEditor";
import { getCursorColor } from "@/lib/cursorColors";

const GET_DOC_SNAPSHOT = gql`
  query GetDocSnapshot($id: ID!) {
    document(id: $id) {
      id
      title
      snapshotBase64
    }
  }
`;

const SAVE_SNAPSHOT = gql`
  mutation SaveSnapshot($id: ID!, $snapshotBase64: String!) {
    saveDocumentSnapshot(documentId: $id, snapshotBase64: $snapshotBase64)
  }
`;

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64(u8) {
  let CHUNK = 0x8000;
  let i = 0;
  const parts = [];
  while (i < u8.length) {
    parts.push(String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK))));
    i += CHUNK;
  }
  return btoa(parts.join(""));
}

function normalizeColorString(c) {
  if (!c || typeof c !== "string") return c;
  try {
    // Match space-separated HSL/HSLA like 'hsl(50 75% 55%)' or 'hsl(50 75% 55% / 0.5)'
    const m = c.trim().match(/^(hsla?)\(\s*([0-9.+-]+)\s+([0-9.+-]+)%\s+([0-9.+-]+)%\s*(?:\/\s*([0-9.]+)\s*)?\)$/i);
    if (!m) return c;
    const fn = m[1].toLowerCase();
    const h = m[2];
    const s = m[3] + "%";
    const l = m[4] + "%";
    const a = m[5];
    if (a !== undefined) {
      // convert to hsla(h, s, l, a)
      return `hsla(${h}, ${s}, ${l}, ${a})`;
    }
    return `${fn}(${h}, ${s}, ${l})`;
  } catch (e) {
    return c;
  }
}

function rgbToHex(r, g, b) {
  const toHex = (v) => {
    const h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return h.length === 1 ? `0${h}` : h;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

function hslToRgb(h, s, l) {
  // h in degrees, s and l are fractions [0,1]
  h = ((h % 360) + 360) % 360 / 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function cssColorToHex(input) {
  if (!input) return null;
  let s = String(input).trim();

  // quick hex normalization
  const hexMatch = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    return `#${hex.toLowerCase()}`;
  }

  // Try browser normalization via canvas when available (client-only)
  try {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = s;
      const computed = ctx.fillStyle;
      if (computed && typeof computed === "string") {
        s = computed;
      }
    }
  } catch (e) {
    // ignore and fallback to manual parsing
  }

  // Normalize HSL spacing variants to comma style to simplify parsing
  s = normalizeColorString(s) || s;

  // rgb/rgba parsing
  const rgbMatch = s.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    let parts = rgbMatch[1].trim();
    // support "r, g, b" or "r g b" and optional "/ a" syntax
    let alpha = 1;
    if (parts.indexOf("/") !== -1) {
      const [rgbPart, aPart] = parts.split("/").map((p) => p.trim());
      parts = rgbPart;
      alpha = parseFloat(aPart) || 1;
    }
    const comps = parts.split(/[,\s]+/).filter(Boolean);
    if (comps.length >= 3) {
      const to255 = (v, i) => {
        if (v.endsWith("%")) return Math.round((parseFloat(v) / 100) * 255);
        return Math.round(parseFloat(v));
      };
      let r = to255(comps[0], 0);
      let g = to255(comps[1], 1);
      let b = to255(comps[2], 2);
      if (alpha < 1) {
        r = Math.round(r * alpha + 255 * (1 - alpha));
        g = Math.round(g * alpha + 255 * (1 - alpha));
        b = Math.round(b * alpha + 255 * (1 - alpha));
      }
      return rgbToHex(r, g, b);
    }
  }

  // hsl/hsla parsing
  const hslMatch = s.match(/^hsla?\(([^)]+)\)$/i);
  if (hslMatch) {
    let parts = hslMatch[1].trim();
    let alpha = 1;
    if (parts.indexOf("/") !== -1) {
      const [left, aPart] = parts.split("/").map((p) => p.trim());
      parts = left;
      alpha = parseFloat(aPart) || 1;
    }
    const comps = parts.split(/[,\s]+/).filter(Boolean);
    if (comps.length >= 3) {
      const h = parseFloat(comps[0]);
      const sPct = parseFloat(comps[1].replace("%", "")) / 100;
      const lPct = parseFloat(comps[2].replace("%", "")) / 100;
      let [r, g, b] = hslToRgb(h, sPct, lPct);
      if (alpha < 1) {
        r = Math.round(r * alpha + 255 * (1 - alpha));
        g = Math.round(g * alpha + 255 * (1 - alpha));
        b = Math.round(b * alpha + 255 * (1 - alpha));
      }
      return rgbToHex(r, g, b);
    }
  }

  return null;
}

function getContrastingColor(hex) {
  if (!hex) return '#000000';
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  // relative luminance
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.5 ? '#000000' : '#ffffff';
}

export default function RealtimeEditor({ documentId, wsUrl, authToken, getWsToken, user, onAutosaveStateChange, onCursorActivity }) {
  const { data, loading } = useQuery(GET_DOC_SNAPSHOT, { variables: { id: documentId } });
  const [saveSnapshot] = useMutation(SAVE_SNAPSHOT);

  useEffect(() => {
    try {
      // snapshot change observed
    } catch (e) {}
  }, [data, loading, documentId]);

  // Persist Y.Doc across renders using a ref so we do NOT recreate it
  // on every render. Use a small state counter to trigger re-renders when
  // the Y.Doc is first created.
  const ydocRef = useRef(null);
  const [ydocStateVersion, setYdocStateVersion] = useState(0);
  const ydoc = ydocRef.current;
  const yjsRef = useRef(null);
  const snapshotAppliedRef = useRef(null);
  // create a tiny stub provider so TipTap/CollaborationCursor can read `awareness` safely
  const stubProvider = useMemo(() => {
    const states = new Map();
    const listeners = { update: [], change: [] };
    return {
      awareness: {
        // keep a Map at `.states` because collaboration-cursor accesses `.states`
        states,
        // y-protocols awareness API
        getStates: () => states,
        getLocalState: () => states.get('local'),
        setLocalState: (state) => {
          states.set('local', state || {});
          // notify both kinds of listeners used by various libs
          (listeners.update || []).forEach((fn) => fn());
          (listeners.change || []).forEach((fn) => fn());
        },
        setLocalStateField: (field, value) => {
          const cur = states.get('local') || {};
          if (value === null) {
            delete cur[field];
          } else {
            cur[field] = value;
          }
          states.set('local', cur);
          (listeners.update || []).forEach((fn) => fn());
          (listeners.change || []).forEach((fn) => fn());
        },
        on: (ev, fn) => { if (!listeners[ev]) listeners[ev] = []; listeners[ev].push(fn); },
        off: (ev, fn) => { if (!listeners[ev]) return; listeners[ev] = listeners[ev].filter(f => f !== fn); }
      },
      on: () => {},
      off: () => {},
      destroy: () => {}
    };
  }, []);

  // start without a real provider so we can detect when a real provider
  // becomes available and remount the editor to initialize collaboration.
  const [provider, setProvider] = React.useState(() => null);
  const providerRef = useRef(null);
  
  // Track which provider instances we've already set local awareness for
  const localAwarenessSetMapRef = useRef(new WeakMap());
  const [awarenessCursors, setAwarenessCursors] = useState([]);
  // Local persistent id/color when server doesn't provide one.
  const localUserIdRef = useRef(
    user?.id || (typeof window !== "undefined" && window.localStorage?.getItem("syncnote_user_id")) || `anon-${Math.random().toString(36).slice(2,9)}`
  );

  useEffect(() => {
    if (!user?.id && typeof window !== "undefined") {
      try {
        window.localStorage.setItem("syncnote_user_id", localUserIdRef.current);
      } catch (e) {}
    }
  }, [user?.id]);

  const localColorRef = useRef((() => {
    const seed = String(localUserIdRef.current || "");
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h) + seed.charCodeAt(i) | 0;
    const hue = Math.abs(h) % 360;
    const generatedHsl = `hsl(${hue}, 75%, 55%)`;
    const provided = user?.color || generatedHsl;
    // Ensure a HEX color only; fall back to a safe default
    const hex = cssColorToHex(provided);
    return hex || '#007aff';
  })());

  const stableUser = useMemo(() => {
    const id = user?.id || localUserIdRef.current;
    const name = user?.name ?? null;
    // Deterministic palette color per-user; prefer explicit user color when provided.
    const palette = getCursorColor(id);
    const colorBg = cssColorToHex(user?.color) || (palette && palette.bg) || localColorRef.current || '#007aff';
    const colorFg = user?.colorFg || (palette && palette.fg) || getContrastingColor(colorBg) || '#ffffff';
    const colorBorder = user?.colorBorder || (palette && palette.border) || colorBg;
    return { id, name, color: colorBg, colorFg, colorBorder };
  }, [user?.id, user?.name, user?.color]);

  // Per-session short suffix to disambiguate identical display names across tabs
  const sessionSuffixRef = useRef(Math.random().toString(36).slice(2, 6));

  // create provider and ydoc on the client only
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    // mounted
    // Wait for authToken to be resolved by AuthProvider. `undefined` means
    // the auth state is still loading; do NOT initialize the provider yet.
    if (authToken === undefined) {
      // waiting for auth token
      return undefined;
    }

    // Wait for the initial snapshot query to complete so we can apply the
    // persisted state into the Y.Doc before creating the provider. Creating
    // the provider before applying the DB snapshot can cause a later apply
    // to overwrite live CRDT state.
    if (loading) {
      // waiting for snapshot load before creating provider
      return undefined;
    }

    const roomName = `doc-${documentId}`;

    let mounted = true;
    let prov = null;
    let refreshTimer = null;
    let docObserverAttached = false;

    function getTokenExpMs(token) {
      try {
        const parts = String(token || "").split(".");
        if (parts.length !== 3) return null;
        // base64url -> base64
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = JSON.parse(atob(payload));
        if (json && json.exp) return Number(json.exp) * 1000;
        return null;
      } catch (e) {
        return null;
      }
    }

    function clearRefreshTimer() {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
    }

    async function scheduleRefreshForToken(token) {
      try {
        clearRefreshTimer();
        const expMs = getTokenExpMs(token);
        let delay = 4.5 * 60 * 1000; // default 4.5 minutes
        if (expMs) {
          // refresh ~30s before expiry, but no earlier than ~4 minutes
          const msBefore = Math.max(expMs - Date.now() - 30_000, 4 * 60 * 1000);
          delay = msBefore;
        }

        refreshTimer = setTimeout(async () => {
          if (!mounted) return;
          try {
            let newToken = null;
            if (typeof getWsToken === "function") {
              newToken = await getWsToken({ force: true });
            } else {
              const r = await fetch("/ws-token", { credentials: "include" });
              if (r.ok) {
                const j = await r.json();
                newToken = j?.token || null;
              }
            }

            if (newToken) {
              // refreshed ws-token, rotating provider
              try {
                if (providerRef.current && providerRef.current.destroy) {
                  providerRef.current.destroy();
                }
              } catch (e) {}
              providerRef.current = null;
              setProvider(null);

              // create a new provider with the new token
              const WebsocketProvider = (await import("y-websocket")).WebsocketProvider || (await import("y-websocket")).default?.WebsocketProvider || (await import("y-websocket")).default || (await import("y-websocket"));
              const providerOpts = {};
              if (newToken) providerOpts.params = { token: newToken };
              // Use the persistent Y.Doc reference (create if missing).
              if (!ydocRef.current) {
                try {
                  const Y = await import("yjs");
                  ydocRef.current = new Y.Doc();
                  if (mounted) setYdocStateVersion((v) => v + 1);
                } catch (e) {
                  console.warn("RealtimeEditor: failed to create Y.Doc during refresh", e);
                }
              }
              const newProv = new WebsocketProvider(wsUrl, roomName, ydocRef.current, providerOpts);
              providerRef.current = newProv;
              if (mounted) setProvider(newProv);

              newProv.__isSynced = false;
              newProv.on("sync", (isSynced) => { newProv.__isSynced = Boolean(isSynced); });
              newProv.on("status", (ev) => {});

              const onAwarenessUpdate = () => { try { const states = Array.from(newProv.awareness.getStates().entries()); } catch (e) {} };
              const onAwarenessChange = () => { try { const states = Array.from(newProv.awareness.getStates().entries()); } catch (e) {} };

              newProv.awareness.on && newProv.awareness.on("update", onAwarenessUpdate);
              newProv.awareness.on && newProv.awareness.on("change", onAwarenessChange);

              // schedule next refresh
              scheduleRefreshForToken(newToken).catch(() => {});
            } else {
              console.error("RealtimeEditor: failed to refresh ws-token");
              // retry in 30s
              refreshTimer = setTimeout(() => scheduleRefreshForToken(token), 30_000);
            }
          } catch (e) {
            console.error("RealtimeEditor: token refresh error", e);
            // retry in 30s
            refreshTimer = setTimeout(() => scheduleRefreshForToken(token), 30_000);
          }
        }, delay);
      } catch (e) {}
    }

    (async () => {
      try {
        const Y = await import("yjs");
        // cache Y module for use in other synchronous handlers (e.g., sendBeacon)
        yjsRef.current = Y;
        const yws = await import("y-websocket");

        // create ydoc if not already present (persist in ref)
        let doc = ydocRef.current;
        if (!doc) {
          doc = new Y.Doc();
          ydocRef.current = doc;
          if (mounted) setYdocStateVersion((v) => v + 1);
        }

        // If we have a server snapshot available, apply it into the Y.Doc
        // before creating the WebsocketProvider so the provider syncs from
        // the persisted state instead of potentially overwriting it.
                try {
                const snapshotB64 = data?.document?.snapshotBase64;
                if (snapshotB64) {
                  const appliedKey = `${snapshotB64}::${doc.clientID || ""}`;
                  if (snapshotAppliedRef.current !== appliedKey) {
                    try {
                      const update = base64ToUint8Array(snapshotB64);
                      try { Y.applyUpdate(doc, update); } catch (e) { console.error('RealtimeEditor: Y.applyUpdate pre-init failed', e); }
                      snapshotAppliedRef.current = appliedKey;
                      try { setYdocStateVersion((v) => v + 1); } catch (e) {}
                    } catch (e) {
                      console.error("RealtimeEditor: failed to decode/apply pre-init snapshot", e);
                    }
                  }
                }
              } catch (e) {}

        // Determine the effective token to use for WebSocket auth.
        // If `authToken` is a string, use it directly (local token).
        // If `authToken` is null, the user is authenticated via httpOnly cookie
        // so request a short-lived JWT from the server via `getWsToken`.
        let effectiveToken = null;
        let tokenOriginShortLived = false;
        if (typeof authToken === "string" && authToken) {
          effectiveToken = authToken;
        } else if (authToken === null) {
          // Try AuthContext-provided helper first, otherwise call endpoint directly.
          if (typeof getWsToken === "function") {
            try {
              effectiveToken = await getWsToken();
            } catch (e) {
              console.error("RealtimeEditor: getWsToken failed", e);
            }
          } else {
            try {
              const r = await fetch("/ws-token", { credentials: "include" });
              if (r.ok) {
                const j = await r.json();
                effectiveToken = j?.token || null;
              }
            } catch (e) {
              console.error("RealtimeEditor: fetch /ws-token failed", e);
            }
          }

          if (!effectiveToken) {
            console.error("RealtimeEditor: no ws-token obtained; skipping y-websocket init");
            return;
          }
          tokenOriginShortLived = true;
        }

        const WebsocketProvider = yws.WebsocketProvider || yws.default?.WebsocketProvider || yws.default || yws;
        const providerOpts = {};
        if (effectiveToken) providerOpts.params = { token: effectiveToken };
        prov = new WebsocketProvider(wsUrl, roomName, doc, providerOpts);
        providerRef.current = prov;
        if (mounted) setProvider(prov);

        // Debug: log sync lifecycle event so we can see when docs become synced
          prov.__isSynced = false;
          prov.on("sync", (isSynced) => { prov.__isSynced = Boolean(isSynced); });
          prov.on('status', (ev) => {});

        // Expose provider and ydoc for easy debugging in the browser console
        if (typeof window !== "undefined") {
          try {
            window.__syncnote_provider = prov;
            window.__syncnote_ydoc = doc;
          } catch (e) {}
        }

        // awareness debug listeners (gate logs behind debug flag)
        const onAwarenessUpdate = () => {
          try {
            const states = Array.from(prov.awareness.getStates().entries());
          } catch (e) {
          }
        };

        const onAwarenessChange = () => {
          try {
            const states = Array.from(prov.awareness.getStates().entries());
          } catch (e) {
          }
        };

        prov.awareness.on && prov.awareness.on("update", onAwarenessUpdate);
        prov.awareness.on && prov.awareness.on("change", onAwarenessChange);

        // Log Y.Doc updates (local and remote) for debugging
        try {
            if (doc && doc.on && !docObserverAttached) {
            docObserverAttached = true;
            doc.on("update", (update) => {
              try {
                const len = update && (update.byteLength || update.length) ? (update.byteLength || update.length) : null;
              } catch (e) {}
            });
          }
        } catch (e) {}

        // Inspect common shared types used by editors (helpful to know if TipTap
        // created the expected types like a Text named 'content' or an XmlFragment
        // named 'prosemirror'). Attach observers so updates surface in console.
        try {
          if (doc) {
                if (typeof doc.getText === "function") {
              const yText = doc.getText("content");
              if (yText) {
                yText.observe(() => { /* content updated */ });
              }
            }

            if (typeof doc.getXmlFragment === "function") {
              const yXml = doc.getXmlFragment("prosemirror");
              if (yXml) {
                yXml.observe && yXml.observe(() => { /* prosemirror changed */ });
              }
            }
          }
        } catch (e) {
          // error inspecting ydoc (debug removed)
        }

        // Note: local awareness state will be initialized in a dedicated
        // effect so that it's always set after `provider` is available.

        // If token came from short-lived endpoint, schedule refresh before expiry
        if (tokenOriginShortLived && effectiveToken) {
          scheduleRefreshForToken(effectiveToken).catch(() => {});
        }
      } catch (err) {
        console.error("RealtimeEditor: failed to initialize y-websocket", err);
      }
    })();

    return () => {
      mounted = false;
      try { providerRef.current && providerRef.current.destroy && providerRef.current.destroy(); } catch (e) {}
      providerRef.current = null;
      setProvider(null);
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, wsUrl, authToken, loading, data]);

  // NOTE: snapshot is applied during provider initialization (before
  // creating the WebsocketProvider). Removing the separate post-init
  // snapshot application avoids accidentally applying a persisted state
  // after the provider is already active which can overwrite live edits.

  // NOTE: intentionally do NOT re-apply the DB snapshot after provider sync.
  // Applying a snapshot after Yjs/provider have initialized can overwrite
  // live CRDT state. The persisted snapshot is applied once during init
  // (before provider creation) in the provider initialization effect.

  // The rich editor UI is provided by `RichTextEditor` which accepts the
  // `ydoc` and `provider` to enable TipTap Collaboration + CollaborationCursor.

  // debounced snapshot saving
  useEffect(() => {

    let timer = null;
    let isSynced = false;

    const save = async () => {
      if (!ydoc) return;
      try {
        try { onAutosaveStateChange && onAutosaveStateChange("saving"); } catch (e) {}
        const { encodeStateAsUpdate } = await import("yjs");
        const update = encodeStateAsUpdate(ydoc);
        const len = update && (update.byteLength || update.length) ? (update.byteLength || update.length) : null;
        const b64 = uint8ArrayToBase64(update instanceof Uint8Array ? update : new Uint8Array(update));
        const res = await saveSnapshot({
          variables: { id: documentId, snapshotBase64: b64 }
        });
        // saveSnapshot completed
        try { onAutosaveStateChange && onAutosaveStateChange("saved"); } catch (e) {}
      } catch (e) {
        console.error("saveSnapshot failed", e);
        try { onAutosaveStateChange && onAutosaveStateChange("error"); } catch (err) {}
      }
    };

    const onUpdate = () => {
      clearTimeout(timer);
      try { onAutosaveStateChange && onAutosaveStateChange("pending"); } catch (e) {}

      // If a provider exists, only save when provider has reported sync
      if (provider) {
        if (!isSynced) {
          return;
        }
      }

      timer = setTimeout(save, 3000);
    };

        if (provider && provider.on) {
      try {
        provider.on('sync', (synced) => { isSynced = Boolean(synced); });
        provider.on('status', (ev) => {});
      } catch (e) {}
    }

    if (ydoc) {
      ydoc.on("update", onUpdate);
    }

    const sendBeacon = () => {
      try {
        const yjs = yjsRef.current;
        if (!yjs) return;
        const update = yjs.encodeStateAsUpdate(ydocRef.current || ydoc);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`/snapshots/beacon?docId=${documentId}`, update);
        }
      } catch (e) {}
    };

    window.addEventListener("beforeunload", sendBeacon);

    return () => {
      if (ydoc) {
        ydoc.off("update", onUpdate);
      }
      window.removeEventListener("beforeunload", sendBeacon);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ydoc, documentId, saveSnapshot, provider]);

  // Initialize and keep local awareness state in sync when provider becomes available.
  useEffect(() => {
    if (!provider || !provider.awareness) return;

    const aw = provider.awareness;

    // create a stable user object (HEX color only)
    const id = stableUser.id;
    const name = stableUser.name;
    const colorHex = stableUser.color;

    // Build the user object we will write into awareness. Only include
    // the `name` property when it's available to avoid publishing a
    // global "Anonymous" fallback for all clients. Publish only the
    // first name portion so remote cursor labels remain short. Also
    // include fg/bg/border color fields so renderers can style labels.
    const palette = getCursorColor(id);
    const colorBg = cssColorToHex(user?.color) || (palette && palette.bg) || localColorRef.current || '#007aff';
    const colorFg = user?.colorFg || (palette && palette.fg) || getContrastingColor(colorBg) || '#ffffff';
    const colorBorder = user?.colorBorder || (palette && palette.border) || colorBg;

    const userAwareness = { id, color: colorBg, colorFg, colorBorder };
    if (name) {
      try {
        const displayName = String(name).trim().replace(/,/g, " ").split(/\s+/)[0] || String(name).trim();
        if (displayName) userAwareness.name = displayName;
      } catch (e) {
        userAwareness.name = name;
      }
    }

    // Only set local awareness once per provider instance to avoid update loops
      try {
        const seen = localAwarenessSetMapRef.current;
        const desired = JSON.stringify(userAwareness);
        const prev = seen.get(provider);
        if (prev !== desired) {
            aw.setLocalStateField("user", userAwareness);
            seen.set(provider, desired);
        }
      } catch (e) {
        console.warn("RealtimeEditor: setLocalStateField failed", e);
      }

    // Keep a lightweight awareness->cursor snapshot for UI (read-only)
    const handleAwarenessChange = () => {
      try {
        const states = Array.from(aw.getStates().entries());
        const mapped = states
          .map(([clientId, st]) => {
            if (!st || !st.user) return null;
            const u = st.user;
            return {
              clientId: String(clientId),
              userId: String(u.id || ""),
                user: { id: u.id, name: u.name, color: cssColorToHex(u.color) || u.color || null, colorFg: u.colorFg || null, colorBorder: u.colorBorder || null },
              // optional: include selection if present
              selection: st.selection || null
            };
          })
          .filter(Boolean);
        setAwarenessCursors(mapped);
      } catch (e) {
      }
    };

    aw.on && aw.on("change", handleAwarenessChange);
    // initial snapshot
    handleAwarenessChange();

    return () => {
      aw.off && aw.off("change", handleAwarenessChange);
    };
  }, [provider, user?.id, user?.name, user?.color, documentId]);

  // NOTE: we no longer map awareness -> manual remote-cursors for
  // rendering. TipTap's CollaborationCursor handles awareness-driven
  // cursor rendering when a real Yjs provider is present.

  // Only pass the real provider (or null) to RichTextEditor. Do NOT pass
  // the stub provider as `provider` because TipTap's CollaborationCursor
  // expects a real y-websocket provider with a `.doc` and `.awareness`.
  return (
    <RichTextEditor
      key={`${provider ? 'ws' : 'no-ws'}-${ydoc ? ydoc.clientID : 'no-ydoc'}-${ydocStateVersion}`}
      ydoc={ydoc}
      provider={provider}
      user={stableUser}
      onCursorOffsetChange={onCursorActivity}
      disabled={false}
        value={null}
        /* story-mode removed */
    />
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useSubscription } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  GET_MY_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  USER_NOTIFICATION_RECEIVED
} from "@/lib/graphql";
import { toFriendlyError } from "@/lib/uiErrors";

const NOTIFICATION_PAGE_SIZE = 20;
const VISIBLE_NOTIFICATION_TYPES = new Set([
  "DOCUMENT_LIKED",
  "INVITE_RECEIVED",
  "INVITE_APPROVED",
  "INVITE_REJECTED"
]);

function isVisibleNotification(notification) {
  return VISIBLE_NOTIFICATION_TYPES.has(String(notification?.type || ""));
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="notification-bell-svg">
      <path d="M12 4a5 5 0 0 0-5 5v3.5c0 1.2-.5 2.3-1.4 3.2L4.5 17h15l-1.1-1.3c-.9-.9-1.4-2-1.4-3.2V9a5 5 0 0 0-5-5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function routeForNotification(notification) {
  if (String(notification?.type || "").startsWith("INVITE_")) {
    return "/invitations";
  }

  if (notification?.document?.id) {
    return `/doc/${notification.document.id}`;
  }

  if (notification?.invitation?.id) {
    return "/invitations";
  }

  return "/";
}

export default function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const rootRef = useRef(null);

  const { data, loading, error } = useQuery(GET_MY_NOTIFICATIONS, {
    variables: {
      limit: NOTIFICATION_PAGE_SIZE,
      offset: 0,
      unreadOnly: false
    },
    fetchPolicy: "cache-and-network"
  });

  const [markNotificationRead] = useMutation(MARK_NOTIFICATION_READ);

  useEffect(() => {
    if (!data?.myNotifications?.items) {
      return;
    }

    setItems(data.myNotifications.items.filter(isVisibleNotification));
  }, [data]);

  useSubscription(USER_NOTIFICATION_RECEIVED, {
    onData: ({ data: subscriptionPayload }) => {
      const incoming = subscriptionPayload?.data?.userNotificationReceived;
      if (!incoming?.id || !isVisibleNotification(incoming)) {
        return;
      }

      setItems((current) => {
        const deduped = current.filter((item) => String(item.id) !== String(incoming.id));
        return [incoming, ...deduped].slice(0, NOTIFICATION_PAGE_SIZE);
      });
    }
  });

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      window.addEventListener("mousedown", handleOutsideClick);
    }

    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items]
  );

  async function handleNotificationClick(notification) {
    if (!notification) {
      return;
    }

    if (!notification.isRead) {
      try {
        await markNotificationRead({
          variables: { notificationId: notification.id }
        });

        setItems((current) =>
          current.map((item) =>
            String(item.id) === String(notification.id)
              ? {
                  ...item,
                  isRead: true,
                  readAt: new Date().toISOString()
                }
              : item
          )
        );
      } catch {
        // Keep navigation behavior even if mark-read fails.
      }
    }

    setIsOpen(false);
    router.push(routeForNotification(notification));
  }

  return (
    <div className="notification-root" ref={rootRef}>
      <button
        type="button"
        className="notification-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 ? <strong className="notification-badge">{unreadCount}</strong> : null}
      </button>

      {isOpen ? (
        <section className="notification-panel panel">
          <div className="notification-panel-header">
            <div className="notification-panel-title">
              <h3>Notifications</h3>
              <p className="notification-summary">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              className="notification-close-btn"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>

          {error ? <p className="field-error">{toFriendlyError(error)}</p> : null}

          {loading && items.length === 0 ? (
            <p className="list-meta">Loading notifications...</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <p className="list-meta">No notifications yet.</p>
          ) : null}

          <div className="notification-list">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.isRead ? "notification-item read" : "notification-item unread"}
                onClick={() => handleNotificationClick(item)}
              >
                <div className="notification-item-top">
                  <strong>{item.title}</strong>
                  {!item.isRead ? (
                    <span className="notification-unread-dot" aria-hidden="true" />
                  ) : null}
                </div>
                <span>{item.message}</span>
                <small>{formatWhen(item.createdAt)}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

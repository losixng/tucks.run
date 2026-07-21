const NOTIFICATION_STORAGE_KEY = "tucksNotifications";
const MAX_NOTIFICATIONS = 180;

function readStoredNotifications() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not read notifications", error);
    return [];
  }
}

function writeStoredNotifications(list) {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch (error) {
    console.warn("Could not save notifications", error);
  }
}

function getUserKey(userId) {
  const raw = String(userId || "guest").trim().toLowerCase();
  return raw || "guest";
}

function normalizeNotification(item, fallbackUserId = "guest") {
  const createdAt = item.createdAt || new Date().toISOString();
  return {
    id: item.id || `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: item.userId || fallbackUserId,
    userKey: getUserKey(item.userId || item.userKey || fallbackUserId),
    role: item.role || "user",
    category: item.category || "general",
    title: item.title || "Update",
    message: item.message || "You have a new update.",
    priority: Number(item.priority || 1),
    groupKey: item.groupKey || "",
    read: Boolean(item.read),
    createdAt,
    updatedAt: item.updatedAt || createdAt,
    actionUrl: item.actionUrl || "",
    meta: item.meta || {},
    count: Number(item.count || 1),
    queueDuringQuietHours: Boolean(item.queueDuringQuietHours),
    source: item.source || "system"
  };
}

function getAllNotifications() {
  return readStoredNotifications().map((item) => normalizeNotification(item, item.userId || item.userKey || "guest"));
}

function saveAllNotifications(list) {
  writeStoredNotifications(list.map((item) => normalizeNotification(item, item.userId || item.userKey || "guest")));
}

function getNotificationsForUser(userId) {
  const userKey = getUserKey(userId);
  return getAllNotifications()
    .filter((item) => getUserKey(item.userKey || item.userId) === userKey)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
}

function saveNotificationsForUser(userId, list) {
  const userKey = getUserKey(userId);
  const all = getAllNotifications().filter((item) => getUserKey(item.userKey || item.userId) !== userKey);
  const nextList = list.map((item) => normalizeNotification(item, userKey));
  saveAllNotifications([...all, ...nextList]);
}

function isQuietHours(now = new Date()) {
  const hour = now.getHours();
  return hour >= 22 || hour < 7;
}

function shouldQueueDuringQuietHours(notification, now = new Date()) {
  return notification.priority < 2 && isQuietHours(now);
}

function emitUpdate(notification) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tucks:notifications-updated", { detail: notification }));
  }
}

export function getNotifications(userId) {
  return getNotificationsForUser(userId);
}

export function getUnreadCount(userId) {
  return getNotifications(userId).filter((item) => !item.read).length;
}

export function addNotification(input = {}) {
  const userKey = getUserKey(input.userId || input.email || input.userKey || input.role || "guest");
  const now = new Date(input.createdAt || Date.now());
  const notification = normalizeNotification(
    {
      ...input,
      userId: userKey,
      userKey,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      read: false,
      priority: Number(input.priority || 1),
      count: Number(input.count || 1),
      queueDuringQuietHours: false
    },
    userKey
  );

  const existingList = getNotificationsForUser(userKey);
  const recentMatch = existingList.find((item) => {
    if (notification.groupKey && item.groupKey === notification.groupKey && !item.read) {
      return true;
    }
    if (!notification.groupKey && item.category === notification.category && item.title === notification.title && !item.read) {
      return (now.getTime() - new Date(item.createdAt).getTime()) < 10 * 60 * 1000;
    }
    return false;
  });

  if (recentMatch) {
    const merged = normalizeNotification({
      ...recentMatch,
      title: recentMatch.title,
      message: `${recentMatch.message} • ${notification.message}`,
      priority: Math.max(recentMatch.priority, notification.priority),
      count: Number(recentMatch.count || 1) + 1,
      updatedAt: now.toISOString(),
      meta: { ...recentMatch.meta, ...notification.meta }
    }, userKey);
    const nextList = existingList.filter((item) => item.id !== recentMatch.id);
    nextList.unshift(merged);
    saveNotificationsForUser(userKey, nextList);
    emitUpdate(merged);
    return merged;
  }

  notification.queueDuringQuietHours = shouldQueueDuringQuietHours(notification, now);
  const nextList = [notification, ...existingList].slice(0, MAX_NOTIFICATIONS);
  saveNotificationsForUser(userKey, nextList);
  emitUpdate(notification);
  return notification;
}

export function markNotificationRead(id, userId) {
  const userKey = getUserKey(userId);
  const list = getNotificationsForUser(userKey).map((item) => (item.id === id ? { ...item, read: true, updatedAt: new Date().toISOString() } : item));
  saveNotificationsForUser(userKey, list);
  emitUpdate({ id, userId: userKey, read: true });
}

export function markAllNotificationsRead(userId) {
  const userKey = getUserKey(userId);
  const list = getNotificationsForUser(userKey).map((item) => ({ ...item, read: true, updatedAt: new Date().toISOString() }));
  saveNotificationsForUser(userKey, list);
  emitUpdate({ userId: userKey, read: true });
}

export function clearNotifications(userId) {
  const userKey = getUserKey(userId);
  const all = getAllNotifications().filter((item) => getUserKey(item.userKey || item.userId) !== userKey);
  saveAllNotifications(all);
  emitUpdate({ userId: userKey, cleared: true });
}

export function seedWelcomeNotification(userId, role = "buyer") {
  const userKey = getUserKey(userId);
  const existing = getNotifications(userKey).find((item) => item.category === "welcome");
  if (existing) return existing;
  return addNotification({
    userId: userKey,
    role,
    category: "welcome",
    priority: 1,
    title: "Welcome to Tucks",
    message: "Your account is ready. We’ll keep important updates, orders, and event reminders in one friendly place.",
    groupKey: `welcome:${userKey}`
  });
}

export function scheduleEventReminders(event, userId) {
  if (!event || !event.id) return [];
  const startTime = event.startsAt?.toDate ? event.startsAt.toDate() : new Date(event.startsAt || 0);
  if (Number.isNaN(startTime.getTime())) return [];

  const reminders = [
    {
      title: `${event.title || "Your event"} is tomorrow`,
      message: `The countdown is on. ${event.title || "Your event"} begins ${startTime.toLocaleString()}.`,
      at: new Date(startTime.getTime() - 24 * 60 * 60 * 1000),
      groupKey: `event-reminder:${event.id}:day-before`
    },
    {
      title: `${event.title || "Your event"} reminder`,
      message: `Good morning! ${event.title || "Your event"} is happening today.`,
      at: new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate(), 8, 0, 0, 0),
      groupKey: `event-reminder:${event.id}:morning`
    },
    {
      title: `${event.title || "Your event"} starts soon`,
      message: `Only one hour remains before ${event.title || "your event"} begins.`,
      at: new Date(startTime.getTime() - 60 * 60 * 1000),
      groupKey: `event-reminder:${event.id}:hour-before`
    },
    {
      title: `${event.title || "Your event"} is live`,
      message: `It is time to join ${event.title || "your event"}.`,
      at: startTime,
      groupKey: `event-reminder:${event.id}:start`
    }
  ];

  reminders.forEach((reminder) => {
    const delay = reminder.at.getTime() - Date.now();
    if (delay > 0) {
      window.setTimeout(() => {
        addNotification({
          userId,
          role: "attendee",
          category: "event",
          priority: 2,
          title: reminder.title,
          message: reminder.message,
          groupKey: reminder.groupKey,
          actionUrl: `/events.html?event=${encodeURIComponent(event.id)}`
        });
      }, Math.min(delay, 2147483647));
    }
  });

  return reminders;
}

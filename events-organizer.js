import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDzwnmGgEcN63RcCHSNU6p_xXKxmeqzF6k",
  authDomain: "losixmarket.firebaseapp.com",
  projectId: "losixmarket",
  storageBucket: "losixmarket.firebasestorage.app",
  messagingSenderId: "301860246689",
  appId: "1:301860246689:web:aabf0ab9af41081a91cce0",
  measurementId: "G-ZPVVZ8GNP0"
};

let db = null;

try {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  console.info('Events organizer Firestore initialized.');
} catch (error) {
  console.warn('Could not initialize Firestore for events organizer', error);
}

const formatDate = (value) => {
  if (!value) return "—";
  let date = null;
  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatCurrency = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

async function getOrganizerEvents(organizerEmail) {
  if (!db || !organizerEmail) return [];
  try {
    const q = query(
      collection(db, "events"),
      where("organizerEmail", "==", organizerEmail),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.warn('Could not fetch organizer events from Firestore', error);
    return [];
  }
}

async function getEventRegistrations(eventId) {
  if (!db || !eventId) return [];
  try {
    const q = query(
      collection(db, "eventTickets"),
      where("eventId", "==", eventId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.warn('Could not fetch event registrations', error);
    return [];
  }
}

async function markAttendanceConfirmed(ticketId, eventId) {
  if (!db || !ticketId) throw new Error("Invalid ticket ID");
  try {
    const ticketRef = doc(db, "eventTickets", ticketId);
    await updateDoc(ticketRef, {
      status: "confirmed",
      verifiedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Could not mark attendance", error);
    throw error;
  }
}

function renderOrganizerEvents(container, events, registrations) {
  container.innerHTML = "";
  if (!events.length) {
    container.innerHTML = '<div class="empty-state"><strong>No events yet.</strong><p>Upload your first event to get started.</p></div>';
    return;
  }

  events.forEach((event) => {
    const eventRegs = registrations[event.id] || [];
    const soldTickets = eventRegs.filter(r => r.status === "completed").length;
    const confirmedAttendees = eventRegs.filter(r => r.status === "confirmed").length;

    const card = document.createElement("div");
    card.className = "event-org-card";
    card.innerHTML = `
      <div class="event-org-header">
        <div>
          <h3>${event.title || "Untitled event"}</h3>
          <div class="event-org-meta">${formatDate(event.startsAt)} • ${event.location || "Online"}</div>
        </div>
        <span class="status-pill active">Live</span>
      </div>
      <div class="event-org-stats">
        <div class="stat">
          <div class="stat-value">${soldTickets}</div>
          <div class="stat-label">Tickets Sold</div>
        </div>
        <div class="stat">
          <div class="stat-value">${confirmedAttendees}</div>
          <div class="stat-label">Confirmed Attendees</div>
        </div>
        <div class="stat">
          <div class="stat-value">${event.capacity || "∞"}</div>
          <div class="stat-label">Capacity</div>
        </div>
      </div>
      <div class="event-org-body">
        <div><strong>Category:</strong> ${event.category || "General"}</div>
        <div><strong>Ticket Price:</strong> ${formatCurrency(event.ticketPrice || 0)}</div>
        <div><strong>Description:</strong> ${event.description || "—"}</div>
      </div>
      <button class="btn-expand" data-event-id="${event.id}">View registrations & scan</button>
    `;
    container.appendChild(card);
  });
}

function renderEventRegistrations(container, registrations, eventTitle) {
  container.innerHTML = "";
  if (!registrations.length) {
    container.innerHTML = '<div class="empty-state"><strong>No registrations yet.</strong></div>';
    return;
  }

  const html = registrations.map((reg) => {
    const isConfirmed = reg.status === "confirmed";
    return `
      <div class="registration-card ${isConfirmed ? "confirmed" : ""}">
        <div class="registration-header">
          <div>
            <h4>${reg.buyerName || "Anonymous"}</h4>
            <div class="registration-meta">${reg.buyerEmail || "—"} • ${formatDate(reg.createdAt)}</div>
          </div>
          <span class="status-pill ${isConfirmed ? "success" : "pending"}">${isConfirmed ? "Verified" : "Purchased"}</span>
        </div>
        <div class="registration-body">
          <div><strong>Ticket ID:</strong> ${reg.ticketId || "—"}</div>
          <div><strong>Amount Paid:</strong> ${formatCurrency(reg.amountPaid || 0)}</div>
          <div><strong>Status:</strong> ${reg.status || "pending"}</div>
          ${isConfirmed ? `<div><strong>Verified at:</strong> ${formatDate(reg.verifiedAt)}</div>` : ""}
        </div>
        ${!isConfirmed ? `<button class="btn-confirm" data-ticket-id="${reg.id}">Confirm attendance</button>` : ""}
      </div>
    `;
  }).join("");
  container.innerHTML = html;
}

export { getOrganizerEvents, getEventRegistrations, markAttendanceConfirmed, renderOrganizerEvents, renderEventRegistrations, formatDate, formatCurrency };

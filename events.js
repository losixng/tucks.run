import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const PAYSTACK_PUBLIC_KEY = "pk_test_f84b249cadf2b30de87df5a566b34ec1e17d9c12";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDzwnmGgEcN63RcCHSNU6p_xXKxmeqzF6k",
  authDomain: "losixmarket.firebaseapp.com",
  projectId: "losixmarket",
  storageBucket: "losixmarket.firebasestorage.app",
  messagingSenderId: "301860246689",
  appId: "1:301860246689:web:aabf0ab9af41081a91cce0",
  measurementId: "G-ZPVVZ8GNP0"
};

let auth = null;
try {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    window.currentUserEmail = user?.email || null;
    window.isSignedIn = !!user;
  });
} catch (e) {
  console.warn('Firebase auth not initialized', e);
  window.currentUserEmail = null;
  window.isSignedIn = false;
}

const CLOUD_NAME = "dthxl4jcn";
const UPLOAD_PRESET = "losix_products";

const getJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.message || `Request failed: ${response.status}`);
  }
  return body;
};

const formatCurrency = (amount) => {
  return `₦${Number(amount || 0).toLocaleString()}`;
};

const formatEventDate = (value) => {
  if (!value) return "TBD";
  let date = null;
  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
};

const estimatePaystackCharge = (baseAmount) => {
  const cents = Math.ceil(Number(baseAmount || 0) * 0.015) + 100;
  return cents / 100;
};

const showToast = (message, isError = false) => {
  const toast = document.getElementById("eventToast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = isError ? "alertBox show error" : "alertBox show";
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
};

const createPaystackCheckout = ({ email, amount, metadata, onSuccess, onClose }) => {
  if (typeof PaystackPop === "undefined") {
    throw new Error("Paystack script is not loaded.");
  }

  PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: String(email).trim(),
    amount: Number(amount),
    currency: "NGN",
    metadata: metadata || {},
    onClose: onClose || (() => showToast("Payment was not completed", true)),
    callback: async (response) => {
      if (!response?.reference) {
        showToast("Payment did not return a reference", true);
        return;
      }
      await onSuccess(response.reference);
    }
  }).openIframe();
};

const generateQrCode = (text, containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  new QRCode(container, {
    text,
    width: 220,
    height: 220,
    colorDark: "#111",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
};

const buildTicketVerificationResult = (result) => {
  const element = document.getElementById("verifyResult");
  if (!element) return;
  if (!result || result.status !== "success") {
    element.innerHTML = `<div class="event-card"><p>Ticket not valid.</p></div>`;
    return;
  }
  const ticket = result.ticket;
  const event = result.event;
  element.innerHTML = `
    <div class="event-card verify-card">
      <div class="event-body">
        <p class="badge">${event?.category || "Ticket"}</p>
        <h3>${event?.title || "Unknown event"}</h3>
        <p class="event-meta">Ticket: ${ticket.ticketId}</p>
        <p class="event-description">Buyer: ${ticket.buyerName} • ${ticket.buyerEmail}</p>
        <p class="event-description">Amount paid: ${formatCurrency(ticket.amountPaid)}</p>
        <p class="event-description">Status: ${ticket.status}</p>
        <p class="event-description">Location: ${event?.location || "Online"}</p>
      </div>
    </div>`;
};

const verifyTicketPayload = async (ticketId) => {
  const result = await getJson(`/api/verifyTicket?ticketId=${encodeURIComponent(ticketId)}`);
  buildTicketVerificationResult(result);
};

const uploadMediaFile = async (file) => {
  const isVideo = file.type.startsWith("video/");
  const endpoint = isVideo ? "video" : "image";
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpoint}/upload`, { method: "POST", body: form });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return { url: data.secure_url, type: isVideo ? "video" : "image" };
};

const uploadImages = async (files) => {
  const media = [];
  for (let i = 0; i < Math.min((files && files.length) || 0, 5); i++) {
    const uploaded = await uploadMediaFile(files[i]);
    media.push(uploaded);
  }
  return media;
};

const bindMediaPreview = (input, previewEl) => {
  if (!input || !previewEl) return;
  input.addEventListener("change", () => {
    previewEl.innerHTML = "";
    Array.from(input.files || []).slice(0, 5).forEach(file => {
      const item = document.createElement("div");
      item.className = "media-preview-item";
      item.style.width = "120px"; item.style.height = "80px"; item.style.position = "relative"; item.style.overflow = "hidden"; item.style.borderRadius = "8px";
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = file.type.startsWith("video/") ? "Video" : "Image";
      tag.style.position = "absolute"; tag.style.right = "6px"; tag.style.top = "6px"; tag.style.background = "rgba(0,0,0,0.6)"; tag.style.color = "#fff"; tag.style.padding = "2px 6px"; tag.style.borderRadius = "6px"; tag.style.fontSize = "12px";
      if (file.type.startsWith("video/")) {
        const v = document.createElement("video");
        v.src = URL.createObjectURL(file);
        v.muted = true;
        v.style.width = "100%"; v.style.height = "100%"; v.style.objectFit = "cover";
        item.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.style.width = "100%"; img.style.height = "100%"; img.style.objectFit = "cover";
        item.appendChild(img);
      }
      item.appendChild(tag);
      previewEl.appendChild(item);
    });
  });
};

export const initEventListing = () => {
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const eventsList = document.getElementById("eventsList");
  const buyModal = document.getElementById("buyModal");
  const closeBuy = document.getElementById("closeBuy");
  const payTicketBtn = document.getElementById("payTicketBtn");
  const buyEventTitle = document.getElementById("buyEventTitle");
  const buyEventMeta = document.getElementById("buyEventMeta");
  const buyEventPrice = document.getElementById("buyEventPrice");
  const buyCharge = document.getElementById("buyCharge");
  const buyTotal = document.getElementById("buyTotal");
  const buyerNameInput = document.getElementById("buyerName");
  const buyerEmailInput = document.getElementById("buyerEmail");
  const confirmationModal = document.getElementById("confirmationModal");
  const closeConfirmation = document.getElementById("closeConfirmation");
  const confirmationMessage = document.getElementById("confirmationMessage");
  let selectedEvent = null;

  const fetchAndRender = async () => {
    try {
      const json = await getJson("/api/listEvents");
      window.eventList = json.events || [];
      renderEvents(window.eventList);
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const renderEvents = (events) => {
    const query = String(searchInput.value || "").trim().toLowerCase();
    const category = String(categoryFilter.value || "all");
    const filtered = events.filter((event) => {
      const meta = `${event.title} ${event.description} ${event.category} ${event.location}`.toLowerCase();
      const matchesCategory = category === "all" || String(event.category || "").toLowerCase() === category;
      return matchesCategory && meta.includes(query);
    });

    if (!eventsList) return;
    eventsList.innerHTML = filtered.length
      ? filtered.map((event) => {
          const thumb = (event.media && event.media.length && event.media[0].url) || event.imageUrl || 'https://via.placeholder.com/480x260?text=Event';
          return `
          <article class="event-card">
            <div class="event-image" style="background-image: url('${thumb}')"></div>
            <div class="event-body">
              <p class="badge">${event.category || 'General'}</p>
              <h3>${event.title || 'Untitled event'}</h3>
              <p class="event-meta">${formatEventDate(event.startsAt)} • ${event.location || 'Online'}</p>
              <p class="event-description">${(event.description || '').slice(0,120)}${(event.description||'').length>120? '…':''}</p>
              <div class="event-footer">
                <span class="price">${formatCurrency(event.ticketPrice || 0)}</span>
                <div style="display:flex;gap:8px;align-items:center">
                  <button class="btn btn-small" data-event-id="${event.id}" data-action="register">Register</button>
                  <button class="btn ghost btn-small" data-event-id="${event.id}" data-action="preview">Preview</button>
                </div>
              </div>
            </div>
          </article>`;
        }).join("")
      : `<div class="empty-state"><strong>No events found.</strong><p>Try another category or search term.</p></div>`;

    // Attach actions for register / preview / share
    eventsList.querySelectorAll("button[data-event-id]").forEach((button) => {
      button.addEventListener("click", (ev) => {
        const eventId = ev.currentTarget.dataset.eventId;
        const action = ev.currentTarget.dataset.action;
        selectedEvent = window.eventList.find((item) => item.id === eventId);
        if (!selectedEvent) return;

        if (action === 'register') {
          if (!window.isSignedIn) {
            showToast("Please sign in to purchase tickets", true);
            window.location.href = "/login.html";
            return;
          }
          buyEventTitle.textContent = selectedEvent.title;
          buyEventMeta.textContent = `${selectedEvent.category || 'General'} • ${selectedEvent.location || 'Online'}`;
          buyEventPrice.textContent = formatCurrency(selectedEvent.ticketPrice || 0);
          const charge = estimatePaystackCharge(selectedEvent.ticketPrice || 0);
          buyCharge.textContent = formatCurrency(charge);
          buyTotal.textContent = formatCurrency((selectedEvent.ticketPrice || 0) + charge);
          document.body.classList.add("modal-open");
          buyModal.classList.add("show");
        } else if (action === 'preview') {
          openDetailModal(selectedEvent);
        }
      });
    });
  };

  // Detail modal logic
  const detailModal = document.getElementById('detailModal');
  const detailMain = document.getElementById('detailMain');
  const detailTitle = document.getElementById('detailTitle');
  const detailMeta = document.getElementById('detailMeta');
  const detailDesc = document.getElementById('detailDesc');
  const detailPrice = document.getElementById('detailPrice');
  const detailMediaThumbs = document.getElementById('detailMediaThumbs');
  const detailRegisterBtn = document.getElementById('detailRegisterBtn');
  const detailShareBtn = document.getElementById('detailShareBtn');
  const closeDetail = document.getElementById('closeDetail');

  const openDetailModal = (event) => {
    detailTitle.textContent = event.title || 'Event';
    detailMeta.textContent = `${formatEventDate(event.startsAt)} • ${event.location || 'Online'}`;
    detailDesc.textContent = event.description || '';
    detailPrice.textContent = formatCurrency(event.ticketPrice || 0);

    // show up to 5 media items
    detailMediaThumbs.innerHTML = '';
    detailMain.innerHTML = '';
    const media = Array.isArray(event.media) ? event.media.slice(0,5) : [];
    if (media.length === 0) {
      const url = event.imageUrl || 'https://via.placeholder.com/640x360?text=Event';
      detailMain.style.backgroundImage = `url('${url}')`;
      detailMain.style.backgroundSize = 'cover';
      detailMain.style.backgroundPosition = 'center';
    } else {
      // main display uses first media
      const first = media[0];
      if (first.type && first.type.startsWith('video')) {
        detailMain.innerHTML = `<video controls style="width:100%;height:100%;object-fit:cover" src="${first.url}"></video>`;
      } else {
        detailMain.style.backgroundImage = `url('${first.url}')`;
        detailMain.style.backgroundSize = 'cover';
        detailMain.style.backgroundPosition = 'center';
      }

      media.forEach((m, idx) => {
        const src = m.url;
        const thumb = document.createElement('img');
        thumb.src = src;
        thumb.className = 'media-thumb';
        thumb.dataset.idx = idx;
        thumb.addEventListener('click', () => {
          // swap main
          if (m.type && m.type.startsWith('video')) {
            detailMain.innerHTML = `<video controls style="width:100%;height:100%;object-fit:cover" src="${src}"></video>`;
            detailMain.style.backgroundImage = '';
          } else {
            detailMain.innerHTML = '';
            detailMain.style.backgroundImage = `url('${src}')`;
            detailMain.style.backgroundSize = 'cover';
            detailMain.style.backgroundPosition = 'center';
          }
        });
        detailMediaThumbs.appendChild(thumb);
      });
    }

    // register opens buy modal with selected event
    detailRegisterBtn.onclick = () => {
      if (!window.isSignedIn) {
        showToast("Please sign in to purchase tickets", true);
        window.location.href = "/login.html";
        return;
      }
      selectedEvent = event;
      buyEventTitle.textContent = selectedEvent.title;
      buyEventMeta.textContent = `${selectedEvent.category || 'General'} • ${selectedEvent.location || 'Online'}`;
      buyEventPrice.textContent = formatCurrency(selectedEvent.ticketPrice || 0);
      const charge = estimatePaystackCharge(selectedEvent.ticketPrice || 0);
      buyCharge.textContent = formatCurrency(charge);
      buyTotal.textContent = formatCurrency((selectedEvent.ticketPrice || 0) + charge);
      detailModal.classList.remove('show');
      buyModal.classList.add('show');
    };

    // share
    detailShareBtn.onclick = async () => {
      const shareData = { title: event.title, text: event.description || '', url: window.location.href + `#event=${event.id}` };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) { showToast('Could not share event', true); }
      } else {
        // fallback: copy link
        try { await navigator.clipboard.writeText(shareData.url); showToast('Event link copied to clipboard'); } catch (e) { showToast('Could not copy link', true); }
      }
    };

    detailModal.classList.add('show');
  };

  if (closeDetail) closeDetail.addEventListener('click', () => detailModal.classList.remove('show'));

  const closeModal = () => {
    buyModal.classList.remove("show");
    confirmationModal.classList.remove("show");
    document.body.classList.remove("modal-open");
  };

  closeBuy.addEventListener("click", closeModal);
  closeConfirmation.addEventListener("click", closeModal);

  payTicketBtn.addEventListener("click", async () => {
    if (!selectedEvent) return;
    if (!window.isSignedIn) {
      showToast("Please sign in to purchase tickets", true);
      window.location.href = "/login.html";
      return;
    }
    const buyerName = String(buyerNameInput.value || "Guest").trim();
    const buyerEmail = String(window.currentUserEmail || buyerEmailInput.value || "").trim();
    if (!buyerEmail || !buyerEmail.includes("@")) {
      showToast("Please enter a valid email address", true);
      return;
    }

    const amountNaira = Number(selectedEvent.ticketPrice || 0);
    const charge = estimatePaystackCharge(amountNaira);
    const totalAmount = Math.round((amountNaira + charge) * 100);

    try {
      createPaystackCheckout({
        email: buyerEmail,
        amount: totalAmount,
        metadata: { custom_fields: [{ display_name: "Event", variable_name: "event_title", value: selectedEvent.title }] },
        onSuccess: async (reference) => {
          try {
            const body = {
              reference,
              amount: totalAmount,
              email: buyerEmail,
              buyerName,
              eventId: selectedEvent.id
            };
            const result = await getJson("/api/purchaseTicket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!result || result.status !== "success") {
              showToast(result?.message || "Could not create ticket", true);
              return;
            }
            showToast("Ticket purchased successfully!");
            confirmationMessage.textContent = `Your ticket for ${selectedEvent.title} is ready.`;
            generateQrCode(result.qrValue, "ticketQr");
            buyModal.classList.remove("show");
            confirmationModal.classList.add("show");
          } catch (error) {
            showToast(error.message, true);
          }
        }
      });
    } catch (error) {
      showToast(error.message, true);
    }
  });

  searchInput?.addEventListener("input", () => renderEvents(window.eventList || []));
  categoryFilter?.addEventListener("change", () => renderEvents(window.eventList || []));
  fetchAndRender();
};

export const initEventUpload = () => {
  const publishForm = document.getElementById("publishEventForm");
  const statusMessage = document.getElementById("publishStatus");

  const setStatus = (message, isError = false) => {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = isError ? "alertBox show error" : "alertBox show";
    setTimeout(() => {
      statusMessage.classList.remove("show");
    }, 5000);
  };

  // bind media input preview
  const mediaInput = document.getElementById('mediaInput');
  const mediaPreviewEl = document.getElementById('mediaPreview');
  if (mediaInput && mediaPreviewEl) bindMediaPreview(mediaInput, mediaPreviewEl);

  publishForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (!data.organizerName || !data.organizerEmail || !data.title || !data.date || !data.time || !data.location) {
      setStatus("Please fill in all required fields.", true);
      return;
    }

    if (!window.isSignedIn) {
      setStatus("Please sign in to upload events", true);
      window.location.href = "/login.html";
      return;
    }

    const organizerEmail = String(window.currentUserEmail || data.organizerEmail).trim();
    if (!organizerEmail.includes("@")) {
      setStatus("Please enter a valid email for the organizer.", true);
      return;
    }

    const selectedFiles = mediaInput?.files ? Array.from(mediaInput.files) : [];

    const uploadFee = 500;
    const charge = estimatePaystackCharge(uploadFee);
    const totalAmount = Math.round((uploadFee + charge) * 100);

    try {
      createPaystackCheckout({
        email: organizerEmail,
        amount: totalAmount,
        metadata: { custom_fields: [{ display_name: "Upload fee", variable_name: "event_upload_fee", value: "500 NGN" }] },
        onClose: () => setStatus('Payment cancelled', true),
        onSuccess: async (reference) => {
          try {
            setStatus('Publishing event...');
            // upload selected media after successful payment
            let media = [];
            if (selectedFiles.length) {
              setStatus('Uploading media...');
              try {
                media = await uploadImages(selectedFiles);
              } catch (ue) {
                console.warn('Media upload failed', ue);
                // continue without media
                media = [];
              }
            }

            const eventData = { ...data, media };

            const result = await getJson("/api/publishEvent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference, amount: totalAmount, email: organizerEmail, eventData })
            });

            if (!result || result.status !== "success") {
              setStatus(result?.message || "Event publishing failed", true);
              return;
            }

            setStatus(`✓ Event published successfully! Event ID: ${result.eventId}`);
            form.reset();
            if (mediaPreviewEl) mediaPreviewEl.innerHTML = '';
            setTimeout(() => {
              window.location.href = "/events-organizer.html";
            }, 2000);
          } catch (error) {
            setStatus(error.message, true);
          }
        }
      });
    } catch (error) {
      setStatus(error.message, true);
    }
  });
};

export const initTicketVerifier = () => {
  const scanResult = document.getElementById("verifyStatus");
  const manualInput = document.getElementById("manualTicketId");
  const verifyButton = document.getElementById("verifyButton");
  const scannerContainer = document.getElementById("scannerContainer");

  const showError = (message) => {
    if (!scanResult) return;
    scanResult.textContent = message;
    scanResult.className = "alertBox show error";
    setTimeout(() => scanResult.classList.remove("show"), 3200);
  };

  const showMessage = (message) => {
    if (!scanResult) return;
    scanResult.textContent = message;
    scanResult.className = "alertBox show";
    setTimeout(() => scanResult.classList.remove("show"), 3200);
  };

  const onTicketFound = async (ticketId) => {
    showMessage("Verifying ticket...");
    try {
      await verifyTicketPayload(ticketId);
    } catch (error) {
      showError(error.message);
    }
  };

  verifyButton?.addEventListener("click", () => {
    const ticketId = String(manualInput?.value || "").trim();
    if (!ticketId) {
      showError("Enter a ticket ID or scan QR code.");
      return;
    }
    onTicketFound(ticketId);
  });

  if (window.Html5QrcodeScanner && scannerContainer) {
    const html5QrcodeScanner = new Html5QrcodeScanner("scannerContainer", { fps: 10, qrbox: 250 });
    html5QrcodeScanner.render(async (decodedText) => {
      try {
        const payload = JSON.parse(decodedText);
        if (payload.ticketId) {
          html5QrcodeScanner.clear();
          await onTicketFound(payload.ticketId);
        } else {
          showError("QR does not contain a ticket ID.");
        }
      } catch (error) {
        showError("Invalid QR code format.");
      }
    }, (error) => {
      // ignore transient scan errors
    });
  }
};

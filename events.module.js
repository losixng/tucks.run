
    import {
      apiFetch,
      auth,
      buildCountdownLabel,
      firstMedia,
      formatDateTime,
      isFavorite,
      money,
      onAuthStateChanged,
      resolveMediaMarkup,
      safeArray,
      shareEvent,
      toggleFavorite
    } from './events-app.js';

    const grid = document.getElementById('eventGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalContent = document.getElementById('modalContent');
    const toast = document.getElementById('toast');
    const totalEvents = document.getElementById('totalEvents');
    const freeEvents = document.getElementById('freeEvents');
    const tieredEvents = document.getElementById('tieredEvents');
    const totalEventsHero = document.getElementById('totalEventsHero');
    const freeEventsHero = document.getElementById('freeEventsHero');
    const tieredEventsHero = document.getElementById('tieredEventsHero');
    const menu = document.getElementById('menu');
    const menuBtn = document.getElementById('menuBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    let allEvents = [];
    let currentUser = null;
    let activeEventId = null;
    let pricingConfig = {
      attendeeRegistrationFee: 100,
      gatewayPercent: 1.5,
      gatewayFlat: 100
    };

    function resolvePaystackPublicKey(config) {
      return String(
        config?.paystackPublicKey ??
        config?.PAYSTACK_PUBLIC_KEY ??
        config?.publicKey ??
        config?.paystack?.publicKey ??
        window.PAYSTACK_PUBLIC_KEY ??
        ''
      ).trim();
    }

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(window.toastTimer);
      window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    function openModal() {
      modalBackdrop.classList.add('open');
      modalBackdrop.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
      modalBackdrop.classList.remove('open');
      modalBackdrop.setAttribute('aria-hidden', 'true');
      modalContent.innerHTML = '';
      activeEventId = null;
    }

    function eventPriceLabel(event) {
      if (event.isFree) return 'Free';
      const tiers = safeArray(event.tiers);
      if (tiers.length) {
        const lowest = tiers.reduce((min, tier) => Math.min(min, Number(tier.price || 0)), Number.POSITIVE_INFINITY);
        return lowest === Number.POSITIVE_INFINITY ? money(event.ticketPrice || 0) : `From ${money(lowest)}`;
      }
      return money(event.ticketPrice || 0);
    }

    function renderEventCard(event) {
      const media = firstMedia(event);
      const dateText = formatDateTime(event.startsAt);
      const location = event.location || 'TBD';
      const tierCount = safeArray(event.tiers).length;
      return `
        <article class="event-card" data-event-id="${event.id}">
          <div class="event-media">${media ? resolveMediaMarkup(media) : ''}</div>
          <div class="event-body">
            <div class="meta-row">
              <span>${event.category || 'General'}</span>
              <span class="price">${eventPriceLabel(event)}</span>
            </div>
            <h4>${event.title || 'Untitled event'}</h4>
            <div class="meta-row">
              <span><i class='bx bx-map'></i> ${location}</span>
              <span><i class='bx bx-calendar'></i> ${dateText}</span>
            </div>
            <div class="chips">
              <span class="chip">${event.isFree ? 'Free entry' : 'Paid entry'}</span>
              <span class="chip">${tierCount ? `${tierCount} ticket tiers` : 'Single ticket type'}</span>
              <span class="chip">${Number(event.capacity || 0) ? `Capacity ${event.capacity}` : 'Unlimited seats'}</span>
            </div>
          </div>
        </article>
      `;
    }

    function renderGrid(events) {
      if (!events.length) {
        grid.innerHTML = `<div class="empty">No events matched your search yet.</div>`;
        return;
      }
      grid.innerHTML = events.map(renderEventCard).join('');
    }

    function sortEvents(events) {
      const mode = sortSelect.value;
      const list = [...events];
      if (mode === 'priceLow') {
        list.sort((a, b) => (Number(a.ticketPrice || 0) - Number(b.ticketPrice || 0)));
      } else if (mode === 'priceHigh') {
        list.sort((a, b) => (Number(b.ticketPrice || 0) - Number(a.ticketPrice || 0)));
      } else if (mode === 'featured') {
        list.sort((a, b) => Number(!!b.isFree) - Number(!!a.isFree));
      } else {
        list.sort((a, b) => {
          const ad = a.startsAt?.toDate ? a.startsAt.toDate().getTime() : new Date(a.startsAt || 0).getTime();
          const bd = b.startsAt?.toDate ? b.startsAt.toDate().getTime() : new Date(b.startsAt || 0).getTime();
          return ad - bd;
        });
      }
      return list;
    }

    function filterEvents() {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = allEvents.filter((event) => {
        const haystack = [
          event.title,
          event.description,
          event.category,
          event.location,
          event.venue,
          ...(safeArray(event.requirements)),
          ...(safeArray(event.thingsToBring))
        ].join(' ').toLowerCase();
        return haystack.includes(term);
      });
      renderGrid(sortEvents(filtered));
    }

    function renderModal(event) {
      const media = firstMedia(event);
      const tiers = safeArray(event.tiers);
      const fields = safeArray(event.attendeeFields);
      const requirements = safeArray(event.requirements);
      const bring = safeArray(event.thingsToBring);
      const mediaMarkup = media ? resolveMediaMarkup(media) : `<div style="display:grid;place-items:center;height:100%;color:#64748b;">No media uploaded yet</div>`;
      modalContent.innerHTML = `
        <div class="modal-media">${mediaMarkup}</div>
        <div class="modal-body">
          <div class="modal-top">
            <div>
              <div class="eyebrow"><i class='bx bx-calendar-event'></i> ${event.category || 'Event'}</div>
              <h3>${event.title || 'Untitled event'}</h3>
              <p>${event.description || 'No description provided yet.'}</p>
            </div>
            <button class="close-btn" data-close>&times;</button>
          </div>

          <div class="detail-grid">
            <div class="detail"><span>Starts</span><strong>${formatDateTime(event.startsAt)}</strong></div>
            <div class="detail"><span>Location</span><strong>${event.location || 'TBD'}</strong></div>
            <div class="detail"><span>Price</span><strong>${event.isFree ? 'Free' : money(event.ticketPrice || 0)}</strong></div>
            <div class="detail"><span>Tickets</span><strong>${event.minTicketsPerOrder || 1} - ${event.maxTicketsPerOrder || 10} per purchase</strong></div>
          </div>

          <div class="section-box">
            <h5>Important Details</h5>
            <ul class="list">
              <li><strong>Dress code:</strong> ${event.dressCode || 'No specific dress code'}</li>
              <li><strong>Capacity:</strong> ${event.capacity ? event.capacity : 'Unlimited'}</li>
              <li><strong>Host:</strong> ${event.hostName || 'Tucks host'}</li>
            </ul>
          </div>

          ${requirements.length ? `
          <div class="section-box">
            <h5>Requirements</h5>
            <ul class="list">${requirements.map((item) => `<li>${item}</li>`).join('')}</ul>
          </div>` : ''}

          ${bring.length ? `
          <div class="section-box">
            <h5>Things to bring</h5>
            <ul class="list">${bring.map((item) => `<li>${item}</li>`).join('')}</ul>
          </div>` : ''}

          ${tiers.length ? `
          <div class="section-box">
            <h5>Ticket tiers</h5>
            <div class="tier-list">
              ${tiers.map((tier) => `
                <div class="tier">
                  <div>
                    <strong>${tier.name}</strong>
                    <div style="color:#64748b;font-size:0.92rem;">${tier.description || 'Premium access option'}</div>
                  </div>
                  <strong>${money(tier.price || 0)}</strong>
                </div>
              `).join('')}
            </div>
          </div>` : ''}

          ${fields.length ? `
          <div class="section-box">
            <h5>Compulsory attendee fields</h5>
            <ul class="list">${fields.map((field) => `<li>${field.label}${field.required ? ' (required)' : ''}</li>`).join('')}</ul>
          </div>` : ''}

          <div class="section-box">
            <h5>Register / Save / Share</h5>
            <div class="purchase-form">
              <input id="buyerName" placeholder="Your name" value="${currentUser?.displayName || ''}" />
              <input id="buyerEmail" type="email" placeholder="Your email" value="${currentUser?.email || ''}" />
              <select id="ticketTier">
                <option value="">Select a ticket tier</option>
                ${tiers.map((tier) => `<option value="${tier.id}">${tier.name} - ${money(tier.price || 0)}</option>`).join('')}
              </select>
              <input id="quantity" type="number" min="${event.minTicketsPerOrder || 1}" max="${event.maxTicketsPerOrder || 10}" value="${event.minTicketsPerOrder || 1}" />
              <textarea id="answers" placeholder="Any custom answers the host requires. Use one answer per line."></textarea>
            </div>
            <div class="purchase-actions" style="margin-top:12px;">
              <button class="action-btn primary-btn" data-buy="${event.id}"><i class='bx bx-cart'></i>Buy ticket</button>
              <button class="action-btn" data-fav="${event.id}">${isFavorite(event.id) ? 'Saved' : 'Save'}</button>
              <button class="action-btn" data-share="${event.id}">Share</button>
            </div>
            <div style="color:#64748b;font-size:0.9rem;line-height:1.6;">
              Ticket payment is checked on the server after Paystack confirms the reference. The UI will only continue if the payment key is configured.
            </div>
          </div>
        </div>
      `;
      openModal();
    }

    async function loadEvents() {
      grid.innerHTML = `<div class="empty">Loading events...</div>`;
      try {
        const data = await apiFetch('/api/listEvents');
        allEvents = Array.isArray(data.events) ? data.events : [];
        totalEvents.textContent = String(allEvents.length);
        freeEvents.textContent = String(allEvents.filter((event) => event.isFree).length);
        tieredEvents.textContent = String(allEvents.filter((event) => safeArray(event.tiers).length).length);
        totalEventsHero.textContent = String(allEvents.length);
        freeEventsHero.textContent = String(allEvents.filter((event) => event.isFree).length);
        tieredEventsHero.textContent = String(allEvents.filter((event) => safeArray(event.tiers).length).length);
        filterEvents();
      } catch (error) {
        grid.innerHTML = `<div class="empty">Could not load events: ${error.message}</div>`;
      }
    }

    async function loadPricingConfig() {
      try {
        const data = await apiFetch('/api/eventConfig');
        window.PAYSTACK_PUBLIC_KEY = resolvePaystackPublicKey(data);
        pricingConfig = {
          attendeeRegistrationFee: Number(data.attendeeRegistrationFee || 100),
          gatewayPercent: Number(data.gatewayPercent || 1.5),
          gatewayFlat: Number(data.gatewayFlat || 100)
        };
      } catch (error) {
        console.warn('Could not load event pricing config', error);
      }
    }

    async function handleBuy(eventId) {
      const eventData = allEvents.find((entry) => entry.id === eventId);
      if (!eventData) return;
      if (!currentUser) {
        showToast('Sign in first so the ticket can be tied to your user QR.');
        return;
      }

      const quantity = Number(document.getElementById('quantity').value || 1);
      const tierId = document.getElementById('ticketTier').value || '';
      const buyerName = document.getElementById('buyerName').value.trim();
      const buyerEmail = document.getElementById('buyerEmail').value.trim();
      const answers = document.getElementById('answers').value
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!buyerName) {
        showToast('Please enter your name before buying.');
        return;
      }

      if (!buyerEmail) {
        showToast('Please enter your email before buying.');
        return;
      }

      if (!Number.isFinite(quantity) || quantity < 1) {
        showToast('Quantity must be at least 1.');
        return;
      }

      const publicKey = resolvePaystackPublicKey(window);
      if (!publicKey) {
        showToast('Paystack public key is not configured yet.');
        return;
      }

      const selectedTier = safeArray(eventData.tiers).find((tier) => tier.id === tierId);
      const basePrice = selectedTier ? Number(selectedTier.price || 0) : Number(eventData.ticketPrice || 0);
      const chargeable = (basePrice * quantity) + (pricingConfig.attendeeRegistrationFee * quantity);
      const gatewayFee = Math.round(chargeable * (pricingConfig.gatewayPercent / 100) + pricingConfig.gatewayFlat);
      const total = chargeable + gatewayFee;

      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: buyerEmail,
        amount: total * 100,
        metadata: {
          eventId: eventData.id,
          tierId,
          quantity,
          buyerName
        },
        callback: async (response) => {
          try {
            const result = await apiFetch('/api/purchaseTicket', {
              method: 'POST',
              body: JSON.stringify({
                reference: response.reference,
                email: buyerEmail,
                buyerName,
                eventId: eventData.id,
                quantity,
                tierId,
                answers
              })
            });
            showToast(`Ticket confirmed. Reference: ${result.ticketId}`);
            closeModal();
            await loadEvents();
          } catch (error) {
            showToast(error.message);
          }
        },
        onClose: () => showToast('Payment window closed.')
      });
      handler.openIframe();
    }

    grid.addEventListener('click', (event) => {
      const card = event.target.closest('.event-card');
      if (!card) return;
      const id = card.getAttribute('data-event-id');
      const eventData = allEvents.find((entry) => entry.id === id);
      if (eventData) {
        activeEventId = id;
        renderModal(eventData);
      }
    });

    modalBackdrop.addEventListener('click', (event) => {
      if (event.target === modalBackdrop || event.target.matches('[data-close]')) {
        closeModal();
      }
      const buyTarget = event.target.closest('[data-buy]');
      const favTarget = event.target.closest('[data-fav]');
      const shareTarget = event.target.closest('[data-share]');
      if (buyTarget) {
        handleBuy(buyTarget.getAttribute('data-buy'));
      } else if (favTarget) {
        const saved = toggleFavorite(favTarget.getAttribute('data-fav'));
        favTarget.textContent = saved ? 'Saved' : 'Save';
        showToast(saved ? 'Saved to favorites.' : 'Removed from favorites.');
      } else if (shareTarget) {
        const eventData = allEvents.find((entry) => entry.id === shareTarget.getAttribute('data-share'));
        if (eventData) {
          shareEvent(eventData);
          showToast('Share link ready.');
        }
      }
    });

    searchInput.addEventListener('input', filterEvents);
    sortSelect.addEventListener('change', filterEvents);
    refreshBtn.addEventListener('click', loadEvents);
    menuBtn.addEventListener('click', () => menu.classList.toggle('open'));
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target)) {
        menu.classList.remove('open');
      }
    });

        onAuthStateChanged(auth, (user) => {
      currentUser = user;
      if (!user) {
        grid.innerHTML = '<div class="empty">Please log in to continue. Redirecting you to the login page...</div>';
        if (!window.__eventsLoginRedirect) {
          window.__eventsLoginRedirect = setTimeout(() => {
            window.location.href = '/login.html';
          }, 1200);
        }
        return;
      }
      if (window.__eventsLoginRedirect) {
        clearTimeout(window.__eventsLoginRedirect);
        window.__eventsLoginRedirect = null;
      }
      const buyerNameInput = document.getElementById('buyerName');
      const buyerEmailInput = document.getElementById('buyerEmail');
      if (buyerNameInput && !buyerNameInput.value) buyerNameInput.value = user.displayName || '';
      if (buyerEmailInput && !buyerEmailInput.value) buyerEmailInput.value = user.email || '';
      if (buyerEmailInput) buyerEmailInput.readOnly = true;
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    });

    await Promise.all([loadPricingConfig(), loadEvents()]);
  
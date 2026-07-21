
    import {
      apiFetch,
      auth,
      formatDateTime,
      money,
      onAuthStateChanged,
      safeArray
    } from './events-app.js';
    import { addNotification } from './notifications.js';

    const form = document.getElementById('eventForm');
    const authStatus = document.getElementById('authStatus');
    const hostedList = document.getElementById('hostedList');
    const toast = document.getElementById('toast');
    const publishBtn = document.getElementById('publishBtn');
    const saveDraftBtn = document.getElementById('saveDraftBtn');
    const resetBtn = document.getElementById('resetBtn');
    const refreshHostedBtn = document.getElementById('refreshHostedBtn');
    const addTierBtn = document.getElementById('addTierBtn');
    const addFieldBtn = document.getElementById('addFieldBtn');
    const tierList = document.getElementById('tierList');
    const fieldList = document.getElementById('fieldList');
    const hostFeeLabel = document.getElementById('hostFeeLabel');
    const attendeeFeeLabel = document.getElementById('attendeeFeeLabel');
    const publicKeyLabel = document.getElementById('publicKeyLabel');
    const coverImageInput = document.getElementById('coverImageFile');
    const promoVideoInput = document.getElementById('promoVideoFile');
    const extraMediaInput = document.getElementById('extraMediaFiles');
    const receiptInput = document.getElementById('receiptFile');
    const coverImagePreview = document.getElementById('coverImagePreview');
    const videoPreview = document.getElementById('videoPreview');
    const extraMediaPreview = document.getElementById('extraMediaPreview');

    const CLOUD_NAME = 'dthxl4jcn';
    const UPLOAD_PRESET = 'losix_products';

    let currentUser = null;
    let eventConfig = null;

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
    let hostedEvents = [];
    let tierCount = 0;
    let fieldCount = 0;

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(window.toastTimer);
      window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    function clearMediaPreviews() {
      coverImagePreview.innerHTML = '';
      videoPreview.innerHTML = '';
      extraMediaPreview.innerHTML = '';
    }

    function bindMediaPreview(input, previewEl, allowMultiple = false) {
      input.addEventListener('change', () => {
        previewEl.innerHTML = '';
        const files = Array.from(input.files || []);
        files.slice(0, allowMultiple ? 5 : 1).forEach((file) => {
          const item = document.createElement('div');
          item.className = 'media-preview-item';
          const tag = document.createElement('span');
          tag.className = 'media-tag';
          tag.textContent = file.type.startsWith('video/') ? 'Video' : 'Image';

          if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true;
            video.playsInline = true;
            video.controls = false;
            item.appendChild(video);
          } else {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            item.appendChild(img);
          }

          item.appendChild(tag);
          previewEl.appendChild(item);
        });
      });
    }

    bindMediaPreview(coverImageInput, coverImagePreview);
    bindMediaPreview(promoVideoInput, videoPreview);
    bindMediaPreview(extraMediaInput, extraMediaPreview, true);
    if (receiptInput) {
      // show simple filename preview for receipts (pdf or image)
      receiptInput.addEventListener('change', () => {
        const file = receiptInput.files?.[0];
        const preview = document.getElementById('receiptPreview');
        if (!file) {
          if (preview) preview.textContent = '';
          return;
        }
        if (preview) preview.textContent = file.name;
      });
    }

    async function uploadCloudinaryFile(file) {
      const isVideo = file.type.startsWith('video/');
      const endpoint = isVideo ? 'video' : 'image';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpoint}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!data.secure_url) {
        throw new Error(data?.error?.message || 'Upload failed');
      }
      return { url: data.secure_url, kind: isVideo ? 'video' : 'image' };
    }

    async function uploadSelectedMedia() {
      const imageInput = document.getElementById('imageUrl');
      const videoInput = document.getElementById('videoUrl');
      const mediaInput = document.getElementById('mediaUrls');
      const uploadedUrls = [];

      const coverFile = coverImageInput.files?.[0];
      if (coverFile) {
        const uploaded = await uploadCloudinaryFile(coverFile);
        imageInput.value = uploaded.url;
        uploadedUrls.push(uploaded.url);
      }

      const promoFile = promoVideoInput.files?.[0];
      if (promoFile) {
        const uploaded = await uploadCloudinaryFile(promoFile);
        videoInput.value = uploaded.url;
        uploadedUrls.push(uploaded.url);
      }

      const extraFiles = Array.from(extraMediaInput.files || []).slice(0, 5);
      for (const file of extraFiles) {
        const uploaded = await uploadCloudinaryFile(file);
        uploadedUrls.push(uploaded.url);
      }

      // upload receipt if present (expect pdf or images)
      const receiptFile = receiptInput?.files?.[0];
      let receiptUrl = '';
      if (receiptFile) {
        // only allow pdf or image
        if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/i.test(receiptFile.type)) {
          throw new Error('Receipt must be an image or PDF file');
        }
        const uploaded = await uploadCloudinaryFile(receiptFile);
        receiptUrl = uploaded.url;
      }

      mediaInput.value = uploadedUrls.join('\n');
      return {
        imageUrl: imageInput.value.trim(),
        videoUrl: videoInput.value.trim(),
        mediaUrls: uploadedUrls,
        receiptUrl
      };
    }
    function addTier(data = {}) {
      tierCount += 1;
      const item = document.createElement('div');
      item.className = 'builder-item';
      item.dataset.tierId = data.id || `tier-${tierCount}`;
      item.innerHTML = `
        <button class="remove" type="button" data-remove-tier>Remove</button>
        <div class="builder-row">
          <div class="field">
            <label>Tier name</label>
            <input data-tier-name placeholder="VVIP, VIP, Gold..." value="${data.name || ''}" />
          </div>
          <div class="field">
            <label>Price (NGN)</label>
            <input data-tier-price type="number" min="0" value="${data.price ?? 0}" />
          </div>
          <div class="field">
            <label>Quantity limit</label>
            <input data-tier-limit type="number" min="1" value="${data.quantityLimit ?? ''}" placeholder="Optional" />
          </div>
        </div>
        <div class="field">
          <label>Description</label>
          <input data-tier-description placeholder="What this tier includes" value="${data.description || ''}" />
        </div>
      `;
      tierList.appendChild(item);
    }

    function addField(data = {}) {
      fieldCount += 1;
      const item = document.createElement('div');
      item.className = 'builder-item';
      item.dataset.fieldId = data.id || `field-${fieldCount}`;
      item.innerHTML = `
        <button class="remove" type="button" data-remove-field>Remove</button>
        <div class="builder-row compact">
          <div class="field">
            <label>Field label</label>
            <input data-field-label placeholder="Phone number, school, company..." value="${data.label || ''}" />
          </div>
          <div class="field">
            <label>Field type</label>
            <select data-field-type>
              <option value="text" ${data.type === 'text' ? 'selected' : ''}>Text</option>
              <option value="email" ${data.type === 'email' ? 'selected' : ''}>Email</option>
              <option value="phone" ${data.type === 'phone' ? 'selected' : ''}>Phone</option>
              <option value="textarea" ${data.type === 'textarea' ? 'selected' : ''}>Textarea</option>
              <option value="select" ${data.type === 'select' ? 'selected' : ''}>Select</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Options, one per line</label>
          <textarea data-field-options placeholder="Only used for select fields">${safeArray(data.options).join('\n')}</textarea>
        </div>
        <label class="check" style="margin-top:0;">
          <input data-field-required type="checkbox" ${data.required ? 'checked' : ''} />
          <span>Required for purchase or registration</span>
        </label>
      `;
      fieldList.appendChild(item);
    }

    function parseLines(value) {
      return String(value || '')
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function localDateTimeToIso(value) {
      if (!value) return '';
      const [datePart, timePart] = String(value).split('T');
      if (!datePart || !timePart) return '';
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
      return Number.isNaN(localDate.getTime()) ? '' : localDate.toISOString();
    }

    function clearBuilders() {
      tierList.innerHTML = '';
      fieldList.innerHTML = '';
      tierCount = 0;
      fieldCount = 0;
      addTier({ name: 'General', price: 0, description: 'Default access' });
      addField({ label: 'Full name', type: 'text', required: true });
    }

    function fillFormFromDraft(draft) {
      if (!draft) return;
      const fields = [
        'title', 'category', 'description', 'hostName', 'location', 'venue', 'startsAt', 'endsAt',
        'capacity', 'imageUrl', 'videoUrl', 'about', 'dressCode', 'ticketMode', 'minTicketsPerOrder',
        'maxTicketsPerOrder', 'ticketPrice', 'ticketLabel', 'requirements', 'thingsToBring', 'mediaUrls'
      ];
      fields.forEach((key) => {
        const el = document.getElementById(key);
        if (el && draft[key] !== undefined && draft[key] !== null) {
          el.value = draft[key];
        }
      });
      document.getElementById('isFree').checked = Boolean(draft.isFree);
      document.getElementById('ticketPrice').disabled = Boolean(draft.isFree);
      tierList.innerHTML = '';
      fieldList.innerHTML = '';
      tierCount = 0;
      fieldCount = 0;
      safeArray(draft.tiers).forEach((tier) => addTier(tier));
      safeArray(draft.attendeeFields).forEach((field) => addField(field));
      if (!safeArray(draft.tiers).length) addTier();
      if (!safeArray(draft.attendeeFields).length) addField({ label: 'Full name', type: 'text', required: true });
    }

    function loadDraft() {
      try {
        return JSON.parse(localStorage.getItem('hostEventDraft') || 'null');
      } catch {
        return null;
      }
    }

    function saveDraft() {
      const payload = collectPayload(false);
      localStorage.setItem('hostEventDraft', JSON.stringify(payload));
      showToast('Draft saved locally.');
    }

    function renderHostedEvents() {
      if (!currentUser) {
        hostedList.innerHTML = '<div class="empty">Sign in to see the events you are already hosting.</div>';
        return;
      }
      if (!hostedEvents.length) {
        hostedList.innerHTML = '<div class="empty">No hosted events yet. Publish your first event from the form.</div>';
        return;
      }
      hostedList.innerHTML = hostedEvents.map((event) => {
        const tierCount = safeArray(event.tiers).length;
        const pendingUntil = event.pendingExpiresAt ? (event.pendingExpiresAt.toDate ? event.pendingExpiresAt.toDate().toISOString() : event.pendingExpiresAt) : null;
        return `
          <div class="hosted-item">
            <h4>${event.title || 'Untitled event'}</h4>
            <div class="hosted-meta">
              <span class="chip">${event.isFree ? 'Free' : money(event.ticketPrice || 0)}</span>
              <span class="chip">${tierCount ? `${tierCount} tiers` : 'No tiers'}</span>
              <span class="chip">${formatDateTime(event.startsAt)}</span>
              <span class="chip">${event.status || 'published'}</span>
            </div>
            <div style="margin-top:10px;color:var(--muted);line-height:1.6;">
              ${event.location || 'No location set'} ${event.capacity ? `- Capacity ${event.capacity}` : ''}
            </div>
            ${event.status === 'pending' ? `
              <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
                <div id="pending-${event.id}" class="chip">Pending approval</div>
                <button data-cancel="${event.id}" class="secondary-btn">Cancel (refund)</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    function collectPayload(validate = true) {
      const tiers = Array.from(tierList.querySelectorAll('.builder-item')).map((item) => {
        const name = item.querySelector('[data-tier-name]').value.trim();
        const price = Number(item.querySelector('[data-tier-price]').value || 0);
        const quantityLimitRaw = item.querySelector('[data-tier-limit]').value;
        const description = item.querySelector('[data-tier-description]').value.trim();
        return {
          id: item.dataset.tierId,
          name,
          price,
          quantityLimit: quantityLimitRaw ? Number(quantityLimitRaw) : null,
          description
        };
      }).filter((tier) => tier.name);

      const attendeeFields = Array.from(fieldList.querySelectorAll('.builder-item')).map((item) => {
        const label = item.querySelector('[data-field-label]').value.trim();
        const type = item.querySelector('[data-field-type]').value;
        const options = parseLines(item.querySelector('[data-field-options]').value);
        const required = item.querySelector('[data-field-required]').checked;
        return {
          id: item.dataset.fieldId,
          label,
          type,
          options,
          required
        };
      }).filter((field) => field.label);

      const payload = {
        title: document.getElementById('title').value.trim(),
        category: document.getElementById('category').value.trim(),
        description: document.getElementById('description').value.trim(),
        hostName: document.getElementById('hostName').value.trim(),
        location: document.getElementById('location').value.trim(),
        venue: document.getElementById('venue').value.trim(),
        startsAt: document.getElementById('startsAt').value,
        endsAt: document.getElementById('endsAt').value,
        capacity: document.getElementById('capacity').value ? Number(document.getElementById('capacity').value) : null,
        imageUrl: document.getElementById('imageUrl').value.trim(),
        videoUrl: document.getElementById('videoUrl').value.trim(),
        about: document.getElementById('about').value.trim(),
        dressCode: document.getElementById('dressCode').value.trim(),
        ticketMode: document.getElementById('ticketMode').value,
        minTicketsPerOrder: Number(document.getElementById('minTicketsPerOrder').value || 1),
        maxTicketsPerOrder: Number(document.getElementById('maxTicketsPerOrder').value || 1),
        ticketPrice: Number(document.getElementById('ticketPrice').value || 0),
        ticketLabel: document.getElementById('ticketLabel').value.trim(),
        isFree: document.getElementById('isFree').checked,
        requirements: parseLines(document.getElementById('requirements').value),
        thingsToBring: parseLines(document.getElementById('thingsToBring').value),
        mediaUrls: parseLines(document.getElementById('mediaUrls').value),
        tiers,
        attendeeFields
      };

      if (validate) {
        if (!payload.title || !payload.description || !payload.location || !payload.startsAt) {
          throw new Error('Fill the required event fields.');
        }
        if (!tiers.length) {
          throw new Error('Add at least one ticket tier, even if it is a general tier.');
        }
        if (!attendeeFields.length) {
          throw new Error('Add at least one attendee field.');
        }
      }

      return payload;
    }

    async function loadEventConfig() {
      const data = await apiFetch('/api/eventConfig');
      eventConfig = data;
      window.PAYSTACK_PUBLIC_KEY = resolvePaystackPublicKey(data);
      if (hostFeeLabel) hostFeeLabel.textContent = money(data.hostRegistrationFee + data.hostGatewayFee);
      if (attendeeFeeLabel) attendeeFeeLabel.textContent = money(data.attendeeRegistrationFee);
      if (publicKeyLabel) publicKeyLabel.textContent = window.PAYSTACK_PUBLIC_KEY ? 'Configured' : 'Missing key';
      const pricingNote = document.getElementById('pricingNote');
      if (pricingNote) {
        pricingNote.textContent =
          `Host registration is ${money(data.hostRegistrationFee)} plus gateway charge. Attendees pay ${money(data.attendeeRegistrationFee)} plus gateway charge even for free events.`;
      }
    }

    async function loadHostedEvents() {
      if (!currentUser) {
        hostedEvents = [];
        renderHostedEvents();
        return;
      }

      try {
        const data = await apiFetch('/api/getMyEvents');
        hostedEvents = Array.isArray(data.hostedEvents) ? data.hostedEvents : [];
      } catch (error) {
        hostedEvents = [];
      } finally {
        renderHostedEvents();
      }
    }

    function resetForm() {
      form.reset();
      clearBuilders();
      localStorage.removeItem('hostEventDraft');
      document.getElementById('minTicketsPerOrder').value = 1;
      document.getElementById('maxTicketsPerOrder').value = 10;
      document.getElementById('ticketPrice').value = 0;
      document.getElementById('imageUrl').value = '';
      document.getElementById('videoUrl').value = '';
      document.getElementById('mediaUrls').value = '';
      coverImageInput.value = '';
      promoVideoInput.value = '';
      extraMediaInput.value = '';
      clearMediaPreviews();
      const isFreeCheckbox = document.getElementById('isFree');
      if (isFreeCheckbox) {
        isFreeCheckbox.checked = true;
      }
      const ticketPrice = document.getElementById('ticketPrice');
      if (ticketPrice) {
        ticketPrice.disabled = true;
      }
    }

    async function publishEvent() {
      if (!currentUser) {
        showToast('Sign in first.');
        return;
      }

      try {
        const payload = collectPayload(true);
        const publicKey = resolvePaystackPublicKey(window);
        if (!publicKey) {
          showToast('Set PAYSTACK_PUBLIC_KEY before publishing.');
          return;
        }

        await uploadSelectedMedia();
        const publishPayload = {
          ...payload,
          startsAt: localDateTimeToIso(payload.startsAt),
          endsAt: localDateTimeToIso(payload.endsAt)
        };
        const hostCharge = Number(eventConfig?.hostRegistrationFee || 500) + Number(eventConfig?.hostGatewayFee || 0);
        const amountKobo = Math.round(hostCharge * 100);
        const email = currentUser.email;

        const handler = window.PaystackPop.setup({
          key: publicKey,
          email,
          amount: amountKobo,
          metadata: {
            purpose: 'host-event-registration',
            title: payload.title
          },
          callback: async (response) => {
            try {
              const result = await apiFetch('/api/publishEvent', {
                method: 'POST',
                body: JSON.stringify({
                  reference: response.reference,
                  amount: amountKobo,
                  email,
                  eventData: publishPayload
                })
              });
              showToast(`Event published: ${result.eventId}`);
              const hostUserKey = currentUser?.uid || currentUser?.email || 'guest';
              addNotification({
                userId: hostUserKey,
                role: 'host',
                category: 'event',
                priority: 2,
                title: 'Event published',
                message: `${payload.title} is live. Share it now to get attendees excited and ready.`,
                groupKey: `host-event:${result.eventId || payload.title}`
              });
              addNotification({
                userId: 'admin',
                role: 'admin',
                category: 'event',
                priority: 3,
                title: 'New event created',
                message: `${payload.title} was created and is ready for review and promotion.`,
                groupKey: `admin-event:${result.eventId || payload.title}`
              });
              localStorage.removeItem('hostEventDraft');
              await loadHostedEvents();
              resetForm();
            } catch (error) {
              showToast(error.message);
            }
          },
          onClose: () => showToast('Host payment closed.')
        });

        handler.openIframe();
      } catch (error) {
        showToast(error.message);
      }
    }

    function resetForm() {
      form.reset();
      clearBuilders();
      localStorage.removeItem('hostEventDraft');
      document.getElementById('minTicketsPerOrder').value = 1;
      document.getElementById('maxTicketsPerOrder').value = 10;
      document.getElementById('ticketPrice').value = 0;
      document.getElementById('imageUrl').value = '';
      document.getElementById('videoUrl').value = '';
      document.getElementById('mediaUrls').value = '';
      coverImageInput.value = '';
      promoVideoInput.value = '';
      extraMediaInput.value = '';
      clearMediaPreviews();
    }

        onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (!user) {
        authStatus.textContent = 'Please log in to create or manage events. Redirecting you now...';
        hostedEvents = [];
        renderHostedEvents();
        if (!window.__hostLoginRedirect) {
          window.__hostLoginRedirect = setTimeout(() => {
            window.location.href = '/login.html';
          }, 1200);
        }
        return;
      }
      if (window.__hostLoginRedirect) {
        clearTimeout(window.__hostLoginRedirect);
        window.__hostLoginRedirect = null;
      }
      authStatus.textContent = `Signed in as ${user.displayName || user.email || user.uid}. Publishing will be tied to this account.`;
      document.getElementById('hostName').value = user.displayName || '';
      await loadHostedEvents();
    });

    tierList.addEventListener('click', (event) => {
      const target = event.target.closest('[data-remove-tier]');
      if (!target) return;
      target.closest('.builder-item')?.remove();
    });

    hostedList.addEventListener('click', async (ev) => {
      const cancelBtn = ev.target.closest('[data-cancel]');
      if (!cancelBtn) return;
      const id = cancelBtn.getAttribute('data-cancel');
      if (!confirm('Cancel this event within pending window? This requests a refund.')) return;
      try {
        await apiFetch('/api/cancelEvent', { method: 'POST', body: JSON.stringify({ eventId: id }) });
        showToast('Cancellation requested. Admin will process refund.');
        await loadHostedEvents();
      } catch (err) {
        showToast(err.message);
      }
    });

    // Update pending countdowns every 10 seconds
    setInterval(() => {
      hostedEvents.forEach((ev) => {
        if (ev.status === 'pending' && ev.pendingExpiresAt) {
          const el = document.getElementById(`pending-${ev.id}`);
          if (!el) return;
          const until = new Date(ev.pendingExpiresAt).getTime();
          const diff = Math.max(0, until - Date.now());
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          el.textContent = diff > 0 ? `Pending — ${minutes}m ${seconds}s left` : 'Pending expired';
        }
      });
    }, 10000);

    fieldList.addEventListener('click', (event) => {
      const target = event.target.closest('[data-remove-field]');
      if (!target) return;
      target.closest('.builder-item')?.remove();
    });

    addTierBtn.addEventListener('click', () => addTier());
    addFieldBtn.addEventListener('click', () => addField({ label: '', type: 'text' }));
    saveDraftBtn?.addEventListener('click', saveDraft);
    resetBtn.addEventListener('click', resetForm);
    publishBtn.addEventListener('click', publishEvent);
    refreshHostedBtn.addEventListener('click', loadHostedEvents);

    document.getElementById('isFree').addEventListener('change', (event) => {
      const price = document.getElementById('ticketPrice');
      if (event.target.checked) {
        price.value = 0;
        price.disabled = true;
      } else {
        price.disabled = false;
      }
    });

    try {
      clearBuilders();
      fillFormFromDraft(loadDraft());
      await loadEventConfig();
      await loadHostedEvents();
    } catch (error) {
      showToast(error.message);
      publicKeyLabel.textContent = window.PAYSTACK_PUBLIC_KEY ? 'Configured' : 'Missing key';
    }
  
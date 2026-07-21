import { apiFetch, auth, onAuthStateChanged, formatDateTime } from './events-app.js';

const listEl = document.getElementById('list');
let currentUser = null;

function render(events) {
  if (!events.length) {
    listEl.innerHTML = '<div class="card">No pending events or cancellation requests.</div>';
    return;
  }
  listEl.innerHTML = events.map(e => {
    return `
      <div class="card" data-id="${e.id}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0">${e.title}</h3>
            <div style="color:#64748b;font-size:0.9rem">Host: ${e.hostName} — ${e.hostEmail || ''}</div>
          </div>
          <div class="chip">Status: ${e.status}</div>
        </div>
        <div style="margin-top:8px;color:#334155">${e.description || ''}</div>
        <div style="margin-top:8px">Category: ${e.category || 'General'}</div>
        <div style="margin-top:8px">Location: ${e.location || 'TBD'} • Venue: ${e.venue || 'Not set'}</div>
        <div style="margin-top:8px">Starts: ${formatDateTime(e.startsAt)}</div>
        <div style="margin-top:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;line-height:1.6;">
          <strong>Host payment details</strong><br/>
          Account name: ${e.paymentAccountName || 'Not provided'}<br/>
          Account number: ${e.paymentAccountNumber || 'Not provided'}<br/>
          Bank name: ${e.paymentBankName || 'Not provided'}
        </div>
        ${e.receiptUrl ? `<div style="margin-top:8px"><a href="${e.receiptUrl}" target="_blank">Open receipt</a><br/><img src="${e.receiptUrl}" class="receipt" alt="receipt"/></div>` : ''}
        <div style="margin-top:10px" class="actions">
          <button data-approve class="btn">Approve</button>
          <button data-reject class="btn">Reject</button>
          <button data-remove class="btn">Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

async function load() {
  try {
    const data = await apiFetch('/api/listPendingEvents');
    render(Array.isArray(data.events) ? data.events : []);
  } catch (err) {
    listEl.innerHTML = `<div class="card">Error loading: ${err.message}</div>`;
  }
}

listEl.addEventListener('click', async (ev) => {
  const card = ev.target.closest('.card');
  if (!card) return;
  const id = card.getAttribute('data-id');
  const buttons = card.querySelectorAll('button');
  const setBusy = (busy) => buttons.forEach((btn) => { btn.disabled = busy; });

  if (ev.target.matches('[data-approve]')) {
    if (!confirm('Approve this event and publish it?')) return;
    setBusy(true);
    try {
      await apiFetch('/api/adminApproveEvent', { method: 'POST', body: JSON.stringify({ eventId: id }) });
      await load();
    } catch (err) {
      alert(err.message || 'Unable to approve event.');
      setBusy(false);
    }
  } else if (ev.target.matches('[data-reject]')) {
    const reason = prompt('Reason for rejection (optional)');
    if (reason === null) return;
    setBusy(true);
    try {
      await apiFetch('/api/adminRejectEvent', { method: 'POST', body: JSON.stringify({ eventId: id, reason }) });
      await load();
    } catch (err) {
      alert(err.message || 'Unable to reject event.');
      setBusy(false);
    }
  } else if (ev.target.matches('[data-remove]')) {
    if (!confirm('Remove this event entirely? This will delete the record.')) return;
    setBusy(true);
    try {
      await fetch(`/api/removeEvent?eventId=${encodeURIComponent(id)}`, { method: 'POST' });
      await load();
    } catch (err) {
      alert(err.message || 'Unable to remove event.');
      setBusy(false);
    }
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  load();
});

load();

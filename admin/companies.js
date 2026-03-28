/* ── Companies tab ────────────────────────────────────────────────── */
import { apiFetch } from './api.js';
import { esc } from './helpers.js';

let currentCompanyFilter = 'true';

export function getCurrentCompanyFilter() { return currentCompanyFilter; }

export function filterCompanies(active) {
  currentCompanyFilter = active;
  document.querySelectorAll('[data-company-status]').forEach(b => {
    b.classList.toggle('active', b.dataset.companyStatus === active);
  });
  loadCompanies(active);
}

export async function loadCompanies(active = 'true') {
  const list = document.getElementById('company-list');
  if (!list.querySelector('.company-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const qs = active !== 'all' ? `?active=${active}` : '';
    const res = await apiFetch('/api/get-companies' + qs);
    if (!res.ok) throw new Error();
    const companies = await res.json();
    renderCompanies(companies);
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load companies.</div>';
  }
}

function renderCompanies(companies) {
  const list = document.getElementById('company-list');
  if (!companies.length) {
    list.innerHTML = '<div class="empty-state">no companies found</div>';
    return;
  }

  list.innerHTML = companies.map(c => {
    const stats = [
      c.active_courses_count ? c.active_courses_count + ' course' + (c.active_courses_count !== 1 ? 's' : '') : null,
      c.active_students_count ? c.active_students_count + ' student' + (c.active_students_count !== 1 ? 's' : '') : null,
    ].filter(Boolean).join(' · ') || 'no active courses';

    return `
    <div class="company-row" id="company-${c.id}">
      <div class="company-summary" data-action="toggleCompany" data-args="${c.id}">
        <span class="company-name">${esc(c.name)}</span>
        <span class="company-contact">${esc(c.contact_name) || '—'}</span>
        <span class="company-stats">${esc(stats)}</span>
      </div>
      <div class="company-detail" id="company-detail-${c.id}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          <div>
            <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">contact</p>
            <p style="font-size:0.82rem;color:#555;line-height:1.8;">
              ${esc(c.contact_name) || '—'}<br>
              ${c.contact_email ? '<span style="color:#aaa;">' + esc(c.contact_email) + '</span><br>' : ''}
              ${c.contact_phone ? '<span style="color:#aaa;">' + esc(c.contact_phone) + '</span>' : ''}
            </p>
          </div>
          <div>
            <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">billing</p>
            <p style="font-size:0.82rem;color:#555;line-height:1.8;">
              ${esc(c.billing_address) || '—'}<br>
              ${c.billing_email ? '<span style="color:#aaa;">' + esc(c.billing_email) + '</span><br>' : ''}
              ${c.vat_number ? 'VAT: ' + esc(c.vat_number) + '<br>' : ''}
              ${c.rate_per_session ? '<strong>' + esc(c.rate_per_session) + ' ' + esc(c.currency || 'CHF') + '</strong> per session' : ''}
            </p>
          </div>
        </div>
        ${c.notes ? '<p style="font-size:0.78rem;color:#888;margin-bottom:1rem;">' + esc(c.notes) + '</p>' : ''}
        <div style="display:flex;gap:0.5rem;">
          <button class="save-btn" data-action="editCompany" data-args="${c.id}">edit</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function toggleCompany(id) {
  document.getElementById('company-detail-' + id).classList.toggle('open');
}

export function openCompanyModal(existingData) {
  const fields = ['cm-id','cm-name','cm-contact-name','cm-contact-email','cm-contact-phone',
                   'cm-billing-address','cm-billing-email','cm-vat','cm-rate','cm-notes'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('company-modal-title').textContent = 'new company';
  const btn = document.getElementById('cm-submit');
  btn.textContent = 'save company'; btn.disabled = false;
  const msg = document.getElementById('cm-msg');
  msg.style.display = 'none'; msg.textContent = '';

  if (existingData) {
    document.getElementById('company-modal-title').textContent = 'edit company';
    document.getElementById('cm-id').value             = existingData.id || '';
    document.getElementById('cm-name').value           = existingData.name || '';
    document.getElementById('cm-contact-name').value   = existingData.contact_name || '';
    document.getElementById('cm-contact-email').value  = existingData.contact_email || '';
    document.getElementById('cm-contact-phone').value  = existingData.contact_phone || '';
    document.getElementById('cm-billing-address').value= existingData.billing_address || '';
    document.getElementById('cm-billing-email').value  = existingData.billing_email || '';
    document.getElementById('cm-vat').value            = existingData.vat_number || '';
    document.getElementById('cm-rate').value           = existingData.rate_per_session || '';
    document.getElementById('cm-notes').value          = existingData.notes || '';
  }
  document.getElementById('company-modal').classList.add('open');
}

export function closeCompanyModal() {
  document.getElementById('company-modal').classList.remove('open');
}

export async function editCompany(companyId) {
  try {
    const res = await apiFetch('/api/get-company-detail?id=' + companyId);
    if (!res.ok) throw new Error();
    const data = await res.json();
    openCompanyModal(data);
  } catch {
    alert('Could not load company details.');
  }
}

export async function submitCompany() {
  const btn   = document.getElementById('cm-submit');
  const msgEl = document.getElementById('cm-msg');
  msgEl.style.display = 'none';

  const name = document.getElementById('cm-name').value.trim();
  if (!name) {
    msgEl.textContent = 'Company name is required.';
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'saving…'; btn.disabled = true;

  const body = {
    name,
    contact_name:    document.getElementById('cm-contact-name').value.trim() || null,
    contact_email:   document.getElementById('cm-contact-email').value.trim() || null,
    contact_phone:   document.getElementById('cm-contact-phone').value.trim() || null,
    billing_address: document.getElementById('cm-billing-address').value.trim() || null,
    billing_email:   document.getElementById('cm-billing-email').value.trim() || null,
    vat_number:      document.getElementById('cm-vat').value.trim() || null,
    rate_per_session:document.getElementById('cm-rate').value ? parseFloat(document.getElementById('cm-rate').value) : null,
    notes:           document.getElementById('cm-notes').value.trim() || null,
  };
  const id = document.getElementById('cm-id').value;
  if (id) body.id = id;

  try {
    const res = await apiFetch('/api/save-company', {
      method: 'POST',
      body,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = id ? 'Company updated.' : 'Company created.';
    msgEl.className = 'modal-msg'; msgEl.style.cssText = 'display:block;color:#27ae60;font-size:0.75rem;margin-top:0.8rem;';
    btn.textContent = 'saved ✓';

    setTimeout(() => {
      closeCompanyModal();
      loadCompanies(currentCompanyFilter);
    }, 1200);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    btn.textContent = 'save company'; btn.disabled = false;
  }
}

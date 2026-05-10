/* ── Student sessions page ───────────────────────────────────────────
   Reads the access token from the URL (?token=...) and fetches
   the student's session data from the API. No login required —
   the token acts as the credential.                               */

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rt(key, ...args) {
  return window.LWG_I18N ? window.LWG_I18N.translateRuntime(key, ...args) : key;
}

async function load() {
  const token = new URLSearchParams(window.location.search).get('token');
  const content = document.getElementById('main');

  if (!token) {
    content.innerHTML = `<div class="error-state">${rt('noSessionLink')}</div>`;
    window.LWG_I18N?.localizeInternalLinks(content);
    return;
  }

  try {
    const res = await fetch('/api/student-sessions?token=' + encodeURIComponent(token));
    if (!res.ok) {
      if (res.status === 410) {
        const body = await res.json().catch(() => ({}));
        const msg = String(body.error || 'This link has expired. Please contact us for a new one.')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        content.innerHTML = `<div class="error-state">${msg}<br><a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a></div>`;
        window.LWG_I18N?.localizeInternalLinks(content);
        return;
      }
      throw new Error();
    }
    const data = await res.json();

    if (!data.courses || !data.courses.length) {
      content.innerHTML = `<h1>${rt('sessionsHeading')}</h1>
  <div class="empty-state">
<p>${rt('noSessions')}</p>
<a class="book-link" href="/enquiry.html">${rt('makeEnquiry')}</a>
  </div>`;
      window.LWG_I18N?.localizeInternalLinks(content);
      return;
    }

    const name = [data.student.firstName, data.student.lastName].filter(Boolean).join(' ');
    const level = data.student.level ? ` · ${data.student.level}` : '';

    let html = `<h1>${rt('sessionsHeading')}</h1><p class="subtitle">${name}${level}</p>`;

    data.courses.forEach((course) => {
      const total = course.sessions_total;
      const completed = course.sessions_completed || 0;
      const remaining = total ? total - completed : null;
      const pct = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
      const pctStep = Math.min(100, Math.round(pct / 5) * 5);

      const countLine = total
        ? `${completed} of ${total} ${rt('completedOf')} · ${remaining} ${rt('remaining')}`
        : `${completed} ${rt('completedOf')}`;

      const rebookNote =
        total && remaining <= 3 && remaining > 0
          ? `<p class="rebook-note">${rt('rebookSome', remaining)}</p>`
          : total && remaining === 0
            ? `<p class="rebook-note">${rt('rebookDone')}</p>`
            : '';

      const sessionRows = course.sessions
        .map(
          (s) => `
        <div class="session-row">
          <div class="session-dot ${s.status}"></div>
          <div class="session-date">${fmtDate(s.scheduled_at)}</div>
          <div class="session-label">${s.status}</div>
        </div>
      `
        )
        .join('');

      html += `
        <div class="course-block">
          <p class="course-code">${course.course_code} · ${course.service || ''} ${course.level ? '· ' + course.level : ''}</p>
          <p class="session-count">${countLine}</p>
          ${total ? `<div class="progress-bar-wrap"><div class="progress-bar progress-bar--${pctStep}"></div></div>` : ''}
          ${sessionRows || `<p class="sessions-empty-note">${rt('noSessions')}</p>`}
          ${rebookNote}
        </div>`;
    });

    content.innerHTML = html;
    window.LWG_I18N?.localizeInternalLinks(content);
  } catch {
    content.innerHTML = `<div class="error-state">${rt('couldNotLoad')}</div>`;
    window.LWG_I18N?.localizeInternalLinks(content);
  }
}

document.addEventListener('lwg:language-applied', load);
load();

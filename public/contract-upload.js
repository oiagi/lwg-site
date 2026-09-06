/* ── Signed contract upload page ─────────────────────────────────────
   Students land here via the personalised link in the contract email
   (?token=<access_token>&contract=<contract_ref>). Shows the course the
   contract belongs to and accepts one PDF/JPG/PNG upload.              */
(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const contractRef = params.get('contract');

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

  const el = (id) => document.getElementById(id);
  const show = (id) => el(id).classList.remove('is-hidden');
  const hide = (id) => el(id).classList.add('is-hidden');

  const STRINGS = {
    en: {
      title: 'your course contract',
      intro:
        'Please print the contract we emailed you, sign it, and upload a scan or photo of the signed document below.',
      courseLabel: 'course',
      fileLabel: 'signed contract (PDF, JPG or PNG, max. 10 MB) *',
      fileError: 'Please choose a PDF, JPG or PNG file up to 10 MB.',
      submit: 'upload signed contract →',
      uploading: 'uploading…',
      already: (date, replaceHint) =>
        `You already uploaded a signed contract on ${date}. ${replaceHint}`,
      replaceHint: 'Uploading a new file will replace it.',
      thanksTitle: 'thank you.',
      thanksText: "We've received your signed contract. You're all set!",
    },
    de: {
      title: 'Ihr Kursvertrag',
      intro:
        'Bitte drucken Sie den Vertrag aus, den wir Ihnen per E-Mail geschickt haben, unterschreiben Sie ihn und laden Sie unten einen Scan oder ein Foto des unterschriebenen Dokuments hoch.',
      courseLabel: 'Kurs',
      fileLabel: 'unterschriebener Vertrag (PDF, JPG oder PNG, max. 10 MB) *',
      fileError: 'Bitte wählen Sie eine PDF-, JPG- oder PNG-Datei bis 10 MB.',
      submit: 'unterschriebenen Vertrag hochladen →',
      uploading: 'wird hochgeladen…',
      already: (date, replaceHint) =>
        `Sie haben am ${date} bereits einen unterschriebenen Vertrag hochgeladen. ${replaceHint}`,
      replaceHint: 'Eine neue Datei ersetzt den bisherigen Upload.',
      thanksTitle: 'vielen Dank.',
      thanksText: 'Wir haben Ihren unterschriebenen Vertrag erhalten. Alles erledigt!',
    },
  };
  let t = STRINGS.en;

  function applyLanguage(lang) {
    t = STRINGS[lang] || STRINGS.en;
    document.documentElement.lang = lang;
    el('cu-title').textContent = t.title;
    el('cu-intro').textContent = t.intro;
    el('cu-course-label').textContent = t.courseLabel;
    el('cu-file-label').textContent = t.fileLabel;
    el('cu-file-error').textContent = t.fileError;
    el('cu-submit-btn').textContent = t.submit;
    el('cu-thanks-title').textContent = t.thanksTitle;
    el('cu-thanks-text').textContent = t.thanksText;
  }

  function fileIsValid(file) {
    return (
      file && ALLOWED_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_FILE_BYTES
    );
  }

  async function init() {
    if (!token || !contractRef) {
      hide('cu-loading');
      show('cu-error');
      return;
    }

    let info;
    try {
      const res = await fetch(
        '/api/contract-upload?token=' +
          encodeURIComponent(token) +
          '&contract=' +
          encodeURIComponent(contractRef)
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      info = await res.json();
    } catch {
      hide('cu-loading');
      show('cu-error');
      return;
    }

    applyLanguage(info.language === 'en' ? 'en' : 'de');

    const courseBits = [info.course_code, info.level, info.subject].filter(Boolean);
    el('cu-course-line').textContent = courseBits.length ? courseBits.join(' · ') : '—';

    if (info.signed_uploaded_at) {
      const date = new Date(info.signed_uploaded_at).toLocaleDateString(
        info.language === 'en' ? 'en-GB' : 'de-CH'
      );
      el('cu-already-text').textContent = t.already(date, t.replaceHint);
      show('cu-already');
    }

    hide('cu-loading');
    show('cu-content');
  }

  document.getElementById('cu-submit-btn').addEventListener('click', async () => {
    const fileInput = el('cu-file');
    const fileError = el('cu-file-error');
    const submitError = el('cu-submit-error');
    const btn = el('cu-submit-btn');
    fileError.classList.remove('is-visible-block');
    submitError.classList.remove('is-visible-block');

    const file = fileInput.files && fileInput.files[0];
    if (!fileIsValid(file)) {
      fileError.classList.add('is-visible-block');
      return;
    }

    btn.disabled = true;
    btn.textContent = t.uploading;

    try {
      const form = new FormData();
      form.append('token', token);
      form.append('contract', contractRef);
      form.append('file', file);

      const res = await fetch('/api/contract-upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      hide('cu-content');
      show('cu-thanks');
      window.scrollTo({ top: 0 });
    } catch {
      submitError.classList.add('is-visible-block');
      btn.disabled = false;
      btn.textContent = t.submit;
    }
  });

  init();
})();

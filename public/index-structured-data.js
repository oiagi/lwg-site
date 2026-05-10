(() => {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent =
    '{\n    "@context": "https://schema.org",\n    "@type": "LocalBusiness",\n    "name": "Learning with Gioia",\n    "url": "https://learningwithgioia.ch",\n    "logo": "https://learningwithgioia.ch/lwg_logo.svg",\n    "image": "https://learningwithgioia.ch/gioia_logo.png",\n    "description": "Language courses, exam preparation and tutoring in Zürich. Native-speaking teachers with linguistics degrees and formal teaching qualifications.",\n    "address": {\n      "@type": "PostalAddress",\n      "addressLocality": "Zürich",\n      "addressCountry": "CH"\n    },\n    "email": "info@learningwithgioia.ch",\n    "areaServed": {\n      "@type": "City",\n      "name": "Zürich"\n    },\n    "knowsLanguage": ["de", "en", "gsw"],\n    "serviceType": ["Language courses", "Exam preparation", "Tutoring"]\n  }';
  document.head.appendChild(script);
})();

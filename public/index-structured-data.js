(() => {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Learning with Gioia',
    url: 'https://learningwithgioia.ch',
    logo: {
      '@type': 'ImageObject',
      url: 'https://learningwithgioia.ch/lwg_logo.svg',
    },
    image: 'https://learningwithgioia.ch/gioia_logo.png',
    description:
      'Language courses, exam preparation and tutoring in Zürich. Native-speaking teachers with linguistics degrees and formal teaching qualifications.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Zürich',
      addressCountry: 'CH',
    },
    email: 'info@learningwithgioia.ch',
    areaServed: {
      '@type': 'City',
      name: 'Zürich',
    },
    knowsLanguage: ['de', 'en', 'gsw'],
    serviceType: ['Language courses', 'Exam preparation', 'Tutoring'],
  });
  document.head.appendChild(script);
})();

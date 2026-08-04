(() => {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Learning with Gioia',
    url: 'https://learningwithgioia.ch/en/',
    logo: {
      '@type': 'ImageObject',
      url: 'https://learningwithgioia.ch/lwg_logo.svg',
    },
    image: 'https://learningwithgioia.ch/gioia_logo.png',
    description:
      'German and Swiss German courses, Gymivorbereitung, exam preparation and tutoring in Zürich. Native-speaking teachers with linguistics degrees and formal teaching qualifications.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Zürich',
      addressCountry: 'CH',
    },
    email: 'info@learningwithgioia.ch',
    priceRange: 'CHF 1600–4800 per course',
    areaServed: {
      '@type': 'City',
      name: 'Zürich',
    },
    knowsLanguage: ['de', 'en', 'gsw'],
    serviceType: [
      'Language courses',
      'Swiss German courses',
      'Gymivorbereitung',
      'English courses',
      'Exam preparation',
      'Company language courses',
      'Lunchtime German courses',
      'Intensive German courses',
      'Tutoring',
    ],
  });
  document.head.appendChild(script);
})();

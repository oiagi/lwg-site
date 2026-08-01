// Emits Course + Offer JSON-LD for the six course detail pages.
// Reads the page's own title/description and the data-course-* attributes
// on <body> so a single script serves all of them. Workload and prices
// default to the standard course (32 lessons, CHF 1600 / CHF 3840); pages
// with a different structure override them via data-course-* attributes.
(() => {
  const data = document.body.dataset;
  const canonical = document.querySelector('link[rel="canonical"]');
  const description = document.querySelector('meta[name="description"]');
  const workload = data.courseWorkload || 'PT32H';
  const priceGroup = data.coursePriceGroup || '1600';
  const priceSolo = data.coursePriceSolo || '3840';

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: data.courseName,
    description: description ? description.content : '',
    url: canonical ? canonical.href : '',
    inLanguage: data.courseLanguage,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Learning with Gioia',
      url: 'https://learningwithgioia.ch/en/',
    },
    hasCourseInstance: [
      {
        '@type': 'CourseInstance',
        courseMode: 'onsite',
        courseWorkload: workload,
        location: {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: 'Zürich', addressCountry: 'CH' },
        },
        offers: {
          '@type': 'Offer',
          price: priceGroup,
          priceCurrency: 'CHF',
          category: 'group course, per person',
        },
      },
      {
        '@type': 'CourseInstance',
        courseMode: 'onsite',
        courseWorkload: workload,
        location: {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: 'Zürich', addressCountry: 'CH' },
        },
        offers: {
          '@type': 'Offer',
          price: priceSolo,
          priceCurrency: 'CHF',
          category: 'one-to-one',
        },
      },
    ],
  });
  document.head.appendChild(script);
})();

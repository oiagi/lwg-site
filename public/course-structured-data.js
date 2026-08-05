// Emits Course + Offer JSON-LD for the course detail pages.
// Reads the page's own title/description and the data-course-* attributes
// on <body> so a single script serves all of them. Workload, prices and
// offer categories default to the standard course (32 lessons, CHF 1600 /
// CHF 3840 for the whole course); pages with a different structure, such as
// the per-lesson ones, override them via data-course-* attributes. Pages
// that quote no price (company courses) set data-course-price-on-request
// and get course instances without offers.
(() => {
  const data = document.body.dataset;
  const canonical = document.querySelector('link[rel="canonical"]');
  const description = document.querySelector('meta[name="description"]');
  const workload = data.courseWorkload || 'PT32H';
  const priceGroup = data.coursePriceGroup || '1600';
  const priceSolo = data.coursePriceSolo || '3840';
  const categoryGroup = data.courseCategoryGroup || 'group course, per person';
  const categorySolo = data.courseCategorySolo || 'one-to-one';
  const onRequest = data.coursePriceOnRequest === 'true';

  const instance = (price, category) => {
    const courseInstance = {
      '@type': 'CourseInstance',
      courseMode: 'onsite',
      courseWorkload: workload,
      location: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: 'Zürich', addressCountry: 'CH' },
      },
    };
    if (!onRequest) {
      courseInstance.offers = {
        '@type': 'Offer',
        price,
        priceCurrency: 'CHF',
        category,
      };
    }
    return courseInstance;
  };

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
    hasCourseInstance: onRequest
      ? [instance()]
      : [instance(priceGroup, categoryGroup), instance(priceSolo, categorySolo)],
  });
  document.head.appendChild(script);
})();

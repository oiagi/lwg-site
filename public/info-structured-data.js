(() => {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        name: 'German Language Course',
        description:
          'German language courses for all levels, taught by native speakers with linguistics degrees.',
        provider: {
          '@type': 'Organization',
          name: 'Learning with Gioia',
          url: 'https://learningwithgioia.ch/en/',
        },
        inLanguage: 'de',
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'onsite',
          location: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Zürich',
              addressCountry: 'CH',
            },
          },
        },
      },
      {
        '@type': 'Course',
        name: 'English Language Course',
        description:
          'English language courses for all levels, taught by native speakers with linguistics degrees.',
        provider: {
          '@type': 'Organization',
          name: 'Learning with Gioia',
          url: 'https://learningwithgioia.ch/en/',
        },
        inLanguage: 'en',
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'onsite',
          location: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Zürich',
              addressCountry: 'CH',
            },
          },
        },
      },
      {
        '@type': 'Course',
        name: 'Exam Preparation',
        description: 'Preparation for Cambridge, TOEFL, IELTS, TELC and Goethe language exams.',
        provider: {
          '@type': 'Organization',
          name: 'Learning with Gioia',
          url: 'https://learningwithgioia.ch/en/',
        },
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'onsite',
          location: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Zürich',
              addressCountry: 'CH',
            },
          },
        },
      },
    ],
  });
  document.head.appendChild(script);
})();

const en = {
  tabs: {
    home: 'Home',
    adoption: 'Adoption',
    post: 'Post',
    rescue: 'Rescue',
    profile: 'Profile',
  },
  comingSoon: {
    title: 'Coming soon',
    stage: 'This section arrives in stage {{stage}}.',
  },
  home: {
    title: 'Pawly',
    description: 'Your pets’ feed will appear here.',
  },
  adoption: {
    title: 'Adoption',
    description: 'Pets looking for a home and the follow-up after adoption.',
  },
  post: {
    title: 'New post',
    description: 'Share photos, videos and text about your pets.',
  },
  rescue: {
    title: 'Rescue',
    description: 'Strays that need help and lost or found animals near you.',
  },
  profile: {
    title: 'Profile',
    description: 'Your profile, your pets and your posts.',
    settings: 'Settings',
  },
  settings: {
    title: 'Settings',
    theme: {
      title: 'Theme',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
    language: {
      title: 'Language',
      system: 'System',
      es: 'Español',
      en: 'English',
    },
  },
};

type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Translation<T[K]> };

/** Shape every language must follow. TypeScript fails if a key is missing or extra. */
export type Resources = Translation<typeof en>;

export default en satisfies Resources;

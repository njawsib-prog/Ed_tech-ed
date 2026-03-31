import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        sidebar: 'var(--color-sidebar-bg)',
      },
      fontFamily: {
        sans: 'var(--font-family)',
      },
      borderRadius: {
        DEFAULT: 'var(--border-radius)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
      },
      transitionDuration: {
        DEFAULT: 'var(--transition)',
      },
    },
  },
  plugins: [],
};

export default config;
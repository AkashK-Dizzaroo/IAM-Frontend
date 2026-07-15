/**
 * Dizzaroo design tokens — JS access point.
 *
 * Single source of truth for styling is the Tailwind theme
 * (tailwind.config.js + CSS variables in src/index.css). Import from here
 * ONLY when a value is needed outside of class names (charts, canvas,
 * third-party libs). Never hardcode these hex values in feature code.
 */

export const colors = {
  primary: {
    500: '#1E73BE', // Deep Blue — primary actions, links, active states
    600: '#1E6091', // Deep Blue (darker) — hover/active on primary
  },
  accent: {
    green: '#76C893', // Soft Green
    teal: '#168AAD', // Blue Green
  },
  semantic: {
    success: 'hsl(142 71% 32%)',
    warning: 'hsl(32 95% 40%)',
    error: 'hsl(0 72% 45%)',
  },
};

/** Addendum §4.1 spacing scale (px) → Tailwind step to use in class names. */
export const spacing = {
  'space.1': { px: 4, tailwind: '1' },
  'space.2': { px: 8, tailwind: '2' },
  'space.3': { px: 12, tailwind: '3' },
  'space.4': { px: 16, tailwind: '4' },
  'space.5': { px: 24, tailwind: '6' },
  'space.6': { px: 32, tailwind: '8' },
};

/** Addendum §4.2 radius scale → Tailwind class. */
export const radius = {
  sm: { px: 4, tailwind: 'rounded-sm' },
  md: { px: 8, tailwind: 'rounded-md' }, // default: buttons, inputs, chips, small cards
  lg: { px: 12, tailwind: 'rounded-lg' }, // large cards, panels, modals
};

/**
 * Addendum §2 typography hierarchy → Tailwind fontSize tokens
 * (text-title, text-heading, text-subheading, text-body, text-caption).
 * All UI text is Urbanist; Arista 2.0 Alternate is reserved for the logo.
 */
export const typography = {
  title: { class: 'text-title', px: 30, weight: 900 },
  heading: { class: 'text-heading', px: 24, weight: 700 },
  subheading: { class: 'text-subheading', px: 20, weight: 600 },
  body: { class: 'text-body', px: 14, weight: 400 },
  caption: { class: 'text-caption', px: 13, weight: 500 },
};

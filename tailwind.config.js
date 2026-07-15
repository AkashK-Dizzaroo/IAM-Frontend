import animate from 'tailwindcss-animate';

/**
 * Dizzaroo Web UI Addendum v0.1 — design tokens.
 *
 * Color values live as HSL triplets in src/index.css (:root / .dark) so both
 * themes share one utility set. Hex sources of truth:
 *   primary.500  #1E73BE   primary.600 #1E6091 (hover/darker)
 *   accent.green #76C893   accent.teal #168AAD
 *
 * Spacing uses Tailwind's default 4px grid. Addendum scale mapping:
 *   space.1=4px→`1` space.2=8px→`2` space.3=12px→`3`
 *   space.4=16px→`4` space.5=24px→`6` space.6=32px→`8`
 * Never use arbitrary pixel values (p-[10px] etc.) in feature code.
 */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // All product UI text is Urbanist (Arista 2.0 Alternate is logo-only).
        sans: ['Urbanist', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Addendum §2 type hierarchy — use these instead of ad-hoc size+weight combos.
      fontSize: {
        title: ['1.875rem', { lineHeight: '2.375rem', fontWeight: '900' }],      // Page Title 30px Black
        heading: ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],          // Section Heading 24px Bold
        subheading: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],   // Sub-heading 20px Semibold
        body: ['0.875rem', { lineHeight: '1.375rem', fontWeight: '400' }],       // Body 14px
        caption: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }],   // Caption/Label 13px Medium
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',        // Deep Blue #1E73BE
          foreground: 'hsl(var(--primary-foreground))',
          500: 'hsl(var(--primary))',
          600: 'hsl(var(--primary-600))',        // Deep Blue #1E6091 — hover/active
        },
        accent: {
          // DEFAULT/foreground keep the shadcn "subtle hover surface" role used
          // by existing components; brand accents are addressable sub-keys.
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          green: 'hsl(var(--accent-green))',     // Soft Green #76C893
          teal: 'hsl(var(--accent-teal))',       // Blue Green #168AAD
        },
        // Semantic feedback tokens (addendum §3). `soft` = light tint surface
        // for pills/alert cards; DEFAULT = solid fill with white foreground.
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
        },
        // Addendum alias — `error` and `destructive` are the same token.
        error: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      // Addendum §4.2 — radius.sm 4px, radius.md 8px (buttons/inputs/small cards),
      // radius.lg 12px (large cards/panels/modals).
      borderRadius: {
        sm: '0.25rem',
        md: 'var(--radius)',
        lg: '0.75rem',
        xl: '1rem',
      },
      // Addendum §4.3 — named elevation tokens.
      boxShadow: {
        sm: '0 1px 2px 0 rgb(16 24 40 / 0.06)',
        md: '0 2px 8px -2px rgb(16 24 40 / 0.10), 0 1px 2px 0 rgb(16 24 40 / 0.06)',
        lg: '0 12px 32px -8px rgb(16 24 40 / 0.18), 0 4px 12px -4px rgb(16 24 40 / 0.08)',
      },
    },
  },
  plugins: [animate],
};

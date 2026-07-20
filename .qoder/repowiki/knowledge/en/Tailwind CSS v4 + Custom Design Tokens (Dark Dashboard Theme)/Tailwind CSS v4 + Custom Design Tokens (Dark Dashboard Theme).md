---
kind: frontend_style
name: Tailwind CSS v4 + Custom Design Tokens (Dark Dashboard Theme)
category: frontend_style
scope:
    - '**'
source_files:
    - frontend/src/index.css
    - frontend/package.json
    - frontend/src/App.jsx
    - frontend/src/components/Sidebar.jsx
    - frontend/src/context/ToastContext.jsx
---

The frontend uses a dark, glassmorphism-styled dashboard built with React + Vite and Tailwind CSS v4. Styling is centralized in a single global stylesheet (frontend/src/index.css) that imports Tailwind via @import "tailwindcss" and defines a comprehensive design-token system through CSS custom properties on :root. There is no component-scoped CSS or CSS-in-JS library — all visual styling lives in this one file, which also includes the full layout, sidebar, cards, tables, badges, buttons, forms, modals, drawers, drag-and-drop upload zones, login page, and toast notifications.

System and approach:
- Framework: React 19 with Vite as the dev/build toolchain.
- Styling engine: Tailwind CSS v4 (@tailwindcss/vite plugin) imported at the top of index.css; utility classes are used alongside a large set of hand-written BEM-style class names defined in the same file.
- Animation: Framer Motion for UI transitions; Three.js + React Three Fiber/Drei for optional 3D assets.
- Icons: Lucide React icons consumed directly in JSX.
- Fonts: Google Fonts Outfit + Inter loaded via @import url(...).

Key files:
- frontend/src/index.css — global tokens, layout, components, pages, responsive rules (~2000 lines).
- frontend/package.json — declares tailwindcss, @tailwindcss/vite, framer-motion, lucide-react, three, @react-three/fiber, @react-three/drei.
- frontend/src/App.jsx — root shell applying .app-container / .main-content wrapper classes.
- frontend/src/components/Sidebar.jsx — navigation shell using .sidebar, .sidebar-item-link, etc.
- frontend/src/context/ToastContext.jsx — toast notification container using .toast-container / .toast-item.
- frontend/src/pages/*.jsx — page components compose the token-driven classes from index.css (e.g. .card, .badge, .btn-primary, .metric-card).

Architecture and conventions:
- Single-source-of-truth stylesheet: all styles live in index.css; App.css is a placeholder noting that styles are global.
- Design tokens via CSS variables under --bg-*, --text-*, --primary, --accent-teal, --success, --warning, --danger, --glass-*, --font-family, --transition, --shadow, --radius.
- Component naming follows a consistent BEM-like convention: .card, .badge.success|warning|danger|info, .btn.btn-primary|btn-secondary, .metric-card.primary|teal|success|warning, .form-control/.form-input/.login-form-input, .slide-drawer.open, .upload-zone.dragging, .toast-item.toast-success|error|info.
- Layout primitives: .app-container -> .sidebar + .main-content -> .page-wrapper; grid layouts use .metrics-grid (auto-fit minmax) and .dashboard-grid (2fr/1fr collapsing to 1fr below 1024px).
- Dark theme only: no light-mode toggle; colors are fixed around #080c16 background with subtle glows and backdrop-blur glass panels.
- Responsive strategy: minimal breakpoints (notably @media (max-width: 1024px) for dashboard grid); most sizing relies on Tailwind utilities plus percentage-based grids.

Rules developers should follow:
- Do not create new CSS files; extend index.css and reuse existing token variables and class prefixes.
- Prefer existing component classes (.card, .badge.*, .btn.*, .form-control, .metric-card.*) over ad-hoc overrides.
- When adding new colors or spacing, define them as CSS variables under :root before using them in selectors.
- Keep animations within the established transition curve var(--transition) unless a special effect is justified.
- Use Lucide React icons rather than inline SVGs or image assets for consistency.
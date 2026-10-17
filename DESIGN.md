---
name: Malcon Nexus
description: Apple-inspired light operational UI for hospital implant case workflows
colors:
  bg: "#f5f5f7"
  bg-elevated: "#ffffff"
  label: "#1d1d1f"
  label-secondary: "#6e6e73"
  label-tertiary: "#86868b"
  separator: "rgba(0, 0, 0, 0.08)"
  accent: "#0071e3"
  accent-hover: "#0077ed"
  danger: "#ff3b30"
  success: "#248a3d"
  warning: "#b25000"
typography:
  sans:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Helvetica Neue, Helvetica, Arial, sans-serif"
  body:
    fontSize: "0.8125rem"
    lineHeight: 1.45
rounded:
  sm: "10px"
  md: "12px"
  lg: "20px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
  modal:
    backgroundColor: "{colors.bg-elevated}"
    rounded: "{rounded.lg}"
---

## Overview

Malcon Nexus is a production operations SPA for Malcon’s implant case lifecycle: set preparation through billing, employee assignment, attendance, expenses, and admin approvals. The main app uses a **light, Apple HIG–inspired** shell (sidebar + top bar + scrollable content). Semantic colors encode **workflow stage**, **priority**, and **status**—do not replace them with a generic palette.

Source of truth for tokens: `src/styles/tokens.css`. Tailwind utilities often mirror tokens via `var(--color-*)` and legacy `--mn-*` aliases.

## Colors

- **Neutrals:** `--color-bg`, `--color-bg-elevated`, `--color-label` (+ secondary/tertiary), `--color-separator`.
- **Brand / actions:** `--color-accent`, `--color-accent-muted`, `--color-on-accent`.
- **Feedback:** `--color-danger`, `--color-success`, `--color-warning`.
- **Stage / priority / status:** Defined in app helpers (e.g. `stageColors`, `priorityColors`)—intentional and workflow-specific.
- **FCFS Checking pool:** Purple accents on employee dashboard—semantic “pool” branding, not decorative AI styling.

## Typography

System sans stack (`--font-sans`). Scale uses `--text-caption` through `--text-title-*`. Prefer `--color-label*` over raw `gray-*` in new code; many legacy screens still use Tailwind grays.

## Layout

- Shell: `--sidebar-width`, `--topbar-height`, `100dvh` app shell, safe-area insets on mobile modals.
- Pages: `NexusPage` / cards, mobile card lists + desktop tables (`lg:` breakpoints).
- Modals: bottom sheet on small viewports, centered on `sm+`; `PickerSheet` for pickers; shared `Modal` for forms.

## Elevation & Depth

`--shadow-card`, `--shadow-popover`, `--shadow-modal`, `--overlay-scrim`. Avoid new gratuitous shadows or gradients in the main app.

## Shapes

Radii: `--radius-sm` (controls), `--radius-md`, `--radius-lg` (cards/modals). Pills for badges where existing patterns use them.

## Components

- **Buttons:** `src/components/ui/Button` — primary / outline / danger; accent focus rings `focus-visible:ring-[var(--color-accent)]`.
- **Modals:** `role="dialog"`, `aria-modal`, labelled title, focus trap, focus restore on close.
- **Forms:** `nexus-field-input`, `NEXUS_FORM_CONTROL`; labels must use `htmlFor` + `id`.
- **Case create:** Step flow with `PickerSheet`, 44px+ targets, section `aria-labelledby`.

## TV Board (display mode)

Separate entry (`TvBoard.tsx`, optional `vite.tv.config.ts`). Uses **explicit hex colors** on a dark field—not the main app token remap (see file header comment). Stage colors are **display semantics** for a wall monitor; do not force-match the light SPA theme.

Documented constants in code: `INK`, `INK_MUTED`, `STAGE_COLOR`, etc.

## Do's and Don'ts

**Do**

- Extend existing tokens and components.
- Respect `prefers-reduced-motion` (global duration tokens + component-level disables).
- Use contextual `alt` text for evidence photos (case number, stage, index).
- Target ~44×44px touch areas on mobile for icon-only controls.

**Don't**

- Redesign the product or introduce a new visual language.
- Remove intentional stage/priority/pool colors to satisfy generic “AI palette” detectors.
- Add dark mode unless product requires it.
- Remove `vite-plugin-singlefile` without validating Hostinger single-HTML deploy.

## Accessibility

- Dialogs: focus trap, Escape where dismiss is supported, restore focus to trigger.
- Tables: icon actions need `aria-label` on mobile-sized hit targets.
- Photos: meaningful alts from available metadata only.

## Motion

Page transitions in `App.tsx` (subtle opacity/y). Prefer **container** animation over per-row stagger on long lists. List pages should not animate every row on render.

## Responsive

Mobile-first cards; dense tables on `lg+`. Pagination: larger tap targets on mobile, compact on desktop.

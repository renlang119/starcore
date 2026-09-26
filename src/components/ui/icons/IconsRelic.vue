<template>
  <!-- 遗物图标（含 i-nav-relic 导航兜底 + i-relic-omega r_omega 遗物占用 + i-relic-armor / i-relic-capsule） -->
  <symbol
    id="i-nav-relic"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 2 2 8l10 6 8-6-8-6z" />
    <path d="M2 16l10 6 8-6" />
    <path d="M2 12l10 6 8-6" />
  </symbol>
  <symbol
    id="i-relic-omega"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 10a4 4 0 1 1 6 3.5c-1 .5-2 1-2 2.5" />
    <circle cx="12" cy="18" r=".5" fill="currentColor" />
  </symbol>
  <!-- 遗物独立化图标（Phase 1） -->
  <symbol
    id="i-relic-energy-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M13 3 8 11h3l-1 5 5-8h-3l1-5z" />
    <path d="M4 9l2 2 1 3M20 15l-2-2-1-2" />
  </symbol>
  <symbol
    id="i-relic-energy-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 4L19 9L17 15L12 20L7 15L5 9Z" />
    <path d="M13 9L10 13h2l-1 3 3-4h-2l1-4z" />
    <path d="M12 4L8 9L12 12L16 9Z" />
  </symbol>
  <symbol
    id="i-relic-energy-3"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M3 12a9 9 0 0 1 18 0" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M5 7l2 2M19 7l-2 2" />
    <path d="M7 17l2-1M17 17l-2-1" />
  </symbol>
  <symbol
    id="i-relic-crystal-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 6L17 12L12 18L7 12Z" />
    <path d="M9 10l3 2 3-2" />
  </symbol>
  <symbol
    id="i-relic-crystal-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 4L18 12L12 20L6 12Z" />
    <path d="M12 6L14 9L12 12L10 9Z" />
    <path d="M12 12L14 15L12 18L10 15Z" />
  </symbol>
  <symbol
    id="i-relic-alloy-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 4L18 8L18 16L12 20L6 16L6 8Z" />
    <path d="M8 11l2 2 1-1 2 1" />
  </symbol>
  <symbol
    id="i-relic-alloy-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 4L18 8L18 16L12 20L6 16L6 8Z" />
    <path d="M9 9h6M9 15h6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </symbol>
  <symbol
    id="i-relic-data-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="6" y="8" width="12" height="8" rx="1" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </symbol>
  <symbol
    id="i-relic-data-3"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <ellipse cx="12" cy="12" rx="8" ry="4" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="20" cy="12" r="1" />
  </symbol>
  <symbol
    id="i-relic-dark-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="8" stroke-dasharray="1 2" stroke-width="1.5" />
  </symbol>
  <symbol
    id="i-relic-dark-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M16 12a4 4 0 1 1-4-4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </symbol>
  <symbol
    id="i-relic-dark-3"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="9" stroke-dasharray="2 3" stroke-width="1.5" />
    <path d="M5 8C8 12 16 12 19 8" />
    <path d="M5 16C8 12 16 12 19 16" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </symbol>
  <symbol
    id="i-relic-combat-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 3L5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3z" />
    <path d="M12 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
    <path d="M8 6h8" />
  </symbol>
  <symbol
    id="i-relic-combat-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M7 9C8 7 16 7 17 9" />
    <path d="M7 15C8 17 16 17 17 15" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </symbol>
  <symbol
    id="i-relic-armor"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 3L5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3z" />
    <path d="M9 9.5h6M9 12.5h6" />
    <path d="M10.5 15.5h3" />
  </symbol>
  <symbol
    id="i-relic-explore"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M4 4L10 6L16 4L20 6V18L16 20L10 18L4 20Z" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <path d="M7 6l1 4 3 2 0 4 2 2" />
  </symbol>
  <symbol
    id="i-relic-singularity"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4M12 12l3 2" />
    <path d="M5 9l3 1 2 4 4 1" />
  </symbol>
  <symbol
    id="i-relic-capsule"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="7" y="4" width="10" height="16" rx="5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 10.3V12l1.5 1" />
  </symbol>
  <symbol
    id="i-relic-silence"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="9" stroke-dasharray="2 3" stroke-width="1.5" />
    <path d="M5 12c3-4 11-4 14 0c-3 4-11 4-14 0z" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M4 12h16" />
    <path d="M12 3v3" />
  </symbol>
</template>

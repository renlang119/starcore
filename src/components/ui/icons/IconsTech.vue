<script setup lang="ts">
// 科技 + 分支图标
</script>

<template>
  <svg style="display:none" aria-hidden="true">
    <defs>
      <!-- 科技去重图标（Phase 1） -->
      <symbol id="i-tech-mil-basic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3L6 6v5c0 4 2 7 6 9 4-2 6-5 6-9V6l-6-3z"/><path d="M12 6v10M10 8h4M12 6l-1-2M12 6l1-2"/>
      </symbol>
      <symbol id="i-tech-weapon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 5L16 16M14 18l4-4M16 16l3 3"/><path d="M19 5L8 16M6 14l4 4M8 16l-3 3"/>
      </symbol>
      <symbol id="i-tech-armor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3L5 6V12C5 16 8 19 12 20C16 19 19 16 19 12V6L12 3Z"/><path d="M12 3v17M5 12h14"/>
      </symbol>
      <symbol id="i-tech-crystal-grow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 4L17 12L12 20L7 12Z"/><path d="M12 8v8M9 11l3-3 3 3"/>
      </symbol>
      <symbol id="i-tech-deep-mine" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5L18 12L12 19L6 12Z"/><path d="M12 8v8M9 13l3 3 3-3"/>
      </symbol>
      <!-- 科技图标（Phase 2） -->
      <symbol id="i-tech-prestige" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12a7 7 0 1 0-7 7"/>
        <path d="M15 12a3 3 0 1 0-3 3"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
      </symbol>
      <symbol id="i-tech-offline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="15" r="5"/>
        <path d="M12 12v3l2 1"/>
        <path d="M6 8a6 6 0 0 1 9-3M13 3l2 2-3 2"/>
      </symbol>
      <symbol id="i-tech-explore-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="17" r="1" fill="currentColor"/>
        <path d="M9 14a4 4 0 0 1 6 0"/>
        <path d="M5 11a8 8 0 0 1 14 0"/>
      </symbol>
      <symbol id="i-tech-explore-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 16L15 9L17 11L10 18z"/>
        <path d="M15 9l3-3 2 2-3 3z"/>
        <path d="M8 16l-2 4M8 16l4 2M8 16l1 4"/>
      </symbol>
      <symbol id="i-tech-energy-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 3L5 12h3l-1 5 5-8h-3l2-6z"/>
        <path d="M17 13v6M14 16l3-3 3 3"/>
        <path d="M15 9h4M17 7v4"/>
      </symbol>
      <symbol id="i-tech-alloy-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 5L3 8v5l5 3 5-3V8L8 5z"/>
        <path d="M17 13v6M14 16l3-3 3 3"/>
        <path d="M15 9h4M17 7v4"/>
      </symbol>
      <symbol id="i-tech-crystal-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 5L13 10L8 15L3 10Z"/>
        <path d="M17 13v6M14 16l3-3 3 3"/>
        <path d="M15 9h4M17 7v4"/>
      </symbol>
      <symbol id="i-tech-research" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="9" width="7" height="6" rx="1"/>
        <circle cx="16" cy="12" r="3"/>
        <path d="M16 7v2M16 15v2M19 12h2M11 12h2"/>
        <circle cx="16" cy="12" r="1" fill="currentColor"/>
      </symbol>
      <symbol id="i-tech-data-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="6" width="9" height="8" rx="1"/>
        <path d="M17 13v6M14 16l3-3 3 3"/>
        <path d="M15 9h4M17 7v4"/>
      </symbol>
      <symbol id="i-tech-dark-eff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8"/>
        <path d="M16 12a4 4 0 1 0-4 4"/>
        <path d="M9 14l3 2M9 18l3-2"/>
      </symbol>
      <!-- 科技分支图标（Phase 2） -->
      <symbol id="i-branch-military" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3L5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3z"/>
        <path d="M8 8L15 15M13 17l4-4"/>
        <path d="M16 8L9 15M7 13l4 4"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
      </symbol>
      <symbol id="i-branch-explore" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 6h12l4 4v8H4z"/>
        <path d="M8 10L15 11L10 15"/>
        <path d="M7 9l2 2M9 9l-2 2M14 10l2 2M16 10l-2 2M9 14l2 2M11 14l-2 2"/>
      </symbol>
      <symbol id="i-branch-crystal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3L21 12L12 21L3 12Z"/>
        <path d="M12 5v14M12 9l-4-2M12 9l4-2M12 15l-4 2M12 15l4 2"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
      </symbol>
      <symbol id="i-branch-material" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 5L17 5L21 12L17 19L7 19L3 12Z"/>
        <path d="M6 9h12M6 12h12M6 15h12"/>
        <path d="M10 9v6M14 9v6"/>
      </symbol>
      <symbol id="i-branch-computing" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="1"/>
        <path d="M4 12h16M12 4v16"/>
        <circle cx="8" cy="8" r="1.5"/>
        <circle cx="16" cy="16" r="1.5"/>
      </symbol>
      <symbol id="i-branch-singularity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 12A8 8 0 1 1 12 4"/>
        <path d="M12 7A5 5 0 1 1 7 12"/>
        <path d="M9 12A3 3 0 1 1 12 15"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
      </symbol>
    </defs>
  </svg>
</template>

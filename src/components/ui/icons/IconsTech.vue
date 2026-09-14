<script setup lang="ts">
// 科技 + 分支图标
</script>

<template>
  <svg style="display: none" aria-hidden="true">
    <defs>
      <!-- 科技去重图标（Phase 1） -->
      <symbol
        id="i-tech-mil-basic"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3L6 6v5c0 4 2 7 6 9 4-2 6-5 6-9V6l-6-3z" />
        <path d="M12 6v10M10 8h4M12 6l-1-2M12 6l1-2" />
      </symbol>
      <symbol
        id="i-tech-weapon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 5L16 16M14 18l4-4M16 16l3 3" />
        <path d="M19 5L8 16M6 14l4 4M8 16l-3 3" />
      </symbol>
      <symbol
        id="i-tech-armor"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3L5 6V12C5 16 8 19 12 20C16 19 19 16 19 12V6L12 3Z" />
        <path d="M12 3v17M5 12h14" />
      </symbol>
      <symbol
        id="i-tech-crystal-grow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 4L17 12L12 20L7 12Z" />
        <path d="M12 8v8M9 11l3-3 3 3" />
      </symbol>
      <symbol
        id="i-tech-deep-mine"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3v8M9 8l3 3 3-3" />
        <path d="M4 14h16" />
        <path d="M7 14l5 6 5-6" />
      </symbol>
      <!-- 科技图标（Phase 2） -->
      <symbol
        id="i-tech-prestige"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12a7 7 0 1 0-7 7" />
        <path d="M15 12a3 3 0 1 0-3 3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-offline"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="15" r="5" />
        <path d="M12 12v3l2 1" />
        <path d="M6 8a6 6 0 0 1 9-3M13 3l2 2-3 2" />
      </symbol>
      <symbol
        id="i-tech-explore-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="17" r="1" fill="currentColor" />
        <path d="M9 14a4 4 0 0 1 6 0" />
        <path d="M5 11a8 8 0 0 1 14 0" />
      </symbol>
      <symbol
        id="i-tech-explore-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 16L15 9L17 11L10 18z" />
        <path d="M15 9l3-3 2 2-3 3z" />
        <path d="M8 16l-2 4M8 16l4 2M8 16l1 4" />
      </symbol>
      <symbol
        id="i-tech-energy-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M11 3L5 12h3l-1 5 5-8h-3l2-6z" />
        <path d="M17 13v6M14 16l3-3 3 3" />
        <path d="M15 9h4M17 7v4" />
      </symbol>
      <symbol
        id="i-tech-alloy-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 5L3 8v5l5 3 5-3V8L8 5z" />
        <path d="M17 13v6M14 16l3-3 3 3" />
        <path d="M15 9h4M17 7v4" />
      </symbol>
      <symbol
        id="i-tech-crystal-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 5L13 10L8 15L3 10Z" />
        <path d="M17 13v6M14 16l3-3 3 3" />
        <path d="M15 9h4M17 7v4" />
      </symbol>
      <symbol
        id="i-tech-research"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="9" width="7" height="6" rx="1" />
        <circle cx="16" cy="12" r="3" />
        <path d="M16 7v2M16 15v2M19 12h2M11 12h2" />
        <circle cx="16" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-data-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="6" width="9" height="8" rx="1" />
        <path d="M17 13v6M14 16l3-3 3 3" />
        <path d="M15 9h4M17 7v4" />
      </symbol>
      <symbol
        id="i-tech-dark-eff"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M16 12a4 4 0 1 0-4 4" />
        <path d="M9 14l3 2M9 18l3-2" />
      </symbol>
      <!-- 科技分支图标（Phase 2） -->
      <symbol
        id="i-branch-military"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3L5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3z" />
        <path d="M8 8L15 15M13 17l4-4" />
        <path d="M16 8L9 15M7 13l4 4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-branch-explore"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 6h12l4 4v8H4z" />
        <path d="M8 10L15 11L10 15" />
        <path d="M7 9l2 2M9 9l-2 2M14 10l2 2M16 10l-2 2M9 14l2 2M11 14l-2 2" />
      </symbol>
      <symbol
        id="i-branch-crystal"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3L21 12L12 21L3 12Z" />
        <path d="M12 5v14M12 9l-4-2M12 9l4-2M12 15l-4 2M12 15l4 2" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-branch-material"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M7 5L17 5L21 12L17 19L7 19L3 12Z" />
        <path d="M6 9h12M6 12h12M6 15h12" />
        <path d="M10 9v6M14 9v6" />
      </symbol>
      <symbol
        id="i-branch-computing"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M4 12h16M12 4v16" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="16" cy="16" r="1.5" />
      </symbol>
      <symbol
        id="i-branch-singularity"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 12A8 8 0 1 1 12 4" />
        <path d="M12 7A5 5 0 1 1 7 12" />
        <path d="M9 12A3 3 0 1 1 12 15" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <!-- 分支补全图标（形状去重）：能量学/暗物质学不再借用资源图标 -->
      <symbol
        id="i-branch-energy"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M13 6L8 13h3l-1 5 5-7h-3l1-5z" />
      </symbol>
      <symbol
        id="i-branch-dark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="9" stroke-dasharray="1 3" />
        <path d="M13 10C13 7.5 15.5 6.5 17.5 7M11 14C11 16.5 8.5 17.5 6.5 17" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <!-- 科技独立化图标（跨类借用清偿）：19 枚自有图标，系列徽记沿用 §7.4 语言 -->
      <symbol
        id="i-tech-fusion"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 6a6 6 0 0 1 5.2 3M12 18a6 6 0 0 1-5.2-3M6.8 9A6 6 0 0 1 12 6M17.2 15a6 6 0 0 1-5.2 3"
        />
        <circle cx="12" cy="4.5" r="1" fill="currentColor" />
        <circle cx="12" cy="19.5" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-energy-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M11 5L6.5 12H10l-1 7L14 11h-3.5L11 5z" />
        <path d="M17 9h5M19.5 6.5v5" />
      </symbol>
      <symbol
        id="i-tech-core-mine"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="8" r="4.5" />
        <path
          d="M12 5.5a2.5 2.5 0 0 1 2.5 2.5M9 20h6M10.5 16.5L9.5 20M13.5 16.5l1 3.5M12 12.5V16"
        />
      </symbol>
      <symbol
        id="i-tech-crystal-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 5L13 10L8 15L3 10Z" />
        <path d="M17 9h4M19 7v4" />
      </symbol>
      <symbol
        id="i-tech-alloy-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 5L3 8v5l5 3 5-3V8L8 5z" />
        <path d="M17 9h4M19 7v4" />
      </symbol>
      <symbol
        id="i-tech-quantum"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="7" cy="12" r="1.6" />
        <circle cx="17" cy="12" r="1.6" />
        <path d="M8.6 12h6.8" />
        <path d="M7 10.4C7 6 17 6 17 10.4M17 13.6c0 4.4-10 4.4-10 0" />
      </symbol>
      <symbol
        id="i-tech-data-flow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="4" width="5" height="5" rx="1" />
        <rect x="16" y="4" width="5" height="5" rx="1" />
        <rect x="9.5" y="15" width="5" height="5" rx="1" />
        <path d="M5.5 9v2.5h13V9M12 11.5V15" />
      </symbol>
      <symbol
        id="i-tech-neural"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="6" r="1.6" />
        <circle cx="12" cy="18" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
        <path d="M6.4 11.2l4.2-4M6.4 12.8l4.2 4M13.4 6.9l4.2 4M13.4 17.1l4.2-4" />
      </symbol>
      <symbol
        id="i-tech-holo"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 4L19 8v8l-7 4-7-4V8l7-4z" />
        <path d="M12 4v8M12 12l7-4M12 12l-7-4" stroke-dasharray="2 2" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-adv-units"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8.5 3l5 5M3 8.5l5 5M9 7l-5 5 3.5 3.5L12 11z" />
        <path d="M13 13l4 4M14.5 18.5L20 13M17 15l3-3" />
      </symbol>
      <symbol
        id="i-tech-fleet"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 18h18l-2 3H5l-2-3z" />
        <path d="M6.5 18l1.2-6h8.6l1.2 6" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-deep-space"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="2" />
        <path d="M5.5 5.5L10 10M14 14l4.5 4.5" />
        <path d="M3 8l3.5 1M8 3l1 3.5M21 16l-3.5-1M16 21l-1-3.5" />
        <circle cx="18" cy="6" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-dark-scan"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="6.5" stroke-dasharray="1 2.5" />
        <path d="M15.8 15.8L20.5 20.5" />
        <circle cx="11" cy="11" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-dark-theory"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17 4.25 4.25 0 0 1 0-8.5 4.25 4.25 0 0 0 0-8.5z" />
      </symbol>
      <symbol
        id="i-tech-dark-capture"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="5" />
        <path
          d="M12 7c0-2.2 1.8-4 4-4M17 12c2.2 0 4 1.8 4 4M12 17c0 2.2-1.8 4-4 4M7 12c-2.2 0-4-1.8-4-4"
        />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-dark-well"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <ellipse cx="12" cy="12" rx="9.5" ry="3.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-singularity"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
        <circle cx="12" cy="12" r="6.5" stroke-dasharray="1 2.5" />
      </symbol>
      <symbol
        id="i-tech-mil-drill"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 4l6 6M20 4l-6 6M4 20l6-6M20 20l-6-6" />
        <circle cx="12" cy="12" r="2.5" />
      </symbol>
      <symbol
        id="i-tech-flagship"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2v14M8 5h8l-1.5 4h-5L8 5z" />
        <path d="M3 20c2.5-3 5.5-4 9-4s6.5 1 9 4" />
        <circle cx="12" cy="19" r="1.5" />
      </symbol>
      <!-- 星臂层配套科技图标（v0.90） -->
      <symbol
        id="i-tech-explore-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="5" cy="6" r="1" />
        <circle cx="19" cy="5" r="1" />
        <circle cx="18" cy="18" r="1" />
        <path d="M5 6l7 6 7-7" />
        <path d="M12 12l6 6" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-armada"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 8l3-3 3 3" />
        <path d="M9 13l3-3 3 3" />
        <path d="M15 18l3-3 3 3" />
      </symbol>
      <symbol
        id="i-tech-dark-harvester"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M7 3l3 6M17 3l-3 6M12 3v6" />
        <path d="M12 9l-3.5 4 3.5 7 3.5-7-3.5-4z" />
        <circle cx="12" cy="13.5" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-data-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="5" r="1" fill="currentColor" />
        <circle cx="6" cy="10" r="1" />
        <circle cx="18" cy="10" r="1" />
        <path d="M6 10l6-5 6 5" />
        <path d="M6 10l6 4 6-4" />
        <path d="M4 19h16" />
      </symbol>
      <symbol
        id="i-tech-explore-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <path d="M12 9a3 3 0 0 1 3 3" />
        <path d="M12 5a7 7 0 0 1 7 7" />
        <path d="M12 15a3 3 0 0 1-3-3" />
        <path d="M12 19a7 7 0 0 1-7-7" />
      </symbol>
      <symbol
        id="i-tech-galaxy-command"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        <ellipse cx="12" cy="19" rx="8" ry="3" />
      </symbol>
      <symbol
        id="i-tech-dark-web"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="7" stroke-dasharray="2 2" stroke-width="1.5" />
        <path d="M12 5V3M12 19v2M5 12H3M19 12h2M7 7L5 5M17 7l2-2M7 17l-2 2M17 17l2 2" />
      </symbol>
      <symbol
        id="i-tech-data-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 6c0-1.5 3.1-3 7-3s7 1.5 7 3-3.1 3-7 3-7-1.5-7-3z" />
        <path d="M5 6v11c0 1.5 3.1 3 7 3s7-1.5 7-3V6" />
        <path d="M5 12c0 1.5 3.1 3 7 3s7-1.5 7-3" />
        <circle cx="12" cy="15" r="1" fill="currentColor" />
      </symbol>
    </defs>
  </svg>
</template>

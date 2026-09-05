<script setup lang="ts">
// 建筑图标
</script>

<template>
  <svg style="display: none" aria-hidden="true">
    <defs>
      <symbol
        id="i-bld-reactor"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
        />
      </symbol>
      <symbol
        id="i-tech-dyson"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" />
      </symbol>
      <symbol
        id="i-tech-refine"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 21V8l5-3v16M14 21V11l6-3v13M4 21h16M9 10h0M9 14h0M9 18h0" />
      </symbol>
      <symbol
        id="i-bld-lab"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 3v6L4 19a2 2 0 0 0 2 1h12a2 2 0 0 0 2-1l-5-10V3" />
        <path d="M8 3h8" />
      </symbol>
      <symbol
        id="i-bld-quantum"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="2" />
        <ellipse cx="12" cy="12" rx="10" ry="4" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
      </symbol>
      <!-- 晶体扇区扩展建筑图标 -->
      <symbol
        id="i-bld-crystal-nursery"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2 4 8v8l8 4 8-4V8l-8-6z" />
        <path d="M12 8l4 3v5l-4 3-4-3v-5l4-3" />
        <path d="M4 8l8 3 8-3M12 11v8" />
      </symbol>
      <symbol
        id="i-bld-deep-drill"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2v6" />
        <path d="M8 8h8v2l-2 2v4l2 4H8l2-4v-4L8 10V8z" />
        <path d="M7 20h10" />
        <path d="M9 4h6" />
      </symbol>
      <symbol
        id="i-bld-silicon-ring"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="2" />
        <ellipse cx="12" cy="12" rx="10" ry="4" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
        <path d="M12 10v-4M12 14v4" stroke-dasharray="1 2" />
      </symbol>
      <!-- 合金扇区扩展建筑图标 -->
      <symbol
        id="i-tech-nano-forge"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 8h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
        <path d="M3 8l3-4h12l3 4" />
        <path d="M9 13h6M12 10v6" />
        <circle cx="12" cy="5" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-tech-ion-casting"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h2M7 14h2M11 10h2M15 10h2M11 14h4" />
        <path d="M9 6V4M15 6V4" />
      </symbol>
      <symbol
        id="i-tech-stellar-forge"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"
        />
        <circle cx="12" cy="12" r="7" stroke-dasharray="2 3" />
      </symbol>
      <!-- 暗物质扇区扩展建筑图标 -->
      <symbol
        id="i-bld-dark-detector"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2L4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6l-8-4z" />
        <circle cx="12" cy="11" r="3" />
        <path d="M12 8v1M12 14v1M9 11H8M16 11h-1" stroke-dasharray="1 2" />
      </symbol>
      <symbol
        id="i-bld-dark-capture"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="8" stroke-dasharray="2 2" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-bld-dark-well"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l-4-4M15 9l4-4M9 15l-4 4M15 15l4 4" stroke-dasharray="2 2" />
      </symbol>
      <!-- 数据扇区扩展建筑图标 -->
      <symbol
        id="i-bld-neural-hub"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <circle cx="5" cy="5" r="2" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3" />
      </symbol>
      <symbol
        id="i-bld-holo-core"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2l8 5v10l-8 3-9-3V7l9-5z" />
        <path d="M12 12l8-5M12 12v8M12 12L3 7" />
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
      </symbol>
      <!-- 建筑独立化图标（Phase 2） -->
      <symbol
        id="i-bld-extractor"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 4h6l2 16H7z" />
        <path d="M12 8v8M9 13l3 3 3-3" />
        <path d="M5 20h14" />
      </symbol>
      <symbol
        id="i-bld-dyson"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="2" />
        <ellipse cx="12" cy="12" rx="9" ry="5" />
        <circle cx="18" cy="16" r="1" />
        <circle cx="6" cy="8" r="1" />
      </symbol>
      <symbol
        id="i-bld-refinery"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 4h4l2 4v12H8V8z" />
        <path d="M8 10h-3M16 14h3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-bld-nano-forge"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 4h14v3H5zM12 7v13" />
        <circle cx="8" cy="11" r="1" fill="currentColor" />
        <circle cx="16" cy="11" r="1" />
        <circle cx="9" cy="15" r="1" />
      </symbol>
      <symbol
        id="i-bld-ion-casting"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="4" y="6" width="16" height="12" rx="1" />
        <path d="M7 9l3 6M12 9v6M17 9l-3 6" />
        <circle cx="12" cy="15" r="1" fill="currentColor" />
      </symbol>
      <symbol
        id="i-bld-stellar-forge"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7c-3 3-3 7 0 9 3-2 3-6 0-9z" />
        <circle cx="12" cy="14" r="1" fill="currentColor" />
      </symbol>
    </defs>
  </svg>
</template>

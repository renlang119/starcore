<script setup lang="ts">
/**
 * SettingsView.vue — 设置页（v1.13）：存档管理与语言偏好。
 *
 * 存档管理 = SavePanel 原样迁入（自转生页）；语言区块 = 「自动」（跟随
 * 浏览器语言识别）与已支持语言列表，接 src/i18n/locale 模块。手动选择
 * 后整页刷新使语言生效（与 i18n 切换语义一致）。
 */
import {
  t,
  AVAILABLE_LOCALES,
  LOCALE_STORAGE_KEY,
  clearLocale,
  isSupportedLocale,
  setLocale,
} from '@/i18n'
import { computed, ref } from 'vue'
import { reloadPage } from '@/lib/reload'
import SavePanel from '@/components/settings/SavePanel.vue'

/** 当前显式选择的语言码（null = 自动）；仅认已注册语言 */
function readChosen(): string | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return stored && isSupportedLocale(stored) ? stored : null
  } catch {
    return null
  }
}
const chosen = ref<string | null>(readChosen())
const isAuto = computed(() => chosen.value === null)

/** 应用语言选择：持久化或清除后整页刷新生效 */
function applyLocale(code: string | null) {
  if (code === null) {
    clearLocale()
  } else if (!setLocale(code)) {
    return
  }
  chosen.value = code
  reloadPage()
}

function chooseAuto() {
  if (isAuto.value) return
  applyLocale(null)
}
function choose(code: string) {
  if (chosen.value === code) return
  applyLocale(code)
}
</script>

<template>
  <div class="settings-view">
    <h2 class="page-title font-display">{{ t('settings.title') }}</h2>
    <p class="page-sub">{{ t('settings.subtitle') }}</p>

    <!-- 存档管理（自转生页迁入） -->
    <SavePanel />

    <!-- 语言偏好 -->
    <section class="settings-section">
      <h3 class="section-title">{{ t('settings.languageTitle') }}</h3>
      <p class="settings-note">{{ t('settings.languageNote') }}</p>
      <div class="lang-list" role="radiogroup" :aria-label="t('settings.languageTitle')">
        <button
          type="button"
          class="lang-item"
          :class="{ active: isAuto }"
          role="radio"
          :aria-checked="isAuto"
          @click="chooseAuto"
        >
          <span class="lang-name">{{ t('settings.langAuto') }}</span>
        </button>
        <button
          v-for="locale in AVAILABLE_LOCALES"
          :key="locale.code"
          type="button"
          class="lang-item"
          :class="{ active: chosen === locale.code }"
          role="radio"
          :aria-checked="chosen === locale.code"
          @click="choose(locale.code)"
        >
          <span class="lang-name">{{ locale.label }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}

.settings-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.settings-note {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  margin-bottom: var(--space-3);
}
.lang-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.lang-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  background: var(--color-elevated);
  color: var(--color-t-secondary);
  font-size: var(--text-sm);
  transition: all 0.15s var(--ease-out);
}
.lang-item:hover {
  border-color: var(--color-core);
  color: var(--color-t-primary);
}
.lang-item.active {
  border-color: var(--color-core);
  color: var(--color-core);
  background: color-mix(in srgb, var(--color-core) 10%, transparent);
}
.lang-name {
  font-weight: 500;
}
</style>

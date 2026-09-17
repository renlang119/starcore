<script setup lang="ts">
import { RARITY_INFO, relicRarityColor } from '@/data/relics'
import type { RelicFusionApi } from '@/composables/useRelicFusion'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'

/**
 * FusionPanel — 合成工坊区块 + 合成产物弹窗（自 RelicView 拆出，v0.72）
 *
 * 选材状态由 useRelicFusion 持有、视图层传入；本组件只负责工坊 UI 与合成动作。
 * data-testid 与 DOM 结构与拆分前一致，供单测与 Playwright 脚本断言。
 * 图鉴卡的 .r-head 等卡面样式与 .rarity-badge / .r-name 同为全局工具类
 * （v0.97 / v1.02 两批收敛），此处不再各存一份。
 */
defineProps<{ fusion: RelicFusionApi }>()

const NEXT_RARITY_NAME: Record<string, string> = {
  common: '稀有',
  rare: '史诗',
  epic: '传说',
}

const rarityColor = relicRarityColor

function closeResult(fusion: RelicFusionApi) {
  fusion.synthResult.value = null
}
</script>

<template>
  <div>
    <!-- 合成工坊（v0.61） -->
    <div class="fusion-section" data-testid="fusion-section">
      <h3 class="section-title">合成工坊</h3>
      <p class="fusion-hint">
        点选 3 件同稀有度、未装备的遗物，合成 1 件高一档稀有度的随机遗物（传说为顶档，不可作材料）
      </p>
      <div class="fusion-panel">
        <button
          class="btn-ghost sm select-mode-btn"
          :class="{ on: fusion.selectMode.value }"
          data-testid="select-mode-button"
          @click="fusion.toggleSelectMode"
        >
          {{ fusion.selectMode.value ? '✓ 选材中：点击图鉴卡加入材料（再点取消）' : '选择材料' }}
        </button>
        <div class="fusion-slots" data-testid="fusion-slots">
          <div
            v-for="i in 3"
            :key="i"
            class="fusion-slot"
            :class="{ filled: i <= fusion.selectedMaterials.value.length }"
          >
            <template v-if="i <= fusion.selectedMaterials.value.length">
              {{ fusion.materialName(i) }}
            </template>
            <template v-else>材料 {{ i }}</template>
          </div>
        </div>
        <div class="fusion-actions">
          <button
            class="btn-accent sm"
            style="--accent: var(--color-plasma)"
            :disabled="!fusion.canSynthesize.value"
            data-testid="fusion-button"
            @click="fusion.doSynthesize"
          >
            合 成
          </button>
          <button
            v-if="fusion.selectedMaterials.value.length > 0"
            class="btn-ghost sm"
            @click="fusion.clearSelection"
          >
            清空
          </button>
        </div>
        <p v-if="fusion.synthFailMsg.value" class="fusion-fail">{{ fusion.synthFailMsg.value }}</p>
        <p v-else-if="fusion.materialRarity.value" class="fusion-rarity">
          材料稀有度：{{ RARITY_INFO[fusion.materialRarity.value].name }} → 产物：{{
            NEXT_RARITY_NAME[fusion.materialRarity.value]
          }}
        </p>
      </div>
    </div>

    <!-- 合成产物弹窗 -->
    <ModalOverlay
      :model-value="!!fusion.synthResult.value"
      modal-class="synth-modal"
      aria-label="合成结果"
      @overlay-click="closeResult(fusion)"
    >
      <template v-if="fusion.synthResult.value">
        <h2 class="result-title font-display">合成成功</h2>
        <p class="result-sub">材料已消耗，获得新遗物</p>
        <div
          class="synth-product"
          :style="{ '--c': rarityColor(fusion.synthResult.value.rarity) }"
          :data-testid="'synth-product-' + fusion.synthResult.value.rarity"
        >
          <div class="r-head">
            <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
              <use :href="'#' + fusion.synthResult.value.icon" />
            </svg>
            <span
              class="rarity-badge"
              :style="{ background: rarityColor(fusion.synthResult.value.rarity) }"
            >
              {{ RARITY_INFO[fusion.synthResult.value.rarity].name }}
            </span>
          </div>
          <div class="r-name">{{ fusion.synthResult.value.name }}</div>
          <div class="r-effects">
            <span v-for="(e, i) in fusion.synthResult.value.effects" :key="i" class="eff-mini">{{
              e.label
            }}</span>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn-primary" style="flex: 1" @click="closeResult(fusion)">确认</button>
        </div>
      </template>
    </ModalOverlay>
  </div>
</template>

<style scoped>
/* 工坊区块样式自 RelicView 原样迁入 */
.fusion-section {
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-plasma) 40%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.fusion-hint {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.select-mode-btn.on {
  border-color: var(--color-plasma);
  color: var(--color-plasma);
}
.fusion-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.fusion-slots {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.fusion-slot {
  aspect-ratio: 2.4;
  border: 1px dashed var(--color-border-line);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  text-align: center;
  padding: var(--space-1);
  overflow: hidden;
}
.fusion-slot.filled {
  border: 1px solid var(--color-plasma);
  color: var(--color-t-primary);
  background: color-mix(in srgb, var(--color-plasma) 10%, transparent);
}
.fusion-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.fusion-fail {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-alert);
}
.fusion-rarity {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}

/* 产物弹窗内容样式自 RelicView 原样迁入（.synth-modal 是 ModalOverlay 根节点上的 class，
   scoped 规则匹配不到它，故去掉该前缀只保留内容选择器——与拆分前实际生效范围一致；
   .result-sub 原本无本视图样式定义，保留类名维持 DOM 不变） */
.result-title {
  color: var(--color-plasma);
}
</style>

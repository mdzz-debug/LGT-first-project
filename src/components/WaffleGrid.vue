<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import type { WaffleLegend, WaffleTile } from '../utils/waffle'

addCollection(mdi)

const props = defineProps<{
  tiles: WaffleTile[]
  legend: WaffleLegend[]
  legendColumns?: number
  amountFormatter?: (value: number) => string
  size?: number | string
  legendWidth?: number | string
  cols?: number
  showLegend?: boolean
}>()

const activeLabel = shallowRef<string | null>(null)
const activeInfo = computed(() =>
  props.legend.find((item) => item.label === activeLabel.value) || null
)

const toggleActive = (label: string) => {
  activeLabel.value = activeLabel.value === label ? null : label
}

const formatAmount = (value: number) =>
  props.amountFormatter ? props.amountFormatter(value) : value.toFixed(2)

const legendCols = computed(() => props.legendColumns ?? 2)
const gridSize = computed(() => {
  if (typeof props.size === 'number') return `${props.size}px`
  return props.size || '100%'
})
const legendWidth = computed(() => {
  if (typeof props.legendWidth === 'number') return `${props.legendWidth}px`
  return props.legendWidth || '180px'
})
const gridCols = computed(() => props.cols ?? 10)
const showLegend = computed(() => props.showLegend !== false)
</script>

<template>
  <div class="waffle-grid-wrap">
    <div
      class="waffle-grid"
      :class="{ 'legend-hidden': !showLegend }"
      :style="{ '--legend-cols': legendCols, '--legend-width': legendWidth }"
    >
      <div class="grid" :style="{ '--grid-size': gridSize, '--grid-cols': gridCols }">
        <div
          v-for="(tile, idx) in tiles"
          :key="idx"
          class="grid-tile"
          :style="{ background: tile.color }"
          :title="tile.label"
          @click="toggleActive(tile.label)"
        ></div>
        <div v-if="activeInfo" class="grid-overlay" @click="activeLabel = null">
          <span class="overlay-name">{{ activeInfo.label }}</span>
          <span class="overlay-percent">{{ activeInfo.percent }}%</span>
        </div>
      </div>
      <div v-if="showLegend" class="legend">
        <div v-for="item in legend" :key="item.label" class="legend-row" @click="toggleActive(item.label)">
          <span class="dot" :style="{ background: item.color }"></span>
          <span class="legend-icon">
            <Icon :icon="item.icon || 'mdi:tag-outline'" :style="{ color: item.color }" />
          </span>
          <span class="legend-name">{{ item.label }}</span>
          <span class="legend-amount">¥ {{ formatAmount(item.amount) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.waffle-grid-wrap {
  width: 100%;
}

.waffle-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--legend-width, 180px);
  gap: 18px;
  align-items: center;
}

.waffle-grid.legend-hidden {
  grid-template-columns: minmax(0, 1fr);
}

.grid {
  position: relative;
  display: grid;
  width: var(--grid-size, 100%);
  max-width: 100%;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
  grid-template-columns: repeat(var(--grid-cols, 10), minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 4px;
}

.grid-tile {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--surface) 30%, transparent);
  cursor: pointer;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 6px;
  font-weight: 600;
  color: color-mix(in srgb, var(--text) 85%, transparent);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  border-radius: 8px;
  text-align: center;
  z-index: 1;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
}

.grid-overlay .overlay-name {
  font-size: 16px;
  letter-spacing: 0.6px;
}

.grid-overlay .overlay-percent {
  font-size: 26px;
}

.legend {
  display: grid;
  grid-template-columns: repeat(var(--legend-cols), minmax(0, 1fr));
  gap: 8px;
  max-height: var(--grid-size, 180px);
  overflow-y: auto;
  padding-right: 4px;
}

.legend-row {
  display: grid;
  grid-template-columns: 10px 16px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}

.legend-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.legend-name {
  font-size: 12px;
  color: var(--text);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}

.legend-amount {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  white-space: nowrap;
  padding-top: 1px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

:global([data-theme='dark']) .grid-tile {
  filter: brightness(1.2) saturate(1.1);
}

@media (max-width: 720px) {
  .waffle-grid {
    grid-template-columns: 1fr;
  }
}
</style>

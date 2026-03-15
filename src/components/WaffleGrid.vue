<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { WaffleLegend, WaffleTile } from '../utils/waffle'

const props = defineProps<{
  tiles: WaffleTile[]
  legend: WaffleLegend[]
  legendColumns?: number
  amountFormatter?: (value: number) => string
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
</script>

<template>
  <div class="waffle-grid-wrap">
    <div class="waffle-grid" :style="{ '--legend-cols': legendCols }">
      <div class="grid">
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
      <div class="legend">
        <div v-for="item in legend" :key="item.label" class="legend-row" @click="toggleActive(item.label)">
          <span class="dot" :style="{ background: item.color }"></span>
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
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 14px;
  align-items: start;
}

.grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
}

.grid-tile {
  width: 100%;
  padding-bottom: 100%;
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
  gap: 10px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.legend-name {
  font-size: 14px;
  color: var(--text);
}

.legend-amount {
  margin-left: auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
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
  .legend {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

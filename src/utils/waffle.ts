export type WaffleInput = {
  label: string
  amount: number
  color: string
  icon?: string
}

export type WaffleLegend = WaffleInput & {
  percent: number
}

export type WaffleTile = {
  label: string
  color: string
}

export type WaffleData = {
  tiles: WaffleTile[]
  legend: WaffleLegend[]
}

export type WaffleBuildOptions = {
  minVisibleCount?: number
  mergeOverflowToOther?: boolean
  otherLabel?: string
  otherColor?: string
  otherIcon?: string
}

type WaffleRow = WaffleInput & {
  rawCount: number
}

const DEFAULT_OPTIONS: Required<WaffleBuildOptions> = {
  minVisibleCount: 1,
  mergeOverflowToOther: true,
  otherLabel: '其他',
  otherColor: '#cbd5f5',
  otherIcon: 'mdi:dots-horizontal-circle-outline'
}

const toPercent = (amount: number, total: number) =>
  Number(((amount / total) * 100).toFixed(1))

const buildRows = (items: WaffleInput[], total: number, size: number): WaffleRow[] =>
  items.map((item) => ({
    ...item,
    rawCount: (item.amount / total) * size
  }))

const getMandatoryCount = (row: WaffleRow, minVisibleCount: number) =>
  row.rawCount > 0 && row.rawCount < minVisibleCount ? minVisibleCount : 0

const getMandatoryTotal = (rows: WaffleRow[], minVisibleCount: number) =>
  rows.reduce((sum, row) => sum + getMandatoryCount(row, minVisibleCount), 0)

const normalizeRows = (
  rows: WaffleInput[],
  total: number,
  size: number,
  options: Required<WaffleBuildOptions>
): WaffleRow[] => {
  let working = buildRows(rows, total, size)

  if (!options.mergeOverflowToOther) return working

  let otherRow: WaffleInput | null = null

  while (working.length) {
    const evaluated = otherRow
      ? buildRows([...working, otherRow], total, size)
      : working

    if (evaluated.length <= size && getMandatoryTotal(evaluated, options.minVisibleCount) <= size) {
      return evaluated.sort((a, b) => b.amount - a.amount)
    }

    const smallest = working.pop()
    if (!smallest) break

    if (otherRow) {
      otherRow.amount += smallest.amount
    } else {
      otherRow = {
        label: options.otherLabel,
        amount: smallest.amount,
        color: options.otherColor,
        icon: options.otherIcon
      }
    }
  }

  return buildRows(otherRow ? [otherRow] : rows.slice(0, 1), total, size)
    .sort((a, b) => b.amount - a.amount)
}

export const buildWaffle = (
  items: WaffleInput[],
  size = 100,
  buildOptions: WaffleBuildOptions = {}
): WaffleData => {
  const options = { ...DEFAULT_OPTIONS, ...buildOptions }
  const rows = items
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  if (!rows.length || size <= 0) return { tiles: [], legend: [] }

  const total = rows.reduce((sum, item) => sum + item.amount, 0)
  if (!total) return { tiles: [], legend: [] }

  const normalizedRows = normalizeRows(rows, total, size, options)

  const legend = normalizedRows.map((item) => ({
    label: item.label,
    amount: item.amount,
    color: item.color,
    icon: item.icon,
    percent: toPercent(item.amount, total)
  }))

  const counts = normalizedRows.map((item) => {
    const mandatory = getMandatoryCount(item, options.minVisibleCount)
    const adjustedRaw = Math.max(item.rawCount - mandatory, 0)
    const extraCount = Math.floor(adjustedRaw)

    return {
      ...item,
      count: mandatory + extraCount,
      remainder: adjustedRaw - extraCount
    }
  })

  let remaining = size - counts.reduce((sum, item) => sum + item.count, 0)
  if (remaining > 0 && counts.length) {
    const ranked = [...counts].sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder
      return b.amount - a.amount
    })

    for (let index = 0; index < remaining; index += 1) {
      const target = ranked[index % ranked.length] ?? ranked[0]
      if (!target) break
      target.count += 1
    }
  }

  const tiles: WaffleTile[] = []
  counts.forEach((item) => {
    for (let index = 0; index < item.count; index += 1) {
      tiles.push({ label: item.label, color: item.color })
    }
  })

  if (tiles.length > size) {
    tiles.length = size
  } else if (tiles.length < size && counts[0]) {
    const filler = { label: counts[0].label, color: counts[0].color }
    while (tiles.length < size) {
      tiles.push(filler)
    }
  }

  return { tiles, legend }
}

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

export const buildWaffle = (items: WaffleInput[], size = 100): WaffleData => {
  const rows = items
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  if (!rows.length) return { tiles: [], legend: [] }

  const total = rows.reduce((sum, item) => sum + item.amount, 0)
  if (!total) return { tiles: [], legend: [] }

  const legend = rows.map((item) => ({
    ...item,
    percent: Math.round((item.amount / total) * 100)
  }))

  const counts = legend.map((item) => ({
    ...item,
    count: Math.round((item.amount / total) * size)
  }))

  let allocated = counts.reduce((sum, item) => sum + item.count, 0)
  if (allocated !== size && counts.length) {
    const diff = size - allocated
    const first = counts[0]
    if (first) {
      first.count = Math.max(0, first.count + diff)
    }
  }

  const tiles: WaffleTile[] = []
  counts.forEach((item) => {
    for (let i = 0; i < item.count; i += 1) {
      tiles.push({ label: item.label, color: item.color })
    }
  })

  return { tiles, legend }
}

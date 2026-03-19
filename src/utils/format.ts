export function formatCurrency(value: number | string, unit = '¥') {
  const num = Number(value || 0)
  return unit + num.toFixed(2)
}

export function formatPercent(value: number | string) {
  const num = Number(value || 0)
  return num.toFixed(1) + '%'
}

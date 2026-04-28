export function formatRelative(isoString: string, now: number = Date.now()): string {
  const target = new Date(isoString).getTime()
  if (Number.isNaN(target)) return isoString
  const diff = target - now
  if (diff <= 0) return 'now'
  const seconds = Math.round(diff / 1000)
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  if (hours < 24) {
    return remMinutes > 0 ? `in ${hours}h ${remMinutes}m` : `in ${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `in ${days}d ${remHours}h` : `in ${days}d`
}

export function formatAgo(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export const defaultEditWindowDays = 14

export function isRecordEditable(createdAt: string, editWindowDays: number, now = new Date()) {
  if (!createdAt) return true
  const createdAtTime = Date.parse(createdAt)
  if (Number.isNaN(createdAtTime)) return false
  return now.getTime() - createdAtTime <= editWindowDays * 24 * 60 * 60 * 1000
}

export const DEFAULT_OPERATION_TIME_ZONE = 'America/Lima'

export function getDateKeyInTimeZone(date: Date, timeZone = DEFAULT_OPERATION_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isSameDateInTimeZone(a: Date, b: Date, timeZone = DEFAULT_OPERATION_TIME_ZONE) {
  return getDateKeyInTimeZone(a, timeZone) === getDateKeyInTimeZone(b, timeZone)
}

export function formatDateInTimeZone(date: Date, timeZone = DEFAULT_OPERATION_TIME_ZONE) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}


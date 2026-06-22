import { format } from 'date-fns'

/** Format a Date as an ISO date string (yyyy-MM-dd). */
export const toISODate = (date: Date): string => format(date, 'yyyy-MM-dd')

import { format } from 'date-fns'

/** Format as ISO date (yyyy-MM-dd). */
export const toISODate = (date: Date): string => format(date, 'yyyy-MM-dd')

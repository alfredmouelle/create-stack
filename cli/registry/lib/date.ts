import { format } from 'date-fns'

export const toISODate = (date: Date): string => format(date, 'yyyy-MM-dd')

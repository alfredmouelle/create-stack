import { get, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  health: get('/api/health'),
})

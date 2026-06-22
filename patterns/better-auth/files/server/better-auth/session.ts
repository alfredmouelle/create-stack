import { createServerFn } from '@tanstack/react-start';
import { getSession } from './server';

export const getServerSession = createServerFn({ method: 'GET' }).handler(() =>
  getSession(),
);

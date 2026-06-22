import { getRequest } from '@tanstack/react-start/server';
import { auth } from '.';

export const getSession = async () =>
  auth.api.getSession({ headers: getRequest().headers });

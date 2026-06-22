import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getServerSession } from '~/server/better-auth/session';

/**
 * Layout group guarding every route under it: redirects to sign-in when there's
 * no session, and exposes the session to child loaders via `beforeLoad`.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getServerSession();
    if (!session) {
      throw redirect({ to: '/auth/sign-in' });
    }
    return { session };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return <Outlet />;
}

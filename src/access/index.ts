import type { Access, AccessArgs } from 'payload';

type UserRole = 'admin' | 'editor';

function hasRole(user: unknown, role: UserRole): boolean {
  return (
    typeof user === 'object' &&
    user !== null &&
    'role' in user &&
    user.role === role
  );
}

export function isAdminUser(user: unknown): boolean {
  return hasRole(user, 'admin');
}

export function isAdmin({ req }: { req: { user?: unknown } }): boolean {
  return isAdminUser(req.user);
}

export function isLoggedIn({ req }: AccessArgs): boolean {
  return Boolean(req.user);
}

export const publishedOrAuthenticated: Access = ({ req }) =>
  req.user ? true : { _status: { equals: 'published' } };

export const canDeletePage: Access = async ({ id, req }) => {
  if (isAdminUser(req.user)) {
    return true;
  }

  if (!req.user || id === undefined) {
    return false;
  }

  const page = await req.payload.findByID({
    collection: 'pages',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  });

  return page._status === 'draft';
};

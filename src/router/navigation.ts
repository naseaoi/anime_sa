export const isInternalRouteTarget = (target: string): boolean =>
  target.startsWith('/')
  && !target.startsWith('//')
  && !target.includes('\\')
  && !/[\u0000-\u001f\u007f]/.test(target);

export const assertInternalRouteTarget = (target: string): string => {
  if (!isInternalRouteTarget(target)) throw new Error('Navigation target must be an internal absolute path');
  return target;
};

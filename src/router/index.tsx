import React, { useCallback } from 'react';
import {
  Link as WouterLink,
  Redirect as WouterRedirect,
  Route,
  Router,
  Switch,
  useLocation as useWouterLocation,
  useParams,
  useSearch,
  useSearchParams
} from 'wouter';
import type { LinkProps, RedirectProps } from 'wouter';
import { useHistoryState } from 'wouter/use-browser-location';
import { assertInternalRouteTarget } from './navigation';

export interface LocationState {
  pathname: string;
  search: string;
  state: unknown;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export type Navigate = (target: string | number, options?: NavigateOptions) => void;

export const useLocation = (): LocationState => {
  const [pathname] = useWouterLocation();
  const search = useSearch();
  const state = useHistoryState();
  return { pathname, search: search ? `?${search}` : '', state };
};

export const useNavigate = (): Navigate => {
  const [, navigate] = useWouterLocation();
  return useCallback((target: string | number, options?: NavigateOptions) => {
    if (typeof target === 'number') {
      window.history.go(target);
      return;
    }
    navigate(assertInternalRouteTarget(target), options);
  }, [navigate]);
};

export const Link: React.FC<LinkProps> = (props) => {
  assertInternalRouteTarget(props.to ?? props.href);
  return <WouterLink {...props} />;
};

export const Redirect: React.FC<RedirectProps> = (props) => {
  assertInternalRouteTarget(props.to ?? props.href);
  return <WouterRedirect {...props} />;
};

export { Route, Router, Switch, useParams, useSearchParams };
export { isAdminRoutePath } from './navigation';

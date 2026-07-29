import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

interface HashLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

function normalizeRoute(to: string) {
  const path = `/${to}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  return path;
}

export function HashLink({ to, children, onClick, ...props }: HashLinkProps) {
  const route = normalizeRoute(to);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    window.setTimeout(() => document.getElementById('main-content')?.focus({ preventScroll: true }), 0);
  }

  return <a href={`#${route}`} onClick={handleClick} {...props}>{children}</a>;
}

import type { AnchorHTMLAttributes, ReactNode } from 'react';

interface HashLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export function HashLink({ to, children, ...props }: HashLinkProps) {
  return <a href={`#${to}`} {...props}>{children}</a>;
}

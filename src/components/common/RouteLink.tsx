import React, { createContext, useContext, useState, useEffect } from 'react';

export const RouterContext = createContext<{
  path: string;
  navigate: (to: string) => void;
}>({
  path: window.location.pathname,
  navigate: () => {},
});

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (to: string) => {
    const url = new URL(to, window.location.origin);
    window.history.pushState({}, '', to);
    setPath(url.pathname);
    window.scrollTo(0, 0);
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useLocation() {
  return useContext(RouterContext).path;
}

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function Link({ to, children, className, ...props }: { to: string; children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useContext(RouterContext);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}

export function Route({ path, children }: { path: string; children: React.ReactNode }) {
  const currentPath = useLocation();
  if (currentPath === path) return <>{children}</>;
  
  // Basic pattern matching for things like /product/:id
  if (path.includes(':')) {
    const pathParts = path.split('/');
    const currentParts = currentPath.split('/');
    if (pathParts.length === currentParts.length) {
      const match = pathParts.every((part, i) => part.startsWith(':') || part === currentParts[i]);
      if (match) return <>{children}</>;
    }
  }

  return null;
}

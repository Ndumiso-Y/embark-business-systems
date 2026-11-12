import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './styles/app.css';
import './styles/foundation.css';
import './styles/portal.css';
import './styles/skin.css';
import { routes } from './core/routes';

// Hash routing: static hosting (GitHub Pages, artifact previews) serves files
// only, so client routes live in the URL fragment to survive refresh/deep links.
const router = createHashRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

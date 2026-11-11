import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { IcoBack, IcoGrid, IcoHome, IcoKey, IcoMenu, IcoSearch, IcoSettings } from './components/Icons';
import { Toasts } from './components/ui';
import { IndustryContext } from './context';
import { isoDay, useStore } from './store';
import { formatDate, todayIso } from './lib/dates';
import { currentUser, hasModule } from './engine';
import { getIndustry, LOCKED_INDUSTRY } from '../industries/registry';
import { brandedConfig, parseUrlBrand, sanitiseBrand } from './brand';
import { useIndustry } from './context';
import NotFound from './pages/NotFound';

/** Shell for one industry: themed sidebar, top bar with simulated sign-in, routed content. */
export default function IndustryLayout() {
  const { industry } = useParams();
  const config = getIndustry(industry);
  const ensure = useStore((s) => s.ensure);
  const data = useStore((s) => (config ? s.data[config.id] : undefined));

  const brand = useStore((s) => (config ? s.brands[config.id] : undefined));
  const setBrand = useStore((s) => s.setBrand);
  const branded = useMemo(() => (config ? brandedConfig(config, brand) : undefined), [config, brand]);

  useLayoutEffect(() => { if (config) ensure(config); }, [config, ensure]);
  // Branding carried by the link (?name=&accent= or ?brand=<key>) is applied once per page load.
  useEffect(() => {
    if (!config || urlBrandApplied.has(config.id)) return;
    urlBrandApplied.add(config.id);
    const { key, brand: fromUrl } = parseUrlBrand(window.location.search);
    if (fromUrl) setBrand(config.id, fromUrl);
    if (key) {
      fetch(new URL(`brands/${key}.json`, document.baseURI))
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => { const b = sanitiseBrand(json); if (b) setBrand(config.id, { ...b, ...fromUrl }); })
        .catch(() => { /* unknown brand key: keep the default look */ });
    }
  }, [config, setBrand]);
  if (!config) return LOCKED_INDUSTRY ? <Navigate to={`/${LOCKED_INDUSTRY}`} replace /> : <div className="content"><NotFound /></div>;
  if (!data) return null;
  return (
    <IndustryContext.Provider value={branded ?? config}>
      <Shell />
    </IndustryContext.Provider>
  );
}

const urlBrandApplied = new Set<string>();

function Shell() {
  const config = useIndustry();
  const data = useStore((s) => s.data[config.id])!;
  const signInAs = useStore((s) => s.signInAs);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const user = currentUser(data);
  const base = `/${config.id}`;
  const roleLabel = config.roles.find((r) => r.key === user.role)?.label ?? user.role;
  useEffect(() => { setOpen(false); window.scrollTo?.(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => { document.title = `${config.businessName} · Demonstration`; }, [config.businessName]);

  const visible = config.modules.filter((m) => hasModule(user, m.key));
  const groups: Array<{ name: string; items: typeof visible }> = [];
  for (const m of visible) {
    const g = m.group ?? 'Workspace';
    const found = groups.find((x) => x.name === g);
    if (found) found.items.push(m); else groups.push({ name: g, items: [m] });
  }
  const seg = location.pathname.split('/')[2];
  const crumb = !seg ? 'Dashboard' : seg === 'settings' ? 'Settings' : seg === 'admin' ? 'Users & permissions' : seg === 'search' ? 'Search' : config.modules.find((m) => m.key === seg)?.label ?? 'Page';
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const t = config.theme;
  const style = { '--accent': t.accent, '--accent-2': t.accent2, '--accent-soft': t.accentSoft, '--accent-tint': t.accentTint, '--accent-line': t.accentLine, '--accent-text': t.accentText } as CSSProperties;

  return (
    <div className="app" style={style} data-industry={config.id}>
      <a href="#main" className="sr-only" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <NavLink to={base} className="brand" aria-label={`${config.businessName} — demonstration workspace`}>
          {config.logo
            ? <img className="brand-logo" src={config.logo} alt={`${config.businessName} logo`} />
            : <span className="brand-monogram">{config.monogram}<span>.</span></span>}
          <span className="brand-sub">{config.businessName.toUpperCase()}</span>
        </NavLink>
        <div className="workspace-tag">{config.workspaceTag}</div>
        <nav>
          {hasModule(user, 'dashboard') && (
            <NavLink to={base} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><IcoHome /><span>Dashboard</span><span className="nav-dot" /></NavLink>
          )}
        </nav>
        {groups.map((g) => (
          <div key={g.name}>
            <div className="nav-title">{g.name}</div>
            <nav>
              {g.items.filter((m) => m.key !== 'dashboard').map((m) => (
                <NavLink key={m.key} to={`${base}/${m.key}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <m.icon /><span>{m.label}</span><span className="nav-dot" />
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebar-spacer" />
        <nav>
          {hasModule(user, 'admin') && <NavLink to={`${base}/admin`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><IcoKey /><span>Users &amp; permissions</span></NavLink>}
          <NavLink to={`${base}/settings`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><IcoSettings /><span>Settings &amp; reset</span></NavLink>
          {!LOCKED_INDUSTRY && <Link to="/" className="nav-item"><IcoGrid /><span>All industry demos</span></Link>}
        </nav>
        <div className="help-card">
          <div className="help-head">Demonstration only</div>
          <p>Fictional records saved in this browser. No real sign-in, security, compliance or server.</p>
        </div>
        <div className="user-box">
          <span className="avatar">ED</span>
          <div><b>Embark Digitals</b><small>Industry demo foundation</small></div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="circle-button menu-button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><IcoMenu /></button>
            {!LOCKED_INDUSTRY && <Link to="/" className="crumb-home" aria-label="All industry demos"><IcoBack /></Link>}
            <b>{config.businessName}</b>
            <span aria-hidden="true">/</span>
            <span>{crumb}</span>
          </div>
          <div className="topbar-right">
            <span className="demo-pill" title="All records are fictional. This is a demonstration, not a production system."><span className="status-dot" />Demonstration</span>
            <form className="search-box" role="search" onSubmit={(e) => { e.preventDefault(); if (query.trim()) navigate(`${base}/search?q=${encodeURIComponent(query.trim())}`); }}>
              <IcoSearch />
              <input aria-label="Search workspace" placeholder="Search workspace" value={query} onChange={(e) => setQuery(e.target.value)} />
              <kbd>↵</kbd>
            </form>
            <Link to={`${base}/search`} className="circle-button search-mobile" aria-label="Open search"><IcoSearch /></Link>
            <label className="user-switch" title="Simulated sign-in — not real authentication">
              <span className="top-avatar" aria-hidden="true">{initials}</span>
              <span className="user-switch-text"><b>{user.name}</b><small>{user.title.toLowerCase().includes(roleLabel.toLowerCase()) ? user.title : `${user.title} · ${roleLabel}`}</small></span>
              <select aria-label="Signed in as (simulated user)" value={user.id} onChange={(e) => signInAs(config.id, e.target.value)} data-testid="user-switcher">
                {data.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.title}</option>)}
              </select>
            </label>
          </div>
        </header>
        <main className="content" id="main" tabIndex={-1}>
          {isoDay(data.seededAt) !== todayIso() && (
            <div className="stale-banner" role="status" data-testid="stale-banner">
              <span>This demo was started on {formatDate(isoDay(data.seededAt))}, so “today” in the sample data means that day. Your changes are still here.</span>
              <button className="btn sm" onClick={() => { useStore.getState().reset(getIndustry(config.id) ?? config); useStore.getState().toast('Sample data refreshed to today'); }}>Refresh sample data to today</button>
            </div>
          )}
          <Outlet />
          <div className="footer-note">{config.brandedFor
            ? `Demonstration prepared for ${config.brandedFor} by Embark Digitals · All people, records and figures shown are fictional sample data`
            : `${config.businessName} is a fictional business · All people, records and figures are fictional demonstration data · Built by Embark Digitals`}</div>
        </main>
      </div>
      <Toasts />
    </div>
  );
}

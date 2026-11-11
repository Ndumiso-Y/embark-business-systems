import { useState } from 'react';
import { useActions, useData, useIndustry, useUser } from '../context';
import { useStore } from '../store';
import { Confirm, Field, Modal, Notice, PageHeader, Panel, Tag } from '../components/ui';
import RoleBar from '../components/RoleBar';
import type { DemoUser } from '../types';
import { IcoPlus, IcoTrash } from '../components/Icons';
import { newId } from '../store';

/** Generic module/permission matrix for any industry. Simulated only. */
export default function UsersPage() {
  const config = useIndustry();
  const data = useData();
  const { user: me } = useUser();
  const act = useActions();
  const upsert = useStore((s) => s.upsertUser);
  const del = useStore((s) => s.deleteUser);
  const resetUsers = useStore((s) => s.resetUsers);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<DemoUser | null>(null);
  const [resetting, setResetting] = useState(false);
  const modules = [{ key: 'dashboard', label: 'Dashboard' }, ...config.modules.map((m) => ({ key: m.key, label: m.label })), { key: 'admin', label: 'Users & permissions' }];

  const toggle = (u: DemoUser, field: 'modules' | 'permissions', key: string) => {
    if (u.isSuperAdmin) return;
    const has = u[field].includes(key);
    upsert(config.id, { ...u, [field]: has ? u[field].filter((k) => k !== key) : [...u[field], key] });
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Administration`} title="Users & permissions" subtitle="Grant each fictional user the modules and actions they need. This shows how access could be organised; it is not real security."
        actions={<><button className="btn" onClick={() => setResetting(true)}>Restore default users</button><button className="btn primary" onClick={() => setAdding(true)}><IcoPlus /> Add demo user</button></>} />
      <RoleBar />
      <Notice tone="amber">Permissions here are enforced only by this page's JavaScript. Anyone with the link can switch users. A production system needs real sign-in and server-side authorisation.</Notice>
      <div style={{ height: 16 }} />
      <Panel title="Module access" meta="Tick to grant a module · super admins see everything" pad={false}>
        <div className="table-wrap">
          <table className="table matrix" data-testid="module-matrix">
            <thead><tr><th>User</th>{modules.map((m) => <th key={m.key} className="rot"><span>{m.label}</span></th>)}<th /></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><small>{u.title} · {config.roles.find((r) => r.key === u.role)?.label}</small>{u.isSuperAdmin && <Tag tone="accent">All access</Tag>}</td>
                  {modules.map((m) => (
                    <td key={m.key} className="c">
                      <input type="checkbox" className="matrix-check" aria-label={`${u.name}: ${m.label}`} checked={!!u.isSuperAdmin || u.modules.includes(m.key)} disabled={!!u.isSuperAdmin} onChange={() => toggle(u, 'modules', m.key)} />
                    </td>
                  ))}
                  <td>{u.id !== me.id && <button className="btn ghost xs" aria-label={`Remove ${u.name}`} onClick={() => setRemoving(u)}><IcoTrash /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Action permissions" meta="Workflow steps and sensitive fields check these" pad={false}>
        <div className="table-wrap">
          <table className="table matrix">
            <thead><tr><th>User</th>{config.permissions.map((p) => <th key={p.key} className="rot" title={p.description}><span>{p.label}</span></th>)}</tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><small>{u.title}</small></td>
                  {config.permissions.map((p) => (
                    <td key={p.key} className="c">
                      <input type="checkbox" className="matrix-check" aria-label={`${u.name}: ${p.label}`} checked={!!u.isSuperAdmin || u.permissions.includes(p.key)} disabled={!!u.isSuperAdmin} onChange={() => toggle(u, 'permissions', p.key)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="perm-legend">{config.permissions.map((p) => <li key={p.key}><b>{p.label}</b> — {p.description}</li>)}</ul>
      </Panel>
      {adding && <AddUser onClose={() => setAdding(false)} onSave={(u) => { upsert(config.id, u); act.toast(`${u.name} added`); setAdding(false); }} />}
      <Confirm open={!!removing} danger title={`Remove ${removing?.name}?`} confirmLabel="Remove" body="The fictional user is removed from this browser." onCancel={() => setRemoving(null)}
        onConfirm={() => { const r = del(config.id, removing!.id); act.toast(r.ok ? `${removing!.name} removed` : r.reason, r.ok ? 'ok' : 'err'); setRemoving(null); }} />
      <Confirm open={resetting} title="Restore default users?" confirmLabel="Restore" body="Users and permissions return to the fictional defaults. Records are kept." onCancel={() => setResetting(false)}
        onConfirm={() => { resetUsers(config); act.toast('Default users restored'); setResetting(false); }} />
    </>
  );
}

function AddUser({ onClose, onSave }: { onClose: () => void; onSave: (u: DemoUser) => void }) {
  const config = useIndustry();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState(config.roles[0].key);
  const [err, setErr] = useState('');
  const save = () => {
    if (!name.trim() || !title.trim()) { setErr('Name and job title are required.'); return; }
    onSave({ id: newId('u'), name: name.trim(), title: title.trim(), role, modules: ['dashboard'], permissions: [] });
  };
  return (
    <Modal open title="Add demo user" sub="Use a fictional name. Grant modules afterwards in the matrix." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Add user</button></>}>
      <div className="form-grid">
        <Field label="Full name" error={err || undefined}><input className="input" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Job title"><input className="input" aria-label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Role" className="span-2">
          <select className="select" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>{config.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
        </Field>
      </div>
    </Modal>
  );
}

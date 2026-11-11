import { useState } from 'react';
import { useActions, useData, useIndustry } from '../context';
import { useStore } from '../store';
import { Confirm, KeyValues, Notice, PageHeader, Panel } from '../components/ui';
import { formatDateTime } from '../lib/dates';
import BrandStudio from '../components/BrandStudio';

export default function SettingsPage() {
  const config = useIndustry();
  const data = useData();
  const reset = useStore((s) => s.reset);
  const act = useActions();
  const [confirming, setConfirming] = useState(false);
  const total = Object.values(data.collections).reduce((n, l) => n + l.length, 0);
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Settings`} title="Settings & demo reset" subtitle="Brand the demo for a client, see what it stores and does not do, and start again." />
      <BrandStudio />
      <div style={{ height: 16 }} />
      <div className="grid-2-even">
        <Panel title="Demo data in this browser">
          <KeyValues items={[
            { label: config.brandedFor ? 'Demo branded for' : 'Fictional business', value: config.businessName },
            { label: 'Records stored', value: String(total) },
            { label: 'Demo users', value: String(data.users.length) },
            { label: 'Data seeded', value: formatDateTime(data.seededAt) },
            { label: 'Storage', value: 'This browser (localStorage). Another device or private window starts fresh.', wide: true },
          ]} />
          <div style={{ marginTop: 18 }}>
            <button className="btn danger" onClick={() => setConfirming(true)} data-testid="reset-demo">Reset {config.industry.toLowerCase()} demo data</button>
          </div>
        </Panel>
        <Panel title="What this demo does not do">
          <ul className="boundary-list">
            <li>No real sign-in or authentication — users are switched from the top bar.</li>
            <li>No server-side access control — hidden modules are hidden by JavaScript only.</li>
            <li>No backend or shared database — nothing syncs or is backed up.</li>
            <li>No messages, emails, SMS or integrations are sent or connected.</li>
            {config.boundaries.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </Panel>
      </div>
      <div style={{ height: 16 }} />
      <Notice tone="grey">All names, records, codes and figures are invented for demonstration. Do not enter real personal, patient, client or financial information.</Notice>
      <Confirm open={confirming} danger title="Reset demo data?" confirmLabel="Reset" body={`All ${config.industry.toLowerCase()} records and users in this browser return to the fictional starting data. Other industry demos are not affected.`}
        onCancel={() => setConfirming(false)} onConfirm={() => { reset(config); act.toast('Demo data reset'); setConfirming(false); }} />
    </>
  );
}

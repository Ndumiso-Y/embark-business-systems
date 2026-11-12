import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { AUDIENCES, CHANNELS, GRADES, label } from '../data';
import { noticeAudience, noticeMessage, sortedClasses } from '../helpers';
import { useFeedback } from './feedback';
import { WhoCan } from './shared';

/** A notice to parents: who it goes to, the message, and a preview of what would be sent. */
export default function NoticeDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const notice = findRecord(data, 'notices', id);
  const [form, setForm] = useState<{ audience: string; grade: string; class: string; channel: string; body: string } | null>(null);
  if (!notice) return <RecordDetail />;

  const editable = notice.status === 'draft' && can('comms');
  const f = form ?? { audience: str(notice, 'audience') || 'school', grade: str(notice, 'grade'), class: str(notice, 'class'), channel: str(notice, 'channel') || 'sms', body: str(notice, 'body') };
  const to = noticeAudience(notice, data);
  const sent = notice.status === 'sent';

  const save = () => {
    if (f.body.trim().length < 20) { fb.fail('Write the message — at least a sentence.'); return; }
    if (f.audience === 'grade' && !f.grade) { fb.fail('Choose which grade the notice goes to.'); return; }
    if (f.audience === 'class' && !f.class) { fb.fail('Choose which class the notice goes to.'); return; }
    act.update('notices', notice.id, { audience: f.audience, grade: f.audience === 'grade' ? f.grade : '', class: f.audience === 'class' ? f.class : '', channel: f.channel, body: f.body.trim() }, 'Message edited');
    setForm(null);
    fb.ok('Message saved. It needs approval from the deputy or the principal before it can be logged as sent.');
  };

  return (
    <RecordDetail
      aside={
        <Panel title="Preview" meta="What a parent would receive" right={<Tag tone={sent ? 'green' : 'blue'}>{sent ? `${num(notice, 'recipients')} families` : `${to.families} families`}</Tag>}>
          <div className="sms-preview" style={{ whiteSpace: 'pre-wrap' }} data-testid="notice-preview">{noticeMessage(config.businessName, notice)}</div>
          <p className="muted-note" data-testid="notice-recipients">
            {sent ? `Logged as sent on ${formatDate(str(notice, 'sentOn'))} to ${num(notice, 'recipients')} families by ${label(CHANNELS, str(notice, 'channel')).toLowerCase()}.` : `Would go to ${to.families} families (${to.learners} learners · ${to.text}) by ${label(CHANNELS, str(notice, 'channel')).toLowerCase()}.`}
            {' '}Preview only — no SMS or email is sent from this demo.
          </p>
        </Panel>
      }>
      {notice.status === 'draft' && (
        <Panel title="Message" meta="Who the notice goes to and what it says">
          {editable ? (
            <>
              <div className="form-grid">
                <Field label="Send to">
                  <select className="select" aria-label="Send to" value={f.audience} onChange={(e) => setForm({ ...f, audience: e.target.value })}>
                    {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </Field>
                {f.audience === 'grade' && (
                  <Field label="Grade">
                    <select className="select" aria-label="Notice grade" value={f.grade} onChange={(e) => setForm({ ...f, grade: e.target.value })}>
                      <option value="">Select…</option>
                      {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </Field>
                )}
                {f.audience === 'class' && (
                  <Field label="Class">
                    <select className="select" aria-label="Notice class" value={f.class} onChange={(e) => setForm({ ...f, class: e.target.value })}>
                      <option value="">Select…</option>
                      {sortedClasses(data).map((c) => <option key={c.id} value={c.id}>{str(c, 'name')}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Channel">
                  <select className="select" aria-label="Notice channel" value={f.channel} onChange={(e) => setForm({ ...f, channel: e.target.value })}>
                    {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <div className="span-2"><Field label="Message"><textarea className="textarea" style={{ minHeight: 120 }} aria-label="Notice message" value={f.body} onChange={(e) => setForm({ ...f, body: e.target.value })} /></Field></div>
              </div>
              <div className="btns" style={{ marginTop: 12 }}><button className="btn primary sm" onClick={save} disabled={form === null} data-testid="save-notice">Save message</button></div>
            </>
          ) : <p className="muted-note">{label(AUDIENCES, str(notice, 'audience'))} · {label(CHANNELS, str(notice, 'channel'))}</p>}
          {fb.view}
          <WhoCan permission="comms" what="Editing a notice:" />
        </Panel>
      )}
    </RecordDetail>
  );
}

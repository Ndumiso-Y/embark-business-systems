import { useState } from 'react';
import { useActions } from '../../../core/context';
import { Notice } from '../../../core/components/ui';

/** An on-page message plus a matching toast for refusals, so the reason stays visible next to the control. */
export function useFeedback() {
  const act = useActions();
  const [message, setMessage] = useState<{ tone: 'red' | 'accent'; text: string } | null>(null);
  return {
    message,
    clear: () => setMessage(null),
    ok: (text: string) => { setMessage({ tone: 'accent', text }); },
    fail: (text: string) => { setMessage({ tone: 'red', text }); act.toast(text, 'err'); },
    view: message ? <div style={{ marginTop: 12 }} data-testid="feedback"><Notice tone={message.tone}>{message.text}</Notice></div> : null,
  };
}

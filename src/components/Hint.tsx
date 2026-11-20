import { useId, useState, type ReactNode } from "react";

/** A small "?" toggle that keeps explanatory text out of the way until it is wanted. */
export function Hint({ children, label = "How this works" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className={`hint${open ? " hint-open" : ""}`}>
    <button type="button" className="hint-toggle" aria-expanded={open} aria-controls={id} aria-label={label} title={label} onClick={() => setOpen((value) => !value)}>?</button>
    <div id={id} className="hint-body" hidden={!open}>{children}</div>
  </div>;
}

/** A panel's eyebrow title with an optional hint beside it. */
export function PanelTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return <div className="panel-title-row"><p className="eyebrow">{children}</p>{hint && <Hint>{hint}</Hint>}</div>;
}

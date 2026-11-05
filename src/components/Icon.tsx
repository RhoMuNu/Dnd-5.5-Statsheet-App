type IconProps = { name: string; className?: string };

export function Icon({ name, className = "" }: IconProps) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></>,
    abilities: <><path d="m4 3 6 2 10 15-3 1L7 6Z" /><path d="m20 3-6 2L4 20l3 1L17 6ZM3 14l7 7m4 0 7-7" /></>,
    features: <><path d="m12 3 2.5 5.5L21 10l-5 4.5 1 6.5-5-3-5 3 1-6.5L3 10l6.5-1.5Z" /></>,
    inventory: <><rect x="5" y="7" width="14" height="14" rx="3" /><path d="M9 7V5a3 3 0 0 1 6 0v2M5 12h14M9 12v3m6-3v3" /></>,
    spells: <><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4Zm16 0h-4m4 4h-4m4 4h-4M13 21a4 4 0 0 1 4-2h3v-3" /><path d="m18 1 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" /></>,
    notes: <><path d="M6 3h12v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 7h6m-6 4h6m-6 4h4M3 7h3m-3 4h3m-3 4h3" /></>,
    builder: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-3a7 7 0 0 1 11-5m5-1v9m-4-4h8" /></>,
    lan: <><circle cx="12" cy="6" r="3" /><circle cx="5" cy="18" r="3" /><circle cx="19" cy="18" r="3" /><path d="m10 9-4 6m8-6 4 6M8 18h8" /></>,
    shield: <><path d="m12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    heart: <path d="M20.5 5.5a5 5 0 0 0-7 0L12 7l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.5a5 5 0 0 0 0-7Z" />,
    spark: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    dice: <><path d="m12 2 10 6v9l-10 5L2 17V8Zm0 0L7 14l5 8 5-8ZM2 8l5 6h10l5-6M2 17l5-3m10 0 5 3" /></>,
  };
  return <svg className={`ui-icon ${className}`} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.spark}</svg>;
}

const paths = {
  home: 'M4 10.5 12 4l8 6.5V20H4v-9.5Z',
  building: 'M5 21V5h14v16M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h6',
  store: 'M4 20V9l8-5 8 5v11M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01',
  users:
    'M3 20a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 1a4 4 0 0 1 5 4v3',
  account: 'M4 21a8 8 0 0 1 16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  mail: 'M3 6h18v12H3V6Zm0 1 9 6 9-6',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3m-14 0h16v11H4V10Zm8 4v3',
  phone:
    'M6 3h3l2 5-2 2a15 15 0 0 0 6 6l2-2 5 2v3a2 2 0 0 1-2 2C11.2 21 3 12.8 3 5a2 2 0 0 1 2-2h1Z',
  card: 'M3 6h18v12H3V6Zm0 4h18M7 15h4',
  currency:
    'M12 3v18m4-15.5C15.2 4.7 14 4 12.5 4 10.6 4 9 5.1 9 6.7c0 1.7 1.4 2.3 3.3 2.8 2.1.6 3.7 1.2 3.7 3.2 0 1.8-1.7 3.3-4 3.3-1.8 0-3.3-.7-4.2-1.8',
  hash: 'M10 3 8 21M16 3l-2 18M4 9h16M3 15h16',
  filter: 'M4 6h16M7 12h10m-7 6h4',
  link: 'm10 13 4-4m-7 8-2 2a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0m3-3 2-2a4 4 0 0 1 6 6l-3 3a4 4 0 0 1-6 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  chevron: 'm6 9 6 6 6-6',
  collapse: 'M4 4h16v16H4zM9 4v16m7-12-4 4 4 4',
  expand: 'M4 4h16v16H4zM9 4v16m3-12 4 4-4 4',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  check: 'm5 12 4 4L19 6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2Zm-2 5h18M8 2v4m8-4v4',
  tag: 'M20 13 11 22 2 13V2h11l9 9-2 2ZM7 7h.01',
  box: 'm4 7 8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4m-8 4v10',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5',
  file: 'M6 3h8l4 4v14H6V3Zm8 0v5h5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  pencil: 'm4 16 0-4L15 1l4 4L8 16H4Zm11-15 4 4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 10h18c0-3-3-3-3-10ZM10 21h4',
  info: 'M12 11v6m0-10h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 19v2h16v-2',
} as const;

export type IconName = keyof typeof paths;

export function fieldIconForLabel(value: string): IconName {
  const label = value.toLowerCase();
  if (label.includes('search') || label.includes('query')) return 'search';
  if (label.includes('email') || label.includes('mail')) return 'mail';
  if (label.includes('password') || label.includes('secret')) return 'lock';
  if (label.includes('phone') || label.includes('tel')) return 'phone';
  if (
    label.includes('date') ||
    label.includes('day') ||
    label.includes('time') ||
    label.includes('from') ||
    label.includes('through') ||
    label.includes('period')
  )
    return 'calendar';
  if (
    label.includes('price') ||
    label.includes('amount') ||
    label.includes('payment') ||
    label.includes('cost') ||
    label.includes('revenue')
  )
    return 'currency';
  if (
    label.includes('quantity') ||
    label.includes('stock') ||
    label.includes('threshold') ||
    label.includes('unit')
  )
    return 'box';
  if (
    label.includes('sku') ||
    label.includes('barcode') ||
    label.includes('code')
  )
    return 'tag';
  if (label.includes('product') || label.includes('item')) return 'box';
  if (
    label.includes('branch') ||
    label.includes('location') ||
    label.includes('address') ||
    label.includes('city') ||
    label.includes('province') ||
    label.includes('country')
  )
    return 'building';
  if (label.includes('space') || label.includes('occupancy')) return 'layers';
  if (
    label.includes('merchant') ||
    label.includes('cashier') ||
    label.includes('member') ||
    label.includes('user') ||
    label.includes('contact') ||
    label.includes('name')
  )
    return 'account';
  if (label.includes('type')) return 'tag';
  if (
    label.includes('status') ||
    label.includes('role') ||
    label.includes('access') ||
    label.includes('participation') ||
    label.includes('method') ||
    label.includes('filter')
  )
    return 'filter';
  if (label.includes('link') || label.includes('url')) return 'link';
  if (
    label.includes('reason') ||
    label.includes('note') ||
    label.includes('description')
  )
    return 'file';
  return 'filter';
}

export function Icon({
  name,
  className = 'size-5',
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

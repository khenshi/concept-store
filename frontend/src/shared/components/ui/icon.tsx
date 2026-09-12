const paths = {
  home: 'M4 10.5 12 4l8 6.5V20H4v-9.5Z',
  building: 'M5 21V5h14v16M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h6',
  store: 'M4 20V9l8-5 8 5v11M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01',
  users:
    'M3 20a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 1a4 4 0 0 1 5 4v3',
  account: 'M4 21a8 8 0 0 1 16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  chevron: 'm6 9 6 6 6-6',
  collapse: 'M4 4h16v16H4zM9 4v16m7-12-4 4 4 4',
  expand: 'M4 4h16v16H4zM9 4v16m3-12 4 4-4 4',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  check: 'm5 12 4 4L19 6',
} as const;

export type IconName = keyof typeof paths;

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

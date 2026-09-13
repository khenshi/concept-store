// Public, feature-owned bridge for programmatic organization switching. The
// mounted POS screen alone owns any confirmation; outside POS this is a no-op.
export const POS_NAVIGATION_EVENT = 'kapwesto:pos-before-navigation';
export function allowPosNavigation(href: string): boolean {
  return window.dispatchEvent(
    new CustomEvent(POS_NAVIGATION_EVENT, {
      cancelable: true,
      detail: { href },
    }),
  );
}

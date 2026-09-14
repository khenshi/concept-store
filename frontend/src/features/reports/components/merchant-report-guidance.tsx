export function MerchantReportGuidance() {
  return (
    <p className="mt-4 text-sm leading-7 text-muted">
      Only sales of products historically owned by your currently linked
      merchant profile are included, including your items in mixed-merchant
      transactions. Branch choices include explicit assignments and historical
      own-selling branches, regardless of the selected dates. An assignment
      alone does not grant whole-branch sales access. If your profile is not
      linked, assigned branches return zero own totals. Ask an owner to check
      your merchant profile link and branch assignments, then refresh access.
      These totals are not profit or payouts.
    </p>
  );
}

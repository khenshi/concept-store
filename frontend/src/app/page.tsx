import Link from 'next/link';

export default function Home() {
  return (
    <main className="home-shell">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Concept Store Management System</p>
        <h1 id="page-title">Run your concept store in one place.</h1>
        <p className="summary">
          The shared web application will provide separate store-operations and
          merchant experiences as Milestone 1 flows are connected.
        </p>
        <div className="home-actions">
          <Link className="primary-link" href="/login">
            Sign in
          </Link>
          <Link className="text-link" href="/register">
            Create an account
          </Link>
        </div>
        <div className="areas" aria-label="Planned application areas">
          <article>
            <span>Store operations</span>
            <p>Organization, membership, and branch administration.</p>
          </article>
          <article>
            <span>Merchant portal</span>
            <p>A dedicated role-based area for future merchant workflows.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

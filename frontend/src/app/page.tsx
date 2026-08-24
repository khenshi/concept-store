import Link from 'next/link';

const storeCapabilities = [
  {
    number: '01',
    title: 'One operational record',
    description:
      'Keep organizations, branches, teams, and merchants connected instead of scattered across separate files.',
  },
  {
    number: '02',
    title: 'Access that follows each role',
    description:
      'Give owners, managers, cashiers, and merchants a view shaped around the work they are allowed to do.',
  },
  {
    number: '03',
    title: 'Built around merchant retail',
    description:
      'Create a foundation for products, inventory, sales attribution, agreements, and settlements to work together.',
  },
];

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link
          className="landing-wordmark"
          href="/"
          aria-label="Concept Store home"
        >
          <span className="wordmark-mark" aria-hidden="true">
            CS
          </span>
          <span>Concept Store</span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#built-for">Built for</a>
          <a href="#workflow">How it works</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-sign-in" href="/login">
            Sign in
          </Link>
          <Link className="primary-link landing-header-cta" href="/register">
            Get started
          </Link>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="page-title">
        <div className="landing-hero-copy">
          <p className="eyebrow">Built for multi-merchant retail</p>
          <h1 id="page-title">
            Run your concept store with <span>one clear system.</span>
          </h1>
          <p className="landing-summary">
            Bring branches, teams, and independent merchants into one organized
            workspace—built for the way concept stores actually operate.
          </p>
          <div className="landing-hero-actions">
            <Link className="primary-link" href="/register">
              Create your workspace
            </Link>
            <a className="landing-secondary-link" href="#platform">
              Explore the platform <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="landing-assurance">
            Clear setup. Role-aware access. Your organization stays separated.
          </p>
        </div>

        <div className="workspace-preview" aria-label="Store workspace preview">
          <div className="preview-topbar">
            <div className="preview-brand">
              <span className="preview-brand-mark" aria-hidden="true" />
              <span>North &amp; Pine</span>
            </div>
            <span className="preview-user" aria-hidden="true">
              MP
            </span>
          </div>
          <div className="preview-layout">
            <div className="preview-sidebar" aria-hidden="true">
              <span className="preview-nav-line preview-nav-line-active" />
              <span className="preview-nav-line" />
              <span className="preview-nav-line" />
              <span className="preview-nav-line" />
            </div>
            <div className="preview-content">
              <div className="preview-heading">
                <div>
                  <span className="preview-kicker">Store overview</span>
                  <strong>Good morning, Mara</strong>
                </div>
                <span className="preview-action">Add merchant</span>
              </div>
              <div className="preview-metrics" aria-hidden="true">
                <div>
                  <span>Branches</span>
                  <strong>03</strong>
                  <small>Active locations</small>
                </div>
                <div>
                  <span>Merchants</span>
                  <strong>24</strong>
                  <small>Across your store</small>
                </div>
                <div>
                  <span>Team</span>
                  <strong>12</strong>
                  <small>Active members</small>
                </div>
              </div>
              <div className="preview-table">
                <div className="preview-table-title">
                  <strong>Recently added merchants</strong>
                  <span>View all</span>
                </div>
                <div className="preview-row">
                  <span className="preview-avatar">AR</span>
                  <span>
                    <strong>Amihan Rituals</strong>
                    <small>Quezon City · Makati</small>
                  </span>
                  <span className="preview-status">Active</span>
                </div>
                <div className="preview-row">
                  <span className="preview-avatar preview-avatar-warm">SL</span>
                  <span>
                    <strong>Sinta Local</strong>
                    <small>Makati</small>
                  </span>
                  <span className="preview-status">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Platform principles">
        <p>One connected workspace for every side of your store</p>
        <div>
          <span>Organization</span>
          <span aria-hidden="true">•</span>
          <span>Branches</span>
          <span aria-hidden="true">•</span>
          <span>Team</span>
          <span aria-hidden="true">•</span>
          <span>Merchants</span>
        </div>
      </section>

      <section className="landing-section landing-platform" id="platform">
        <div className="section-heading">
          <p className="eyebrow">A calmer way to operate</p>
          <h2>Clarity across the whole store.</h2>
          <p>
            Start with a dependable foundation today, designed to connect the
            rest of your store operations as the platform grows.
          </p>
        </div>
        <div className="capability-grid">
          {storeCapabilities.map((capability) => (
            <article key={capability.number}>
              <span className="capability-number">{capability.number}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-split" id="built-for">
        <div className="landing-split-visual" aria-hidden="true">
          <div className="role-card role-card-owner">
            <span>Owner workspace</span>
            <strong>A complete view of your operation</strong>
            <div className="role-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="role-card role-card-merchant">
            <span>Merchant access</span>
            <strong>Only the information that belongs to them</strong>
            <div className="role-progress">
              <i />
            </div>
          </div>
        </div>
        <div className="landing-split-copy">
          <p className="eyebrow">One system, separate access</p>
          <h2>Every role sees what matters to them.</h2>
          <p>
            Owners and managers can coordinate store operations while merchants
            work within their own authorized view. The experience stays
            connected without blurring responsibilities or data boundaries.
          </p>
          <ul className="check-list">
            <li>Organization-aware access from the start</li>
            <li>Dedicated paths for store teams and merchants</li>
            <li>Built to support multiple physical branches</li>
          </ul>
        </div>
      </section>

      <section className="landing-section workflow-section" id="workflow">
        <div className="section-heading">
          <p className="eyebrow">Designed for the real workflow</p>
          <h2>From merchant onboarding to payout.</h2>
          <p>
            Concept Store is being built around the full operating relationship,
            so each future step has a clear place in the same system.
          </p>
        </div>
        <ol className="workflow-list">
          {[
            'Merchant',
            'Space',
            'Products',
            'Sales',
            'Settlement',
            'Payout',
          ].map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <p className="eyebrow">Start with a clear foundation</p>
        <h2 id="cta-title">Bring your concept store into one workspace.</h2>
        <p>
          Create your account and set up your organization, team, and branches.
        </p>
        <Link className="primary-link" href="/register">
          Get started
        </Link>
      </section>

      <footer className="landing-footer">
        <Link
          className="landing-wordmark"
          href="/"
          aria-label="Concept Store home"
        >
          <span className="wordmark-mark" aria-hidden="true">
            CS
          </span>
          <span>Concept Store</span>
        </Link>
        <p>Clear operations for multi-merchant retail.</p>
        <Link href="/login">Sign in</Link>
      </footer>
    </main>
  );
}

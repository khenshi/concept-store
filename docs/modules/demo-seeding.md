# Demo seeding

The guarded development seed resets the explicitly configured disposable database.
It creates the existing role/access, sale and refund examples, plus four retail
merchants with sixteen products, thirty-two inventory placements and attributed
opening receipt movements. Two branches each have twelve spaces: eight occupied
by active participating merchants and four vacant. Expansion writes are atomic.
No API, schema or authorization behavior is changed. See
`docs/development/database-seeding.md` for execution requirements and credentials.

# Add Space cancellation

Approved and implemented October 20, 2026: Cancel in Add Space closes directly,
without the browser's discard confirmation. Keep pending-save protection, Edit
Space confirmation, Escape/backdrop guards and navigation guards unchanged.

Focused regression: dirty Add Space cancellation must close without calling
`window.confirm`. No backend or dependency changes.

Validation: cancellation regression passes; suite result is 16 passed and one
existing unrelated layout assertion failure (`md:col-span-2`). Formatting and
diff checks pass.

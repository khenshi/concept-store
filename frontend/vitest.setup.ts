import '@testing-library/jest-dom/vitest';

// jsdom does not implement native modal behavior. These shims only model open/
// close state; browser focus containment and top-layer layout need rendered QA.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}

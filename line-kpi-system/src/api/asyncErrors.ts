/**
 * Express 4 does not route a rejected promise from an async handler to the error handler: the
 * rejection is unhandled and Node ends the process (one bad request took production down).
 * This makes every route and middleware layer forward a rejection to `next(err)`, so the global
 * error handler in app.ts answers it. Import it once, before any router is built.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Layer = require('express/lib/router/layer') as {
  prototype: {
    handle: (...args: unknown[]) => unknown;
    handle_request: (req: unknown, res: unknown, next: (err?: unknown) => void) => void;
    handle_error: (err: unknown, req: unknown, res: unknown, next: (err?: unknown) => void) => void;
  };
};

function forwardRejection(result: unknown, next: (err?: unknown) => void): void {
  if (result && typeof (result as Promise<unknown>).catch === 'function') {
    (result as Promise<unknown>).catch((err) => next(err ?? new Error('Rejected without a reason')));
  }
}

Layer.prototype.handle_request = function handleRequest(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next();
  try {
    forwardRejection(fn(req, res, next), next);
  } catch (err) {
    next(err);
  }
};

Layer.prototype.handle_error = function handleError(error, req, res, next) {
  const fn = this.handle;
  if (fn.length !== 4) return next(error);
  try {
    forwardRejection(fn(error, req, res, next), next);
  } catch (err) {
    next(err);
  }
};

export {};

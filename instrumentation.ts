// Next.js instrumentation hook (https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
//
// Runs once when the server boots — both in `next dev` and in production. We
// use it to kick the WhatsApp promo worker so any jobs left in the queue
// (from a previous process or a fresh enqueue) start draining immediately,
// instead of waiting for an admin to open the Promote modal.
//
// Without this, the worker only boots when `/api/whatsapp/training-promo`
// is hit by an authenticated admin, which means a queued blast can sit
// untouched in the DB across restarts.

export async function register() {
  // The worker uses Node-only APIs (fetch with AbortController, setTimeout,
  // pg driver), so guard the runtime — this hook also runs on Edge.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { recoverAndStart } = await import('./lib/whatsappPromoWorker');
    await recoverAndStart();
  } catch (err) {
    console.error('[instrumentation] whatsapp promo worker boot failed', err);
  }
}

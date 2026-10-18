/** UI-independent request state. Does not grant payment, entitlements, approvals, or mutate GiftSession. */
import { GiftApiError } from './backend.next.js';
export class RequestSlot {
    current = { status: 'idle' };
    epoch = 0;
    abort;
    get state() { return structuredClone(this.current); }
    async run(operation) {
        this.abort?.abort();
        const token = ++this.epoch, controller = new AbortController();
        this.abort = controller;
        const previous = this.current.status === 'ready' ? this.current.value : 'previous' in this.current ? this.current.previous : undefined;
        this.current = { status: 'loading', previous };
        try {
            const result = await operation(controller.signal);
            if (token === this.epoch)
                this.current = { status: 'ready', value: structuredClone(result) };
        }
        catch (e) {
            if (token === this.epoch)
                this.current = { status: 'failed', code: e instanceof GiftApiError ? e.code : 'request_failed', httpStatus: e instanceof GiftApiError ? e.status : 0, previous };
        }
    }
    reset() { this.epoch++; this.abort?.abort(); this.current = { status: 'idle' }; }
}
// Retry is an explicit caller action invoking run again. No auto-retry, background poller, localStorage entitlement,
// client-paid flag, or generic replay of a mutation. Restoration always uses GiftBackend.restore.

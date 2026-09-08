import assert from 'assert';

console.log('--- TESTING ASYNC RACE CONDITION PROTECTION LOGIC ---');

/**
 * Emulates the race condition guard pattern implemented in useEvents:
 * 1. activeControllerRef to cancel previous in-flight requests
 * 2. requestIdRef to sequence requests
 * 3. isMountedRef to discard state updates after unmount
 */
class EventFetchManager {
  private activeController: AbortController | null = null;
  private requestId = 0;
  private isMounted = true;
  public state: { data: string | null; error: string | null; loading: boolean } = {
    data: null,
    error: null,
    loading: false,
  };

  async fetch(param: string, delayMs: number, shouldFail = false): Promise<void> {
    if (this.activeController) {
      this.activeController.abort();
    }

    const controller = new AbortController();
    this.activeController = controller;
    const currentReqId = ++this.requestId;

    this.state.loading = true;
    this.state.error = null;

    try {
      const result = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (shouldFail) {
            reject(new Error(`Failed for ${param}`));
          } else {
            resolve(`Result for ${param}`);
          }
        }, delayMs);

        controller.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

      if (!this.isMounted || currentReqId !== this.requestId || controller.signal.aborted) {
        return;
      }

      this.state.data = result;
      this.state.error = null;
      this.state.loading = false;
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      if (this.isMounted && currentReqId === this.requestId) {
        this.state.error = err.message;
        this.state.loading = false;
      }
    }
  }

  unmount() {
    this.isMounted = false;
    this.requestId++;
    if (this.activeController) {
      this.activeController.abort();
    }
  }
}

async function runRaceConditionTests() {
  // Scenario 1: Start A (slow 100ms), start B (fast 30ms). B completes first. A should not overwrite B.
  const manager1 = new EventFetchManager();
  const promiseA = manager1.fetch('A (slow)', 100);
  const promiseB = manager1.fetch('B (fast)', 30);

  await Promise.allSettled([promiseA, promiseB]);
  assert.strictEqual(manager1.state.data, 'Result for B (fast)');
  assert.strictEqual(manager1.state.loading, false);
  assert.strictEqual(manager1.state.error, null);
  console.log('[PASS] Scenario 1: Fast Request B superseded slow Request A and A did not overwrite B.');

  // Scenario 2: Old request A fails after new request B succeeds. Old error must not replace new data.
  const manager2 = new EventFetchManager();
  const slowFailingA = manager2.fetch('A (fails slow)', 80, true);
  const fastSucceedingB = manager2.fetch('B (succeeds fast)', 20, false);

  await Promise.allSettled([slowFailingA, fastSucceedingB]);
  assert.strictEqual(manager2.state.data, 'Result for B (succeeds fast)');
  assert.strictEqual(manager2.state.error, null);
  console.log('[PASS] Scenario 2: Failed old request A did not overwrite successful new result B.');

  // Scenario 3: Navigating away / unmount during in-flight request.
  const manager3 = new EventFetchManager();
  const inFlight = manager3.fetch('Unmounted', 50);
  manager3.unmount();
  await Promise.allSettled([inFlight]);
  assert.strictEqual(manager3.state.data, null);
  console.log('[PASS] Scenario 3: Component unmount prevents state mutation from in-flight request.');

  // Scenario 4: Rapid sequential changes (user rapidly typing in search or clicking filters)
  const manager4 = new EventFetchManager();
  const p1 = manager4.fetch('Query 1', 60);
  const p2 = manager4.fetch('Query 2', 50);
  const p3 = manager4.fetch('Query 3', 40);
  const p4 = manager4.fetch('Query 4', 10);

  await Promise.allSettled([p1, p2, p3, p4]);
  assert.strictEqual(manager4.state.data, 'Result for Query 4');
  console.log('[PASS] Scenario 4: Rapid sequential requests cleanly resolve only to latest Request 4.');

  console.log('\nALL ASYNC RACE CONDITION SCENARIOS VERIFIED SUCCESSFULLY!');
}

runRaceConditionTests().catch(err => {
  console.error(err);
  process.exit(1);
});

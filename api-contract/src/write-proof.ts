import { EnvironmentFailure, UNCERTAIN_ACTION_OUTCOME_ERROR } from './classification';
import { isUncertainWrite } from './transport';
import type { ApiResponse, UncertainWrite } from './transport';

// The API counterpart of the UI's actAndVerifyOutcome (pages/app-navigation.ts, ADR 0001),
// written from the same rule rather than imported: when a write's answer cannot be read, prove
// what state the server is in from a fresh read, and repeat the write only when that proof
// shows it did not land. A write is never replayed blind.

/** What a state proof established. 'unknown' is expressed by the prover throwing. */
export type ProvenState = 'committed' | 'not-committed';

export type WriteOutcome =
  /** The API answered normally; assert its body as usual. */
  | { kind: 'answered'; response: ApiResponse; attempts: number }
  /** The answer was lost, but a read proved the write landed. There is no body to assert. */
  | { kind: 'proven-committed'; reason: string; attempts: number };

export type ProvableWrite = {
  /** Used in failure messages, e.g. "Deleting account api-contract.<id>@example.com". */
  label: string;
  send: () => Promise<ApiResponse | UncertainWrite>;
  /** A read-only check of whether the intended state holds. Throwing means the state is unknown. */
  prove: () => Promise<ProvenState>;
  /**
   * Whether repeating the write is harmless once it is proven not to have landed. False for
   * create: a second create that races a slow first one is exactly the duplicate this avoids.
   */
  replayWhenNotCommitted: boolean;
};

async function proveOrFail(write: ProvableWrite, reason: string): Promise<ProvenState> {
  try {
    return await write.prove();
  } catch (error: unknown) {
    const proofError = error instanceof Error ? error.message : String(error);

    throw new EnvironmentFailure(`${write.label}: ${UNCERTAIN_ACTION_OUTCOME_ERROR} Cause: ${reason}. Proof failed: ${proofError}`);
  }
}

export async function performAndProveWrite(write: ProvableWrite): Promise<WriteOutcome> {
  const first = await write.send();

  if (!isUncertainWrite(first)) {
    return { kind: 'answered', response: first, attempts: 1 };
  }

  const firstState = await proveOrFail(write, first.reason);

  if (firstState === 'committed') {
    return { kind: 'proven-committed', reason: first.reason, attempts: 1 };
  }

  if (!write.replayWhenNotCommitted) {
    throw new EnvironmentFailure(
      `${write.label} did not take effect: ${first.reason}. A read proved it did not land, and this write is never repeated.`
    );
  }

  const second = await write.send();

  if (!isUncertainWrite(second)) {
    return { kind: 'answered', response: second, attempts: 2 };
  }

  const secondState = await proveOrFail(write, second.reason);

  if (secondState === 'committed') {
    return { kind: 'proven-committed', reason: second.reason, attempts: 2 };
  }

  throw new EnvironmentFailure(`${write.label} did not take effect after 2 attempts: ${first.reason}; then ${second.reason}.`);
}

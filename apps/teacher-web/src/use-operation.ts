import { useRef, useState } from 'react';
import { newOperation, reconcile, type ApiFailure, type MutationResult, type Operation, type PendingOperation } from './api';

export type OperationOutcome<T> = { ok: true; operation: Operation<T> } | { ok: false; error: ApiFailure } | { ok: 'unknown' };
export const checkingMessage = 'Đang kiểm tra kết quả với hệ thống';
export const unknownMessage = 'Chưa xác nhận được kết quả. Hãy kiểm tra lại với hệ thống trước khi gửi lại.';

// Holds the one in-flight Operation of a workspace. An unknown outcome keeps the same Operation
// (same Idempotency-Key) so "Kiểm tra lại" reconciles first and only then resends safely.
export function useOperation(schoolId: string) {
  const pending = useRef<{ operation: PendingOperation; send: (operation: PendingOperation) => Promise<MutationResult<unknown>> } | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [unresolved, setUnresolved] = useState(false);

  const settle = <T,>(result: MutationResult<T>): OperationOutcome<T> => {
    if (result.ok === 'unknown') return { ok: 'unknown' };
    pending.current = undefined;
    setUnresolved(false);
    return result.ok ? { ok: true, operation: result.data } : { ok: false, error: result.error };
  };
  const confirm = async <T,>(): Promise<OperationOutcome<T>> => {
    const current = pending.current;
    if (!current) return { ok: 'unknown' };
    const checked = await reconcile<T>(schoolId, current.operation.id);
    if (checked.state === 'completed') return settle<T>({ ok: true, data: checked.operation });
    if (checked.state === 'failed') return settle<T>({ ok: false, error: { status: 409, message: 'Thao tác không hoàn tất. Hãy thử lại.' } });
    if (checked.state === 'missing') return settle<T>((await current.send(current.operation)) as MutationResult<T>);
    setUnresolved(true);
    return { ok: 'unknown' };
  };
  const run = async <T,>(send: (operation: PendingOperation) => Promise<MutationResult<T>>): Promise<OperationOutcome<T>> => {
    if (pending.current) return retry<T>();
    const operation = newOperation();
    pending.current = { operation, send: send as (operation: PendingOperation) => Promise<MutationResult<unknown>> };
    setBusy(true);
    try {
      const result = await send(operation);
      return result.ok === 'unknown' ? await confirm<T>() : settle(result);
    } finally {
      setBusy(false);
    }
  };
  const retry = async <T,>(): Promise<OperationOutcome<T>> => {
    setBusy(true);
    try {
      return await confirm<T>();
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    pending.current = undefined;
    setUnresolved(false);
  };
  return { run, retry, discard, busy, unresolved, hasPending: () => Boolean(pending.current) };
}

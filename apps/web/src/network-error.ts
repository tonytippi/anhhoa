export const networkErrorMessage = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";

// The browser rejects fetch with an English TypeError ("Failed to fetch") when the server is unreachable. Keep the TypeError
// class, because mutation code treats it as an uncertain outcome to reconcile, but give every screen a Vietnamese message.
export function installNetworkErrorMessage(target: { fetch: typeof fetch }) {
  const original = target.fetch.bind(target);
  target.fetch = (...args: Parameters<typeof fetch>) =>
    original(...args).catch((error: unknown) => {
      throw error instanceof TypeError ? new TypeError(networkErrorMessage, { cause: error }) : error;
    });
}

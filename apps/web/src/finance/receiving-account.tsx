// Decision 2026-10-05 §3: "<bank code> - <holder>" over the full account number; the School account is marked by an icon only.
export type ReceivingAccount = {
  id: string;
  kind: "SCHOOL" | "PERSONAL";
  bankCode: string;
  accountHolderName: string;
  accountNumber: string;
};

export const receivingAccountName = (account: ReceivingAccount) => `${account.bankCode} - ${account.accountHolderName}`;

export function ReceivingAccountLabel({ account }: { account: ReceivingAccount }) {
  const school = account.kind === "SCHOOL";
  return (
    <span className="receiving-account" title={school ? "Tài khoản trường" : undefined}>
      {school ? (
        <svg className="receiving-account-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 1.5 1.5 5v1.5h13V5L8 1.5ZM3 8v4.5h2V8H3Zm4 0v4.5h2V8H7Zm4 0v4.5h2V8h-2ZM1.5 13.5V15h13v-1.5h-13Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <span className="receiving-account-icon" aria-hidden="true" />
      )}
      {school && <span className="sr-only">Tài khoản trường</span>}
      <span>
        <b>{receivingAccountName(account)}</b>
        <small>{account.accountNumber}</small>
      </span>
    </span>
  );
}

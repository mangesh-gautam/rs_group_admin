"use client";

import { useState } from "react";
import { AccountTransactions } from "./AccountTransactions";
import { CorrectionHistory } from "./TransactionCorrections";

/** Super Admin account page: the statement (with Edit / Delete / Add interest) and the corrections made on it. */
export function SuperAdminAccountTransactions({ accountNo }: { accountNo: string }) {
  const [version, setVersion] = useState(0); // bumped after a correction → the history reloads
  return (
    <>
      <AccountTransactions accountNo={accountNo} onChanged={() => setVersion((v) => v + 1)} />
      <CorrectionHistory key={version} accountNo={accountNo} />
    </>
  );
}

"use client";

import Link from "next/link";
import { ImportPage } from "@/components/finance/Import";
import { useFinance } from "@/lib/financeStore";

export default function ImportStatementsPage() {
  const { ready } = useFinance();
  if (!ready) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/finances/#spending" className="text-sm font-semibold text-sage-dark md:mt-4 md:inline-block">
        ‹ Finances
      </Link>
      <h1 className="mt-1 text-[26px] font-bold md:text-3xl">Import statements</h1>
      <div className="mt-4">
        <ImportPage />
      </div>
    </div>
  );
}

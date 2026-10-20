import { ComingSoon } from "@/components/ComingSoon";

export default function FinancesPage() {
  return (
    <ComingSoon
      title="Finances"
      milestone="Milestone 3"
      points={[
        "Import CSV bank statements, with duplicate detection",
        "Spending by category, bills and budgets",
        "A trustworthy 'left to spend until payday' forecast",
      ]}
    />
  );
}

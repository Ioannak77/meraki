import { ComingSoon } from "@/components/ComingSoon";

export default function InsightsPage() {
  return (
    <ComingSoon
      title="Insights"
      milestone="Milestone 4"
      points={[
        "Routine consistency and maintenance gaps",
        "A short weekly reset that adjusts next week",
        "Suggestions when a routine keeps getting skipped",
      ]}
    />
  );
}

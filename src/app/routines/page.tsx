import { ComingSoon } from "@/components/ComingSoon";

export default function RoutinesPage() {
  return (
    <ComingSoon
      title="Routines"
      milestone="Milestone 2"
      points={[
        "Morning, evening, skincare and cleaning routines with steps",
        "Full-screen countdown for each step, plus a 'Just start: 2 minutes' button",
        "Short versions, snooze and skip, with no backlog after missed days",
        "Gentle reminders inside a time window you choose",
      ]}
    />
  );
}

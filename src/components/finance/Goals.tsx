"use client";

import { useState } from "react";
import { money, type Goal } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { AddButton, Bar, Card, CardTitle, DangerButton, Label, MoneyInput, PrimaryButton, Sheet, inputClass } from "./ui";

export function GoalsTab() {
  const { goals } = useFinance();
  const [editing, setEditing] = useState<Goal | "new" | "emergency" | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);
  const hasEmergency = goals.some((g) => g.emergency);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardTitle action={<AddButton onClick={() => setEditing("new")} label="Add a goal" />}>Savings goals</CardTitle>
        {!hasEmergency && (
          <button
            type="button"
            onClick={() => setEditing("emergency")}
            className="mb-3 w-full rounded-2xl bg-sage-soft p-4 text-left text-[15px] text-sage-dark"
          >
            <strong>Start an emergency fund</strong>
            <span className="block text-sm">A common aim is 3 months of bills and essentials. Tap to set yours.</span>
          </button>
        )}
        {goals.length === 0 ? (
          <p className="text-muted">No goals yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {goals.map((g) => (
              <li key={g.id} className="py-3">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditing(g)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-semibold">
                      {g.name}
                      {g.emergency && <span className="ml-2 rounded-full bg-sage-soft px-2 py-0.5 text-[11px] text-sage-dark">Emergency</span>}
                    </span>
                    <span className="block text-[13px] text-muted">
                      {money(g.saved)} of {money(g.target, true)}
                      {g.saved >= g.target ? " · reached 🎉" : ` · ${money(g.target - g.saved, true)} to go`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(g)}
                    className="shrink-0 rounded-full bg-sage-dark px-3.5 py-2 text-sm font-bold text-white"
                  >
                    + Add
                  </button>
                </div>
                <div className="mt-2">
                  <Bar value={g.saved} max={g.target} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <GoalSheet goal={editing} onClose={() => setEditing(null)} />}
      {adding && <AddMoneySheet goal={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function GoalSheet({ goal, onClose }: { goal: Goal | "new" | "emergency"; onClose: () => void }) {
  const { saveGoal, deleteGoal } = useFinance();
  const existing = typeof goal === "string" ? null : goal;
  const [name, setName] = useState(existing?.name ?? (goal === "emergency" ? "Emergency fund" : ""));
  const [target, setTarget] = useState<number | null>(existing?.target ?? null);
  const [saved, setSaved] = useState<number | null>(existing?.saved ?? 0);
  const valid = name.trim() && target && target > 0;

  return (
    <Sheet title={existing ? "Edit goal" : "New goal"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          saveGoal({
            id: existing?.id,
            name: name.trim(),
            target: target!,
            saved: saved ?? 0,
            emergency: existing?.emergency ?? goal === "emergency",
          });
          onClose();
        }}
      >
        <Label>Name</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Holiday" className={inputClass} />
        <Label>Target</Label>
        <MoneyInput value={target} onChange={setTarget} label="Target" />
        <Label>Saved so far</Label>
        <MoneyInput value={saved} onChange={setSaved} label="Saved so far" />
        <PrimaryButton type="submit" disabled={!valid}>
          {existing ? "Save" : "Add goal"}
        </PrimaryButton>
        {existing && (
          <DangerButton
            label="Delete goal"
            onConfirm={() => {
              deleteGoal(existing.id);
              onClose();
            }}
          />
        )}
      </form>
    </Sheet>
  );
}

function AddMoneySheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { saveGoal } = useFinance();
  const [amount, setAmount] = useState<number | null>(null);
  const valid = amount !== null && amount !== 0;
  return (
    <Sheet title={`Add to ${goal.name}`} onClose={onClose}>
      <Label>How much did you put aside? (use a minus to take some out)</Label>
      <MoneyInput value={amount} onChange={setAmount} autoFocus label="Amount" />
      <PrimaryButton
        disabled={!valid}
        onClick={() => {
          saveGoal({ ...goal, saved: Math.max(0, goal.saved + amount!) });
          onClose();
        }}
      >
        Add
      </PrimaryButton>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

export function SaveExecutionModal({
  onSave,
  onClose,
}: {
  onSave: (name: string, description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Execution name is required.");
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), description.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the execution.");
      setSaving(false);
    }
  };

  return (
    <Modal title="Save Execution" onClose={onClose}>
      <form onSubmit={submit}>
        <label className={fieldLabel} htmlFor="execution-name">Execution Name</label>
        <input
          id="execution-name"
          className={fieldInput}
          placeholder="Enter execution name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <label className={fieldLabel} htmlFor="execution-description">Description / Comments</label>
        <input
          id="execution-description"
          className={fieldInput}
          placeholder="Add description or comments for this execution"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && <div className="mt-3 text-[12px] text-[#DC3545]">{error}</div>}
        <div className="mt-7 flex justify-center gap-4">
          <button type="submit" className={primaryButton} disabled={saving}>
            {saving ? "Saving…" : "Save Execution"}
          </button>
          <button type="button" className={outlineButton} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

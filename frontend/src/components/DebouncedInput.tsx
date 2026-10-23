"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & {
  value: string; // the committed value (comes from the URL)
  onCommit: (value: string) => void;
  delay?: number;
};

// Calls onCommit once the user stops typing. The input itself is uncontrolled, so typing is
// never interrupted by a re-render caused by the URL updating.
export function DebouncedInput({ value, onCommit, delay = 300, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // When the value changes from outside (back button, "Clear filters"), show it,
  // unless the user is typing in this very input.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.value !== value) el.value = value;
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <input
      ref={ref}
      defaultValue={value}
      onChange={(e) => {
        const next = e.target.value;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => onCommit(next), delay);
      }}
      {...props}
    />
  );
}
"use client";

import { X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MAX_TAGS } from "@/lib/constants";
import { tagsApi } from "@/lib/endpoints";

const TAG_PATTERN = /^[\p{L}\p{N} _.&-]{1,50}$/u;

interface Props {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

// Chips plus autocomplete from /api/tags. Enter or comma adds a tag, Backspace removes the last.
export function TagInput({ id, value, onChange, placeholder }: Props) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const query = useDebounce(text.trim(), 250);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    tagsApi
      .suggest(query, controller.signal)
      .then((r) => setSuggestions(r.tags))
      .catch(() => {});
    return () => controller.abort();
  }, [query]);

  const shown = text.trim()
    ? suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    : [];

  function add(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setText("");
      return;
    }
    if (value.length >= MAX_TAGS) return setProblem(`At most ${MAX_TAGS} tags`);
    if (!TAG_PATTERN.test(tag)) return setProblem("Tags may contain letters, numbers, spaces and - _ . &");
    setProblem(null);
    onChange([...value, tag]);
    setText("");
    setSuggestions([]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setProblem(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => add(text)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 border-0 bg-transparent p-1 text-sm focus:outline-none"
        />
      </div>
      {shown.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {shown.map((s) => (
            <li key={s}>
              {/* mouse down would blur the input and add the half-typed text first */}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50">
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="mt-1 text-xs text-red-600">{problem}</p>}
    </div>
  );
}
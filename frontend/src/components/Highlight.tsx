// The API marks matches with [[ and ]]. They are rendered as React text, never as HTML,
// so document content cannot inject markup.
export function Highlight({ text }: { text: string }) {
  // split() with a capture group puts the marked text at the odd positions
  const parts = text.split(/\[\[([\s\S]*?)\]\]/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-highlight px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
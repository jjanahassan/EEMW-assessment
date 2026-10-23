// The API marks matches with [[ and ]]. They are rendered as React text, never as HTML,
// so document content cannot inject markup.
export function Highlight({ text }: { text: string }) {
  let on = false;
  return (
    <>
      {text.split(/(\[\[|\]\])/).map((part, i) => {
        if (part === "[[") {
          on = true;
          return null;
        }
        if (part === "]]") {
          on = false;
          return null;
        }
        return on ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}
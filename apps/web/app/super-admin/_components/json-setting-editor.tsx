'use client';

type JsonSettingEditorProps = {
  title: string;
  description: string;
  value: string;
  onChange: (next: string) => void;
  onSave: () => Promise<void>;
  saveLabel: string;
};

export function JsonSettingEditor(props: JsonSettingEditorProps) {
  const { title, description, value, onChange, onSave, saveLabel } = props;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-300">{description}</p>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        spellCheck={false}
        className="mt-4 min-h-72 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-xs text-slate-100 outline-none ring-cyan-300 focus:ring"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void onSave()}
          className="rounded-lg border border-cyan-500 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/10"
        >
          {saveLabel}
        </button>
      </div>
    </article>
  );
}

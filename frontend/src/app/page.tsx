import Link from "next/link";

const steps = [
  {
    n: "1",
    title: "Save your approved spec",
    text: "Register the exact text your label must carry — brand, net contents, allergens, and any other required fields.",
  },
  {
    n: "2",
    title: "Upload a label photo",
    text: "Snap a picture of the printed label. VeriLabel reads every line with OCR, even from phone photos.",
  },
  {
    n: "3",
    title: "Get Pass or Needs Review",
    text: "Each field is compared against the spec. You see match, missing, incorrect, or uncertain — with the reason for every field.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="flex w-full flex-col items-center px-6 py-24 text-center sm:py-32">
        <p className="rounded-full border border-zinc-200 px-4 py-1 text-xs font-medium uppercase tracking-widest text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          AI product label verification
        </p>
        <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
          VeriLabel
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          A single typo on a printed label can mean a failed inspection or a
          recall. VeriLabel checks every label against its approved spec —
          before it ships.
        </p>
        <Link
          href="/inspect"
          className="mt-10 rounded-lg bg-zinc-950 px-10 py-4 text-lg font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Get Started
        </Link>
        <div className="mt-8 flex gap-6 text-sm">
          <Link
            href="/specs"
            className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Manage specs
          </Link>
          <Link
            href="/history"
            className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            View history
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full border-t border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          How it works
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-zinc-200 p-6 text-left dark:border-zinc-800"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-lg font-bold text-white dark:bg-zinc-50 dark:text-zinc-950">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {s.text}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/inspect"
            className="rounded-lg bg-zinc-950 px-8 py-3 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Try it now
          </Link>
        </div>
      </section>
    </div>
  );
}

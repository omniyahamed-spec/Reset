"use client";

import { useMemo, useState } from "react";

const focusOptions = [
  {
    value: "clarity",
    label: "Clarity",
    feedback: (name: string) =>
      `${name}, you do not need more information. You need a clear decision.`,
  },
  {
    value: "discipline",
    label: "Discipline",
    feedback: (name: string) =>
      `${name}, the issue is not motivation. It is inconsistency.`,
  },
  {
    value: "direction",
    label: "Direction",
    feedback: (name: string) =>
      `${name}, you are split between too many things. Pick one path and move.`,
  },
  {
    value: "reset",
    label: "Reset",
    feedback: (name: string) =>
      `${name}, something has to stop first before anything new can work.`,
  },
];

function PersonalInputBlock() {
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedOption = useMemo(
    () => focusOptions.find((item) => item.value === focus),
    [focus]
  );

  const feedback = useMemo(() => {
    const safeName = name.trim() || "You";
    if (!selectedOption) return "";
    return selectedOption.feedback(safeName);
  }, [name, selectedOption]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !focus) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setName("");
    setFocus("");
    setSubmitted(false);
  };

  return (
    <section className="w-full">
      <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur-xl shadow-[0_12px_60px_rgba(0,0,0,0.35)]">
        {!submitted ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                Personal reset
              </p>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
                Two questions. One honest reflection.
              </h3>
              <p className="max-w-xl text-sm md:text-base leading-7 text-white/60">
                No long form. No overexplaining. Just enough to make the
                experience personal.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-white/80"
                >
                  Your name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/25 outline-none transition focus:border-white/30"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="focus"
                  className="block text-sm font-medium text-white/80"
                >
                  What do you need most right now?
                </label>
                <select
                  id="focus"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
                >
                  <option value="" className="text-black">
                    Select one
                  </option>
                  {focusOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="text-black"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!name.trim() || !focus}
                className="w-full rounded-2xl bg-white px-5 py-3 text-sm md:text-base font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                See your feedback
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                Your reflection
              </p>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-white leading-tight">
                {feedback}
              </h3>
              <p className="text-sm md:text-base leading-7 text-white/60">
                Do one thing today that matches the answer you already know.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                Next move
              </p>
              <p className="mt-2 text-sm md:text-base leading-7 text-white/75">
                Pick one task you have been delaying. Start with the first five
                minutes only.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleReset}
                className="rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm md:text-base font-medium text-white transition hover:bg-white/5"
              >
                Try again
              </button>

              <button className="rounded-2xl bg-white px-5 py-3 text-sm md:text-base font-medium text-black transition hover:opacity-90">
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-white/80">
        {number}
      </div>
      <h4 className="text-lg font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm leading-7 text-white/60">{text}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07080B] text-white">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(154,124,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(86,168,255,0.12),transparent_28%)]" />
        <div className="absolute left-[-10%] top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-[-10%] top-40 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />

        <section className="relative mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-10 lg:px-16">
          <div className="mb-8 flex items-center justify-between">
            <div className="text-sm uppercase tracking-[0.28em] text-white/55">
              Reset
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/50">
              Clarity • Flow • Action
            </div>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <p className="mb-4 text-xs uppercase tracking-[0.32em] text-white/40">
                Structured self-reset
              </p>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                You do not need more motivation.
                <span className="block text-white/65">
                  You need a cleaner decision.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-white/62 md:text-lg">
                Reset is a guided reflection experience for people who already
                know something needs to change but keep circling the same noise.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button className="rounded-2xl bg-white px-6 py-3.5 text-sm font-medium text-black transition hover:opacity-90">
                  Start your reset
                </button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/10">
                  See how it works
                </button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                    Interrupt
                  </p>
                  <p className="mt-2 text-sm text-white/72">
                    Break autopilot before the day runs you.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                    Reflect
                  </p>
                  <p className="mt-2 text-sm text-white/72">
                    Face the real issue without fluff.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                    Move
                  </p>
                  <p className="mt-2 text-sm text-white/72">
                    Leave with one clear next step.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[34px] border border-white/10 bg-white/5 shadow-[0_14px_70px_rgba(0,0,0,0.45)]">
                <div className="relative aspect-[4/5] w-full bg-black/30">
                  <img
                    src="/garden.jpg"
                    alt="Person sitting on a bench in a garden"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07080B] via-[#07080B]/20 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <div className="max-w-md rounded-[26px] border border-white/10 bg-black/35 p-5 backdrop-blur-md">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                        Reflection
                      </p>
                      <p className="mt-2 text-lg font-medium leading-8 text-white">
                        Clarity is rarely missing.
                        <span className="block text-white/62">
                          Most of the time, it is avoided.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -left-6 bottom-10 hidden w-52 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl lg:block">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                  Daily signal
                </p>
                <p className="mt-2 text-sm leading-6 text-white/72">
                  One honest question can change the direction of a day.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 lg:px-16">
          <div className="grid gap-5 md:grid-cols-3">
            <StepCard
              number="1"
              title="Interrupt the pattern"
              text="Stop the repetition long enough to see what is actually happening."
            />
            <StepCard
              number="2"
              title="Name the real need"
              text="Choose what you need most right now instead of spiraling through everything."
            />
            <StepCard
              number="3"
              title="Move with clarity"
              text="End with one direct next step instead of empty motivation."
            />
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-14 md:px-10 lg:px-16">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                Make it personal
              </p>
              <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-white">
                Not a long intake.
                <span className="block text-white/65">
                  Just enough to make it hit.
                </span>
              </h2>
              <p className="mt-5 text-sm md:text-base leading-8 text-white/60">
                The first interaction should feel direct, not invasive. Ask for
                the name. Ask for one need. Then reflect something honest back.
              </p>
            </div>

            <div className="max-w-3xl">
              <PersonalInputBlock />
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-6 md:px-10 lg:px-16">
          <div className="rounded-[34px] border border-white/10 bg-white/5 p-8 md:p-10 backdrop-blur-xl">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                  Final note
                </p>
                <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-white">
                  Reset is not here to comfort avoidance.
                </h2>
                <p className="mt-4 text-sm md:text-base leading-8 text-white/60">
                  It is here to help people stop circling, face the actual
                  friction, and make one cleaner move forward.
                </p>
              </div>

              <button className="rounded-2xl bg-white px-6 py-3.5 text-sm font-medium text-black transition hover:opacity-90">
                Run your first reset
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

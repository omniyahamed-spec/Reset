"use client";

import { useMemo, useState } from "react";

const focusOptions = [
  {
    value: "clarity",
    label: "Clarity",
    feedback: (name: string) =>
      `${name}, you do not need more information. You need a cleaner decision.`,
  },
  {
    value: "flow",
    label: "Flow",
    feedback: (name: string) =>
      `${name}, your issue is not lack of effort. It is friction in the way you are moving.`,
  },
  {
    value: "action",
    label: "Action",
    feedback: (name: string) =>
      `${name}, you already know enough. What is missing is a direct move.`,
  },
  {
    value: "space",
    label: "Space",
    feedback: (name: string) =>
      `${name}, you do not need to do more right now. You need enough space to hear yourself clearly.`,
  },
];

export default function ResetPage() {
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

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,#0b0b0f,#111217)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.25em] text-white/45">
              Reset
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Clarity • Flow • Action
            </h1>

            <p className="mt-4 text-lg text-white/70 md:text-xl">
              Structured self-reset
            </p>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
              You do not need more motivation. You need a cleaner decision.
            </p>

            <p className="mt-5 max-w-2xl text-base leading-8 text-white/60 md:text-lg">
              Reset is a guided reflection experience for people who already
              know something needs to change but keep circling the same noise.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#personal-reset"
                className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Start your reset
              </a>
              <a
                href="#how-it-works"
                className="rounded-2xl border border-white/12 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                See how it works
              </a>
            </div>
          </div>

          <div
            id="how-it-works"
            className="mt-20 grid gap-6 md:grid-cols-3 md:gap-8"
          >
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h3 className="text-xl font-semibold text-white">Interrupt</h3>
              <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
                Break autopilot before the day runs you.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h3 className="text-xl font-semibold text-white">Reflect</h3>
              <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
                Face the real issue without fluff.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h3 className="text-xl font-semibold text-white">Move</h3>
              <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
                Leave with one clear next step.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
            <img
              src="/garden.jpg"
              alt="Person sitting on a bench in a garden"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <p className="text-sm uppercase tracking-[0.22em] text-white/42">
              Reflection
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Clarity is rarely missing. Most of the time, it is avoided.
            </h2>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-white/40">
                Daily signal
              </p>
              <p className="mt-3 text-base leading-8 text-white/74">
                One honest question can change the direction of a day.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="text-3xl font-semibold text-white/90">1</div>
            <h3 className="mt-5 text-xl font-semibold text-white">
              Interrupt the pattern
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
              Stop the repetition long enough to see what is actually happening.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="text-3xl font-semibold text-white/90">2</div>
            <h3 className="mt-5 text-xl font-semibold text-white">
              Name the real need
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
              Choose what you need most right now instead of spiraling through
              everything.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="text-3xl font-semibold text-white/90">3</div>
            <h3 className="mt-5 text-xl font-semibold text-white">
              Move with clarity
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
              End with one direct next step instead of empty motivation.
            </p>
          </div>
        </div>
      </section>

      <section
        id="personal-reset"
        className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-18"
      >
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <p className="text-sm uppercase tracking-[0.22em] text-white/42">
              Make it personal
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Not a long intake. Just enough to make it hit.
            </h2>

            <p className="mt-5 text-base leading-8 text-white/66">
              The first interaction should feel direct, not invasive. Ask for
              the name. Ask for one need. Then reflect something honest back.
            </p>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            {!submitted ? (
              <>
                <p className="text-sm uppercase tracking-[0.22em] text-white/42">
                  Personal reset
                </p>

                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                  Two questions. One honest reflection.
                </h3>

                <p className="mt-3 text-base leading-8 text-white/62">
                  No long form. No overexplaining. Just enough to make the
                  experience personal.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-medium text-white/82"
                    >
                      Your name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-white/25 outline-none transition focus:border-white/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="focus"
                      className="mb-2 block text-sm font-medium text-white/82"
                    >
                      What do you need most right now?
                    </label>
                    <select
                      id="focus"
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/30"
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
                    className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    See your feedback
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm uppercase tracking-[0.22em] text-white/42">
                  Your reflection
                </p>

                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white leading-tight">
                  {feedback}
                </h3>

                <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm uppercase tracking-[0.18em] text-white/40">
                    Next step
                  </p>
                  <p className="mt-3 text-base leading-8 text-white/72">
                    Pick one move that reduces friction today. Not the perfect
                    move. The cleaner one.
                  </p>
                </div>

                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-6 rounded-2xl border border-white/12 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  Edit answers
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14 text-center md:px-10 md:py-20">
        <p className="text-sm uppercase tracking-[0.22em] text-white/42">
          Final note
        </p>

        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Reset is not here to comfort avoidance.
        </h2>

        <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-white/62 md:text-lg">
          It is here to help people stop circling, face the actual friction, and
          make one cleaner move forward.
        </p>

        <a
          href="#personal-reset"
          className="mt-10 inline-flex rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
        >
          Run your first reset
        </a>
      </section>
    </main>
  );
}

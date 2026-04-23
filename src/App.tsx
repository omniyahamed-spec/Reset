"use client";

import { useMemo, useState } from "react";

const needOptions = [
  {
    value: "clarity",
    label: "Clarity",
  },
  {
    value: "flow",
    label: "Flow",
  },
  {
    value: "action",
    label: "Action",
  },
  {
    value: "space",
    label: "Space",
  },
];

const blockerOptions = [
  {
    value: "overthinking",
    label: "Overthinking",
  },
  {
    value: "avoidance",
    label: "Avoidance",
  },
  {
    value: "fear",
    label: "Fear",
  },
  {
    value: "overload",
    label: "Overload",
  },
];

function getReflection(name: string, need: string, blocker: string) {
  const safeName = name.trim() || "You";

  const reflections: Record<string, Record<string, string>> = {
    clarity: {
      overthinking: `${safeName}, you do not need more input. You need to stop looping and choose.`,
      avoidance: `${safeName}, clarity is not missing. You are delaying the truth you already see.`,
      fear: `${safeName}, the decision is not unclear. The risk of acting is what feels heavy.`,
      overload: `${safeName}, you are trying to solve too much at once. Clarity needs one thing, not everything.`,
    },
    flow: {
      overthinking: `${safeName}, flow is breaking because you keep interrupting yourself with too much analysis.`,
      avoidance: `${safeName}, your rhythm is not broken by lack of ability. It is broken by resistance.`,
      fear: `${safeName}, you are holding back your own movement because starting feels too exposed.`,
      overload: `${safeName}, flow will not return by pushing harder. It returns when the friction is reduced.`,
    },
    action: {
      overthinking: `${safeName}, action is not blocked by strategy. It is blocked by hesitation.`,
      avoidance: `${safeName}, you already know the move. You just keep stepping around it.`,
      fear: `${safeName}, the next step is clear enough. What is stopping you is the cost of being seen trying.`,
      overload: `${safeName}, action will not come from pressure. It will come from making the next move smaller.`,
    },
    space: {
      overthinking: `${safeName}, your mind is crowded. Space is not a reward. It is the requirement.`,
      avoidance: `${safeName}, you keep filling the day so you do not have to hear what is actually there.`,
      fear: `${safeName}, creating space feels dangerous because silence makes the real issue harder to ignore.`,
      overload: `${safeName}, you do not need more discipline right now. You need room to think clearly again.`,
    },
  };

  return (
    reflections[need]?.[blocker] ||
    `${safeName}, something needs to become simpler before you can move cleanly.`
  );
}

function getNextStep(need: string, blocker: string) {
  const steps: Record<string, Record<string, string>> = {
    clarity: {
      overthinking: "Write down the two real options and choose one before the day ends.",
      avoidance: "Name the decision you have been postponing in one sentence.",
      fear: "Decide what you would choose if fear was not allowed to vote first.",
      overload: "Cut the problem down to the one decision that matters most today.",
    },
    flow: {
      overthinking: "Remove one unnecessary step from the task you keep stalling on.",
      avoidance: "Start the task before you feel ready and stay with it for five minutes.",
      fear: "Do the first visible part, not the perfect part.",
      overload: "Choose one task only and protect 15 minutes for it.",
    },
    action: {
      overthinking: "Do the first small move now, before you evaluate it again.",
      avoidance: "Touch the task you have been circling today, even briefly.",
      fear: "Take the move that creates evidence, not comfort.",
      overload: "Shrink the next step until it feels almost too easy to avoid.",
    },
    space: {
      overthinking: "Take ten quiet minutes with no input and write what is actually bothering you.",
      avoidance: "Stop one numbing habit for the next hour and sit with what comes up.",
      fear: "Give yourself one uninterrupted pause without trying to earn it.",
      overload: "Cancel, delay, or drop one thing that is making your thinking noisy.",
    },
  };

  return (
    steps[need]?.[blocker] ||
    "Choose one cleaner move and do it before you ask yourself how you feel about it."
  );
}

export default function ResetPage() {
  const [name, setName] = useState("");
  const [need, setNeed] = useState("");
  const [blocker, setBlocker] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reflection = useMemo(
    () => getReflection(name, need, blocker),
    [name, need, blocker]
  );

  const nextStep = useMemo(
    () => getNextStep(need, blocker),
    [need, blocker]
  );

  const canSubmit = name.trim() && need && blocker;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitted(true);
  }

  function handleReset() {
    setSubmitted(false);
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,#0b0b0f,#101117)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
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
                Reset is a guided reflection tool that helps you stop spiraling,
                name what you really need, and leave with one clear next move.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#personal-reset"
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Get one clear next step
                </a>
                <a
                  href="#how-it-works"
                  className="rounded-2xl border border-white/12 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  See how it works
                </a>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-[0_12px_50px_rgba(0,0,0,0.25)]">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                Live preview
              </p>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Sample reflection</p>
                <p className="mt-3 text-xl leading-8 text-white">
                  Omnia, clarity is not missing. You are delaying the truth you
                  already see.
                </p>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Next step</p>
                <p className="mt-3 text-base leading-7 text-white/75">
                  Name the decision you have been postponing in one sentence.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  2 prompts
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  1 reflection
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  1 next move
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="personal-reset"
        className="mx-auto max-w-6xl px-6 py-6 md:px-10 md:py-10"
      >
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <p className="text-sm uppercase tracking-[0.22em] text-white/42">
              Make it personal
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Not a long intake. Just enough to make it hit.
            </h2>

            <p className="mt-5 text-base leading-8 text-white/66">
              The first interaction should feel direct, not invasive. Ask for
              the name. Ask for one need. Ask what is in the way. Then reflect
              something honest back.
            </p>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-[0_12px_50px_rgba(0,0,0,0.25)]">
            {!submitted ? (
              <>
                <p className="text-sm uppercase tracking-[0.22em] text-white/42">
                  Personal reset
                </p>

                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                  Three quick inputs. One honest reflection.
                </h3>

                <p className="mt-3 text-base leading-8 text-white/62">
                  Enough to make the experience feel personal. Not enough to make
                  it heavy.
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
                      htmlFor="need"
                      className="mb-2 block text-sm font-medium text-white/82"
                    >
                      What do you need most right now?
                    </label>
                    <select
                      id="need"
                      value={need}
                      onChange={(e) => setNeed(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/30"
                    >
                      <option value="" className="text-black">
                        Select one
                      </option>
                      {needOptions.map((option) => (
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

                  <div>
                    <label
                      htmlFor="blocker"
                      className="mb-2 block text-sm font-medium text-white/82"
                    >
                      What is most in the way?
                    </label>
                    <select
                      id="blocker"
                      value={blocker}
                      onChange={(e) => setBlocker(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/30"
                    >
                      <option value="" className="text-black">
                        Select one
                      </option>
                      {blockerOptions.map((option) => (
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
                    disabled={!canSubmit}
                    className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    See your reflection
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm uppercase tracking-[0.22em] text-white/42">
                  Your reflection
                </p>

                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white leading-tight">
                  {reflection}
                </h3>

                <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm uppercase tracking-[0.18em] text-white/40">
                    Next move
                  </p>
                  <p className="mt-3 text-base leading-8 text-white/72">
                    {nextStep}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleReset}
                    className="rounded-2xl border border-white/12 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    Edit answers
                  </button>

                  <a
                    href="#how-it-works"
                    className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
                  >
                    See how Reset works
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
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

      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-16"
      >
        <div className="mb-8 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.22em] text-white/42">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Stop circling. Name the friction. Move cleaner.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="text-3xl font-semibold text-white/90">1</div>
            <h3 className="mt-5 text-xl font-semibold text-white">
              Interrupt the pattern
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
              Break autopilot before the day runs you.
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
              Leave with one direct next step instead of empty motivation.
            </p>
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

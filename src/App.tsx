import { useEffect, useMemo, useState } from "react";

type Screen = "start" | "commit";

interface Entry {
  id: number;
  mind: string;
  avoiding: string;
  move: string;
  status: "done" | "not_yet";
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [mind, setMind] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);

  // 🔥 NEW: last unfinished task
  const lastNotYet = useMemo(
    () => entries.find((e) => e.status === "not_yet"),
    [entries]
  );

  function save(status: "done" | "not_yet") {
    const newEntry: Entry = {
      id: Date.now(),
      mind,
      avoiding,
      move,
      status,
    };

    setEntries([newEntry, ...entries]);
    setScreen("start");
  }

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      {screen === "start" && (
        <>
          <h1>You don’t stay stuck.</h1>

          {/* 🔥 NEW BLOCK */}
          {lastNotYet && (
            <div
              style={{
                background: "#fff",
                padding: 16,
                borderRadius: 10,
                marginBottom: 20,
                border: "1px solid #ddd",
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                You didn’t finish this:
              </div>

              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {lastNotYet.move}
              </div>

              <button
                onClick={() => {
                  setMind(lastNotYet.mind);
                  setAvoiding(lastNotYet.avoiding);
                  setMove(lastNotYet.move);
                  setScreen("commit");
                }}
              >
                Resume
              </button>
            </div>
          )}

          <button onClick={() => setScreen("commit")}>
            Start Reset
          </button>
        </>
      )}

      {screen === "commit" && (
        <>
          <h2>What’s on your mind?</h2>
          <input value={mind} onChange={(e) => setMind(e.target.value)} />

          <h2>What are you avoiding?</h2>
          <input value={avoiding} onChange={(e) => setAvoiding(e.target.value)} />

          <h2>What’s the next move?</h2>
          <input value={move} onChange={(e) => setMove(e.target.value)} />

          <br /><br />

          <button onClick={() => save("done")}>I did it</button>
          <button onClick={() => save("not_yet")}>Not yet</button>
        </>
      )}
    </div>
  );
}

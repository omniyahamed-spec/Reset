import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./styles.css";

type ResetEntry = {
  id?: string;
  name: string;
  bothering: string;
  avoiding: string;
  next_move: string;
  created_at?: string;
};

export default function App() {
  const [name, setName] = useState("");
  const [bothering, setBothering] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [nextMove, setNextMove] = useState("");
  const [entries, setEntries] = useState<ResetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    const { data, error } = await supabase
      .from("resets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage("Could not load past records.");
      return;
    }

    setEntries(data || []);
  }

  async function saveReset(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Add your name first.");
      return;
    }

    if (!bothering.trim() || !avoiding.trim() || !nextMove.trim()) {
      setMessage("Fill all reset fields.");
      return;
    }

    setLoading(true);

    const newEntry = {
      name: name.trim(),
      bothering: bothering.trim(),
      avoiding: avoiding.trim(),
      next_move: nextMove.trim(),
    };

    const { error } = await supabase.from("resets").insert([newEntry]);

    setLoading(false);

    if (error) {
      console.error(error);
      setMessage("Could not save. Check Supabase table/RLS.");
      return;
    }

    setBothering("");
    setAvoiding("");
    setNextMove("");
    setMessage("Saved.");

    fetchEntries();
  }

  return (
    <main className="app">
      <section className="hero">
        <h1>Reset</h1>
        <p>Clarity • Flow • Action</p>
        <p className="sub">
          You do not need more motivation. You need a cleaner decision.
        </p>
      </section>

      <section className="card">
        <form onSubmit={saveReset}>
          <label>
            Your name
            <input
              type="text"
              placeholder="Write your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label>
            What is actually bothering me?
            <textarea
              placeholder="Be honest. Not dramatic."
              value={bothering}
              onChange={(e) => setBothering(e.target.value)}
            />
          </label>

          <label>
            What am I avoiding?
            <textarea
              placeholder="The thing you keep dancing around."
              value={avoiding}
              onChange={(e) => setAvoiding(e.target.value)}
            />
          </label>

          <label>
            Smallest next move — 2 minutes only
            <textarea
              placeholder="One tiny action. Not a life plan."
              value={nextMove}
              onChange={(e) => setNextMove(e.target.value)}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Reset"}
          </button>

          {message && <p className="message">{message}</p>}
        </form>
      </section>

      <section className="past">
        <h2>Past Resets</h2>

        {entries.length === 0 ? (
          <p>No records yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>What bothered me</th>
                  <th>What I avoided</th>
                  <th>My move</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id || entry.created_at}>
                    <td>
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{entry.name}</td>
                    <td>{entry.bothering}</td>
                    <td>{entry.avoiding}</td>
                    <td>{entry.next_move}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

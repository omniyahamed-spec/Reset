import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type User = {
  id: string;
  email?: string;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // SESSION CHECK (FIXED)
  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error(error.message);
          setUser(null);
        } else {
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        console.error("Session error:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // AUTH
  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) alert(error.message);
    else alert("Check your email to confirm signup");
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // LOADING SCREEN
  if (loading) {
    return (
      <div style={styles.center}>
        <p>Loading. Checking your session.</p>
      </div>
    );
  }

  // AUTH SCREEN
  if (!user) {
    return (
      <div style={styles.center}>
        <h2>Login / Signup</h2>

        <input
          style={styles.input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={{ marginTop: 10 }}>
          <button onClick={handleLogin} style={styles.button}>
            Login
          </button>
          <button onClick={handleSignUp} style={styles.button}>
            Sign Up
          </button>
        </div>
      </div>
    );
  }

  // APP SCREEN
  return (
    <div style={styles.center}>
      <h2>Welcome</h2>
      <p>{user.email}</p>

      <button onClick={handleLogout} style={styles.button}>
        Logout
      </button>
    </div>
  );
}

// BASIC STYLES
const styles: { [key: string]: React.CSSProperties } = {
  center: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    padding: 10,
    margin: 5,
    width: 250,
  },
  button: {
    padding: "10px 20px",
    margin: 5,
    cursor: "pointer",
  },
};

"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getAuthClient, useApp } from "./context";
import { UserRound, LogOut, Mail, ShieldCheck } from "lucide-react";
export function Account() {
  const { user, t } = useApp();
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [history, setHistory] = useState<any[]>([]);
  const key = "paperly-history-" + (user?.uid || "guest");
  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {}
    setName(user?.displayName || "");
  }, [key, user]);
  async function action(kind: string) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const auth = await getAuthClient();
      const f = await import("firebase/auth");
      if (kind === "google") {
        await f.signInWithPopup(auth, new f.GoogleAuthProvider());
      } else if (kind === "logout") {
        await f.signOut(auth);
        setPassword("");
      } else if (kind === "verify" && user) {
        await f.sendEmailVerification(user);
        setMessage("Verification email sent. Check your inbox.");
      } else if (kind === "refresh" && user) {
        await user.reload();
        setMessage(
          user.emailVerified ? "Email verified." : "Email is not verified yet.",
        );
      } else if (kind === "profile" && user) {
        await f.updateProfile(user, { displayName: name });
        setMessage("Profile updated.");
      } else if (kind === "reset") {
        await f.sendPasswordResetEmail(auth, user?.email || email);
        setMessage(
          "If this address has an account, a password-reset email will arrive.",
        );
      } else if (mode === "signup") {
        const credential = await f.createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        if (name) await f.updateProfile(credential.user, { displayName: name });
        setPassword("");
        setMessage(
          "Account created. Use Verify email to confirm your address.",
        );
      } else {
        await f.signInWithEmailAndPassword(auth, email, password);
        setPassword("");
      }
    } catch (e: any) {
      const code = e.code || "";
      setError(
        (
          {
            "auth/invalid-credential": "Email or password is incorrect.",
            "auth/email-already-in-use":
              "This email already has an account. Sign in or reset your password.",
            "auth/weak-password": "Choose a stronger password.",
            "auth/invalid-email": "Enter a valid email address.",
            "auth/too-many-requests":
              "Too many attempts. Wait a few minutes and try again.",
            "auth/unauthorized-domain":
              "Google sign-in is not authorized for this website yet. Use email/password sign-in.",
            "auth/popup-closed-by-user": "Sign-in was cancelled.",
            "auth/operation-not-allowed":
              "This sign-in provider has not been enabled.",
          } as Record<string, string>
        )[code] ||
          "The request could not be completed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-page">
      <span className="eyebrow">YOUR PARPERLY WORKSPACE</span>
      <h1>
        {user
          ? "Welcome back" +
            (user.displayName ? ", " + user.displayName : "") +
            "."
          : mode === "signup"
            ? "Create your account."
            : "A little more organized."}
      </h1>
      <div className="account-grid">
        <section className="account-card">
          {user ? (
            <>
              <UserRound size={32} />
              <h2>{t.account}</h2>
              <p>{user.email}</p>
              <p className="badge green">
                Firebase account ·{" "}
                {user.emailVerified ? "Verified" : "Email verification pending"}
              </p>
              <label className="field">
                Display name
                <input
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button
                className="btn"
                disabled={busy}
                onClick={() => action("profile")}
              >
                Save profile
              </button>
              {!user.emailVerified && (
                <div className="flex wrap">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => action("verify")}
                  >
                    <Mail size={15} />
                    Verify email
                  </button>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => action("refresh")}
                  >
                    Refresh verification
                  </button>
                </div>
              )}
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => action("reset")}
              >
                Send password-reset email
              </button>
              <button
                className="btn full"
                disabled={busy}
                onClick={() => action("logout")}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="tabs">
                <button
                  className={mode === "login" ? "active" : ""}
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Sign in
                </button>
                <button
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                >
                  Create account
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action("submit");
                }}
              >
                {mode === "signup" && (
                  <label className="field">
                    Your name
                    <input
                      autoComplete="name"
                      maxLength={80}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                )}
                <label className="field">
                  Email
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  Password
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="btn primary full" disabled={busy}>
                  {busy
                    ? "Connecting…"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
                </button>
              </form>
              <button
                className="btn full"
                disabled={busy}
                onClick={() => action("google")}
              >
                Continue with Google
              </button>
              <button
                className="text-btn"
                disabled={busy || !email}
                onClick={() => action("reset")}
              >
                Forgot password? Send reset email
              </button>
              <p className="hint">
                Accounts are handled by Firebase. PDF files are not uploaded.{" "}
                <Link href="/privacy/">Read the privacy details.</Link>
              </p>
            </>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </section>
        <section className="account-card">
          <h2>{t.history}</h2>
          <p className="hint">
            Metadata saved on this browser only, under your current account. No
            PDF content or filenames are retained. Cloud history and
            subscriptions are not enabled.
          </p>
          {history.length ? (
            history.map((h) => (
              <div className="history-row" key={h.id}>
                <b>{h.tool}</b>
                <span>{new Date(h.at).toLocaleString()}</span>
                <small>
                  {h.files} output files · {h.pages} PDF pages
                </small>
              </div>
            ))
          ) : (
            <p className="empty">{t.noHistory}</p>
          )}
          <button
            className="btn"
            disabled={!history.length}
            onClick={() => {
              localStorage.removeItem(key);
              setHistory([]);
            }}
          >
            {t.clear}
          </button>
          <h3>Saved workflows</h3>
          <p>
            Reusable presets are stored on this device, separately for each
            signed-in account.
          </p>
          <Link className="btn" href="/workflows/">
            Open workflow builder
          </Link>
        </section>
      </div>
    </section>
  );
}

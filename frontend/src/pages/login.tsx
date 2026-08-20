import Head from "next/head";
import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import SiteFooter from "@/components/SiteFooter";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await apiFetch(`/auth/${registering ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registering ? { name, email, password } : { email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to continue");
        return;
      }

      if (!data.user) {
        setError("Login succeeded, but no account information was returned.");
        return;
      }

      // The authentication API owns the secure session cookie. Persist only
      // non-sensitive display data for this browser tab.
      sessionStorage.setItem("dhanova:user", JSON.stringify(data.user));
      setPassword("");
      await router.replace(data.user.role === "admin" ? "/admin" : "/account?section=profile");
    } catch (submitError) {
      console.error("Unable to authenticate", submitError);
      setError("Backend unavailable. Start the API server on port 4000.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>{registering ? "Create account" : "Login"} | Dhanova</title></Head>
      <main className="centered-page">
        <section className="form-card">
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>{registering ? "Create account" : "Welcome back"}</h1>
          <form method="post" onSubmit={submit}>
            {registering && <label>Name<input name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} /></label>}
            <label>Email<input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Password<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? "new-password" : "current-password"} required minLength={8} /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" disabled={submitting}>{submitting ? "Please wait…" : registering ? "Register" : "Login"}</button>
          </form>
          <button className="text-button" type="button" disabled={submitting} onClick={() => { setRegistering(!registering); setError(""); setPassword(""); }}>
            {registering ? "Already registered? Log in" : "New customer? Create an account"}
          </button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

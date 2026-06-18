"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import CustomAlert from "../components/CustomAlert";

export default function ForgotPassword() {
  const router = useRouter();
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // Step: 1 = Request code, 2 = Verify code & set new password
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  // Alerts
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error" | "warning">("error");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAlertType("warning");
      setAlertMessage("Email is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("If the email is registered, we've sent a password reset verification code.");
        setStep(2);
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Failed to request reset. Please try again.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("A network error occurred. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMessage("");

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setAlertType("warning");
      setAlertMessage("Verification code is required.");
      return;
    }

    if (newPassword.length < 8) {
      setAlertType("warning");
      setAlertMessage("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: trimmedCode,
          new_password: newPassword,
        }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Password reset successfully! Redirecting you to login...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Verification code is invalid or expired.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("A network error occurred. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4 relative">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Reset password
          </h2>
          <p className="text-xs text-zinc-400">
            {step === 1
              ? "Confirm email to receive a recovery code"
              : `Enter the code sent to ${email}`}
          </p>
        </div>

        {alertMessage && (
          <div className="mb-6">
            <CustomAlert
              message={alertMessage}
              type={alertType}
              onClose={() => setAlertMessage("")}
              autoCloseDuration={alertType === "success" ? 0 : 6000}
            />
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestReset} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-400 tracking-wider uppercase mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-950/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-50 text-sm"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Requesting Code...
                </>
              ) : (
                "Send Verification Code"
              )}
            </button>

            <div className="text-center pt-2">
              <Link href="/login" className="text-xs text-zinc-400 hover:text-white transition-colors">
                ← Back to Login
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyReset} className="space-y-6">
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 text-center">
              <span className="block text-xs text-indigo-300 mb-1">Outbox Simulator Notice</span>
              <p className="text-[10px] text-zinc-400 leading-normal">
                Check the Go <code className="text-indigo-300 font-mono">auth-service</code> console log for the 6-digit password reset verification code.
              </p>
            </div>

            <div>
              <label htmlFor="code" className="block text-xs font-semibold text-zinc-400 tracking-wider uppercase mb-2">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                required
                maxLength={6}
                disabled={loading}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full text-center tracking-widest px-4 py-3 rounded-xl bg-zinc-950/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-50 text-xl font-bold font-mono"
                placeholder="000000"
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-zinc-400 tracking-wider uppercase mb-2">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                disabled={loading}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-950/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-50 text-sm"
                placeholder="••••••••"
              />
              <span className="block text-[10px] text-zinc-500 mt-2">
                Must be at least 8 characters.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep(1)}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

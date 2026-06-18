"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import CustomAlert from "../components/CustomAlert";

export default function Login() {
  const router = useRouter();
  const { user, refreshStatus } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  
  // Step: 1 = Credentials, 2 = Select MFA Method, 3 = Verify MFA Code
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  
  // MFA session data
  const [tempToken, setTempToken] = useState("");
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<"totp" | "email" | "">("");

  // Alerts
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error" | "warning">("error");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAlertType("warning");
      setAlertMessage("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.mfa_required) {
          // Setup MFA verification step
          setTempToken(data.temp_token);
          setMfaMethods(data.methods);
          
          if (data.methods.length === 1) {
            // Only one method enabled, select it and go directly to verification screen
            const method = data.methods[0] as "totp" | "email";
            setSelectedMethod(method);
            setStep(3);
          } else {
            // Multiple methods, show choice
            setStep(2);
          }
        } else {
          // Success: No MFA required
          setAlertType("success");
          setAlertMessage("Login successful! Redirecting...");
          const updatedUser = await refreshStatus();
          if (updatedUser) {
            setTimeout(() => {
              router.push("/dashboard");
            }, 1500);
          }
        }
      } else {
        const errText = await res.text();
        if (res.status === 403) {
          try {
            const data = JSON.parse(errText);
            if (data.verification_required) {
              setAlertType("warning");
              setAlertMessage(data.error || "Account not verified. A verification code has been sent. Redirecting...");
              setTimeout(() => {
                router.push(`/register?email=${encodeURIComponent(data.email)}`);
              }, 3000);
              return;
            }
          } catch (e) {
            // Not JSON, display as normal text error
          }
        }
        setAlertType("error");
        setAlertMessage(errText || "Invalid email or password.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("A network error occurred. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMFA = async (method: "totp" | "email") => {
    setAlertMessage("");
    setSelectedMethod(method);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login/select-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: tempToken, method }),
      });

      if (res.ok) {
        setStep(3);
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Failed to select MFA method.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("A network error occurred. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMessage("");

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setAlertType("warning");
      setAlertMessage("Verification code is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp_token: tempToken,
          method: selectedMethod,
          code: trimmedCode,
        }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Verification successful! Redirecting...");
        const updatedUser = await refreshStatus();
        if (updatedUser) {
          setTimeout(() => {
            router.push("/dashboard");
          }, 1500);
        }
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Invalid MFA verification code.");
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
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            {step === 1 && "Welcome back"}
            {step === 2 && "Select MFA Method"}
            {step === 3 && (selectedMethod === "totp" ? "Authenticator Verification" : "Email Verification")}
          </h2>
          <p className="text-xs text-zinc-400">
            {step === 1 && "Access your shared billing account"}
            {step === 2 && "Choose an enabled security check to continue"}
            {step === 3 && (selectedMethod === "totp" ? "Enter the code from your authenticator app" : "Enter the code sent to your email")}
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

        {step === 1 && (
          <form onSubmit={handleLogin} className="space-y-6">
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

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-950/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-50 text-sm"
                placeholder="••••••••"
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
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-zinc-500">
                Don't have an account?{" "}
                <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                  Sign up
                </Link>
              </span>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-400 text-center mb-4 leading-normal">
              This account requires secondary confirmation. Select one of the configured channels:
            </p>
            {mfaMethods.includes("totp") && (
              <button
                onClick={() => handleSelectMFA("totp")}
                disabled={loading}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 hover:border-indigo-400 hover:bg-indigo-950/40 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">Authenticator Code</h4>
                  <p className="text-[10px] text-zinc-400">Validate via standard TOTP generators (Google Authenticator, etc.)</p>
                </div>
                <span className="text-lg">📱</span>
              </button>
            )}

            {mfaMethods.includes("email") && (
              <button
                onClick={() => handleSelectMFA("email")}
                disabled={loading}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-pink-950/20 border border-pink-500/10 hover:border-pink-400 hover:bg-pink-950/40 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">Email Challenge</h4>
                  <p className="text-[10px] text-zinc-400">Receive a 6-digit confirmation code in your inbox</p>
                </div>
                <span className="text-lg">📧</span>
              </button>
            )}

            <button
              onClick={() => setStep(1)}
              disabled={loading}
              className="w-full text-center py-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Cancel & Back to Login
            </button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleVerifyMFA} className="space-y-6">
            {selectedMethod === "email" && (
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 text-center">
                <span className="block text-xs text-indigo-300 mb-1">Outbox Simulator Notice</span>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Check the Go <code className="text-indigo-300 font-mono">auth-service</code> console log for the 6-digit login verification code.
                </p>
              </div>
            )}

            {selectedMethod === "totp" && (
              <div className="p-4 rounded-xl bg-pink-950/20 border border-pink-500/10 text-center">
                <span className="block text-xs text-pink-300 mb-1">Security Vault</span>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Enter the current 6-digit rotating token generated by your authenticator app.
                </p>
              </div>
            )}

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
                  Confirming...
                </>
              ) : (
                "Verify Code"
              )}
            </button>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep(mfaMethods.length > 1 ? 2 : 1)}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Back
              </button>
              {selectedMethod === "email" && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSelectMFA("email")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
                >
                  Resend Code
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import CustomAlert from "../components/CustomAlert";
import QRCode from "qrcode";

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, refreshStatus } = useAuth();

  // Settings states
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  // Convert totpUri to visual QR code data URL
  useEffect(() => {
    if (totpUri) {
      QRCode.toDataURL(totpUri, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => {
          // Fallback on error - do not disrupt main thread
          setQrCodeDataUrl("");
        });
    } else {
      setQrCodeDataUrl("");
    }
  }, [totpUri]);


  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [emailCode, setEmailCode] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  // Alerts
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error" | "warning">("error");

  // Redirect to login if unauthorized
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm text-zinc-500 font-medium tracking-wide">Validating session...</span>
      </div>
    );
  }

  if (!user) return null; // Let useEffect redirect

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setAlertType("success");
    setAlertMessage(`${label} copied to clipboard!`);
  };

  // --- TOTP MFA HANDLERS ---
  const handleInitiateTotp = async () => {
    setAlertMessage("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/totp/setup", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setTotpSecret(data.secret);
        setTotpUri(data.otpauth_url);
        setShowTotpSetup(true);
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Failed to initiate Authenticator setup.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMessage("");

    const code = totpCode.trim();
    if (!code) {
      setAlertType("warning");
      setAlertMessage("Verification code is required.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Authenticator MFA has been successfully enabled!");
        setShowTotpSetup(false);
        setTotpCode("");
        await refreshStatus();
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Invalid code. Verification failed.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("Network error. Please check your connection.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!confirm("Are you sure you want to disable Authenticator MFA?")) return;
    setAlertMessage("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/v1/auth/mfa/totp/disable", {
        method: "POST",
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Authenticator MFA has been disabled.");
        await refreshStatus();
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Failed to disable Authenticator.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("Network error. Please check your connection.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- EMAIL MFA HANDLERS ---
  const handleInitiateEmailMfa = async () => {
    setAlertMessage("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/email/setup", {
        method: "POST",
      });
      if (res.ok) {
        setShowEmailSetup(true);
        setAlertType("success");
        setAlertMessage("A setup confirmation code was sent to your email.");
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Failed to trigger Email MFA setup.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableEmailMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMessage("");

    const code = emailCode.trim();
    if (!code) {
      setAlertType("warning");
      setAlertMessage("Verification code is required.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/email/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Email MFA has been successfully enabled!");
        setShowEmailSetup(false);
        setEmailCode("");
        await refreshStatus();
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Invalid code. Verification failed.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("Network error. Please check your connection.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableEmailMfa = async () => {
    if (!confirm("Are you sure you want to disable Email MFA?")) return;
    setAlertMessage("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/v1/auth/mfa/email/disable", {
        method: "POST",
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Email MFA has been disabled.");
        await refreshStatus();
      } else {
        const errMsg = await res.text();
        setAlertType("error");
        setAlertMessage(errMsg || "Failed to disable Email MFA.");
      }
    } catch (err) {
      setAlertType("error");
      setAlertMessage("Network error. Please check your connection.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Welcome Banner */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Account Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage credentials and verify account security parameters.</p>
      </div>

      {alertMessage && (
        <div className="mb-8">
          <CustomAlert
            message={alertMessage}
            type={alertType}
            onClose={() => setAlertMessage("")}
            autoCloseDuration={alertType === "success" ? 5000 : 0}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Details */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 h-fit space-y-6">
          <h3 className="text-sm font-bold text-white tracking-wide uppercase border-b border-white/5 pb-3">User Profile</h3>
          
          <div className="space-y-4">
            <div>
              <span className="block text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1">User Identifier</span>
              <span className="text-xs text-zinc-300 font-mono select-all bg-zinc-950/40 px-2.5 py-1.5 rounded-lg block border border-white/5 truncate">
                {user.userId}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1">Email Address</span>
              <span className="text-xs text-zinc-300 font-medium truncate block">
                {user.email}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1">Authorization Role</span>
              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 capitalize">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="md:col-span-2 space-y-6">
          {/* TOTP Settings Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Authenticator Multi-Factor (TOTP)</h3>
                <p className="text-xs text-zinc-400 mt-1">Use a temporary rotative PIN code app (Google Authenticator) for sign-in verification.</p>
              </div>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${user.totpEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"}`}>
                {user.totpEnabled ? "Active" : "Inactive"}
              </span>
            </div>

            {user.totpEnabled ? (
              <button
                onClick={handleDisableTotp}
                disabled={actionLoading}
                className="px-4 py-2.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/20 hover:bg-rose-600 rounded-xl border border-rose-500/20 hover:border-transparent transition-all cursor-pointer disabled:opacity-50"
              >
                Disable Authenticator MFA
              </button>
            ) : (
              <>
                {!showTotpSetup ? (
                  <button
                    onClick={handleInitiateTotp}
                    disabled={actionLoading}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    Set Up Authenticator
                  </button>
                ) : (
                  <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Configure Authenticator Application</h4>
                    
                    <div className="space-y-4">
                      <p className="text-xs text-zinc-400 leading-normal">
                        1. Scan this QR code with your authenticator application (e.g. Google Authenticator, Microsoft Authenticator):
                      </p>
                      
                      <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/95 border border-white/10 max-w-[200px] mx-auto shadow-md">
                        {qrCodeDataUrl ? (
                          <img
                            src={qrCodeDataUrl}
                            alt="Authenticator QR Code"
                            className="w-40 h-40 rounded-lg select-none pointer-events-none"
                          />
                        ) : (
                          <div className="w-40 h-40 flex items-center justify-center text-zinc-700 bg-zinc-100 rounded-lg animate-pulse font-medium text-xs">
                            Generating QR...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs text-zinc-400 leading-normal">
                        2. Or configure manually by entering this secret key in your application:
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-white px-3 py-2 rounded-lg select-all">
                          {totpSecret}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(totpSecret, "Secret key")}
                          className="px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 hover:border-zinc-650 transition-colors cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleEnableTotp} className="space-y-3 border-t border-white/5 pt-4">
                      <label htmlFor="totp-code" className="block text-xs font-semibold text-zinc-400">
                        3. Enter the 6-digit verification code from your App:
                      </label>
                      <div className="flex gap-3">
                        <input
                          id="totp-code"
                          type="text"
                          required
                          maxLength={6}
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                          className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm font-semibold tracking-wider"
                          placeholder="000000"
                        />
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                          Verify & Enable
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTotpSetup(false)}
                          className="px-4 py-2 text-xs font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Email MFA Settings Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Email Multi-Factor Challenge</h3>
                <p className="text-xs text-zinc-400 mt-1">Receive a confirmation code in your registered email when checking your login credentials.</p>
              </div>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${user.emailMfaEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"}`}>
                {user.emailMfaEnabled ? "Active" : "Inactive"}
              </span>
            </div>

            {user.emailMfaEnabled ? (
              <button
                onClick={handleDisableEmailMfa}
                disabled={actionLoading}
                className="px-4 py-2.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/20 hover:bg-rose-600 rounded-xl border border-rose-500/20 hover:border-transparent transition-all cursor-pointer disabled:opacity-50"
              >
                Disable Email MFA
              </button>
            ) : (
              <>
                {!showEmailSetup ? (
                  <button
                    onClick={handleInitiateEmailMfa}
                    disabled={actionLoading}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    Set Up Email MFA
                  </button>
                ) : (
                  <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
                    <h4 className="text-xs font-bold text-pink-300 uppercase tracking-wide">Configure Email MFA</h4>
                    
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 leading-normal">
                      <span className="block text-xs text-indigo-300 mb-1 font-semibold">Outbox Simulator Notice</span>
                      Check the Go <code className="text-indigo-300 font-mono">auth-service</code> console log for the 6-digit setup code.
                    </div>

                    <form onSubmit={handleEnableEmailMfa} className="space-y-3">
                      <label htmlFor="email-code" className="block text-xs font-semibold text-zinc-400">
                        Enter the 6-digit setup verification code:
                      </label>
                      <div className="flex gap-3">
                        <input
                          id="email-code"
                          type="text"
                          required
                          maxLength={6}
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                          className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm font-semibold tracking-wider"
                          placeholder="000000"
                        />
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                          Verify & Enable
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEmailSetup(false)}
                          className="px-4 py-2 text-xs font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

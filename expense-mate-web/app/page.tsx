"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "./context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen py-16 overflow-hidden">
      {/* Background ambient glowing blobs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none animate-glow"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-pink-500/10 blur-3xl pointer-events-none animate-glow" style={{ animationDelay: "-3s" }}></div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mt-12 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-950/30 text-indigo-300 text-xs font-semibold mb-6 animate-pulse">
            <span>✨</span> Security-First Expense Sharing
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Split bills, share lives, <br />
            <span className="text-gradient">stay friends.</span>
          </h1>
          
          <p className="text-lg text-zinc-400 mb-10 leading-relaxed">
            ExpenseMate makes tracking, splitting, and settling shared expenses with flatmates, travel buddies, or colleagues simpler, faster, and highly secure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link
                href="/dashboard"
                className="px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 hover:scale-105 active:scale-95 transition-all text-center"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 hover:scale-105 active:scale-95 transition-all text-center"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-4 text-base font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:scale-105 active:scale-95 transition-all text-center"
                >
                  Log In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-24">
          <div className="glass-panel glass-panel-hover p-8 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Smart Splitting</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Add bills on the go. Split equally, by percentages, share weights, or specify exact itemised costs down to the penny.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover p-8 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Balance Minimization</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Automatically calculates the most efficient debt paths between group members to reduce the overall number of transactions.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover p-8 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">MFA Protected Profile</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Protect your personal profile and billing logs with industrial-grade TOTP (Google Authenticator) or email verification locks.
            </p>
          </div>
        </div>

        {/* Visual Mockup Section */}
        <div className="w-full glass-panel rounded-3xl p-6 sm:p-10 border border-white/5 shadow-2xl mb-24 max-w-5xl">
          <div className="flex items-center gap-2 pb-6 border-b border-white/5 mb-8">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500/70"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/70"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-green-500/70"></div>
            <div className="text-xs text-zinc-500 ml-4 font-mono select-none">expensemate.com/dashboard</div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h4 className="text-lg font-bold text-white">Active Group: Flatmates 402</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 flex flex-col justify-between h-32">
                  <span className="text-xs text-zinc-400">Total Group Balance</span>
                  <span className="text-3xl font-extrabold text-white">$1,420.50</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Fully settled up with 2 groups
                  </span>
                </div>
                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 flex flex-col justify-between h-32">
                  <span className="text-xs text-zinc-400">Your Share (Owed to You)</span>
                  <span className="text-3xl font-extrabold text-indigo-400">+$245.00</span>
                  <span className="text-[10px] text-indigo-300">3 friends owe you money</span>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Recent Billing Transactions</span>
                <div className="space-y-2">
                  {[
                    { title: "Weekly Grocery Shopping", payer: "You paid", amount: "$152.00", share: "Split with 3 others", type: "primary" },
                    { title: "Internet & Electricity Bill", payer: "Sarah paid", amount: "$90.00", share: "You owe $30.00", type: "secondary" },
                    { title: "Dinner & Drinks", payer: "David paid", amount: "$120.00", share: "You owe $40.00", type: "secondary" },
                  ].map((bill, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/20 border border-white/5 hover:bg-zinc-950/45 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-white">{bill.title}</p>
                        <p className="text-xs text-zinc-500">{bill.payer} • {bill.share}</p>
                      </div>
                      <span className={`text-sm font-bold ${bill.type === "primary" ? "text-emerald-400" : "text-rose-400"}`}>
                        {bill.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-indigo-950/20 to-purple-950/20 border border-indigo-500/10 flex flex-col justify-between h-full">
              <div className="space-y-4">
                <span className="inline-flex px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">MFA SHIELD ACTIVE</span>
                <h4 className="text-base font-bold text-white">Security Snapshot</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your profile database and payment API proxies are isolated inside a virtual session vault. Setup MFA to require a rotating code on every new sign-in attempt.
                </p>
              </div>
              <div className="space-y-2 mt-8">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 text-xs">
                  <span className="text-zinc-300">TOTP Authenticator</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Enabled
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 text-xs">
                  <span className="text-zinc-300">Email MFALock</span>
                  <span className="text-zinc-500">Disabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center border-t border-white/5 py-8 mt-12 text-xs text-zinc-500 z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ExpenseMate. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-zinc-300 transition-colors">About Tech Stack</Link>
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

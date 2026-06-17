"use client";

import React from "react";
import Link from "next/link";

export default function About() {
  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen py-16 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-1/3 right-1/4 translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-pink-500/5 blur-3xl pointer-events-none animate-glow"></div>
      <div className="absolute bottom-1/3 left-1/4 -translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none animate-glow" style={{ animationDelay: "-3s" }}></div>

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            About <span className="text-gradient">ExpenseMate</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            ExpenseMate is a high-performance, security-first clone of Splitwise built with a modern microservices architecture to provide instant syncing and secure account management.
          </p>
        </div>

        {/* Tech Stack Cards */}
        <div className="space-y-12 mb-16">
          <div className="glass-panel p-8 rounded-2xl border border-white/5">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 text-sm">
                ⚙️
              </span>
              System Architecture
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              ExpenseMate is structured as a collection of decoupled, containerized services written in Go that interact via REST APIs and RabbitMQ message brokers. This setup ensures horizontal scalability, fault isolation, and fast response times.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/5">
                <h3 className="text-white font-bold text-sm mb-1">API Gateway Service</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Acts as the single entry point. Handles session validation using a shared Redis cache, handles rate limiting, and forwards authenticated request headers (`X-User-ID`) downstream.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/5">
                <h3 className="text-white font-bold text-sm mb-1">Authentication Service</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Manages registration, bcrypt-hashed passwords, email verification status, and dual multi-factor options (TOTP authenticators and custom email-generated tokens).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/5">
                <h3 className="text-white font-bold text-sm mb-1">Expense Service</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Manages billing groups, custom split formulas, payments, settlements, and simplifies debt graphs between group members.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/5">
                <h3 className="text-white font-bold text-sm mb-1">Notification Service</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Subscribes to RabbitMQ queues to automatically notify members about newly added bills, settle requests, and security updates asynchronously.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-2xl border border-white/5">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 text-sm">
                🛡️
              </span>
              Security Infrastructure
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Our frontends and backends are constructed strictly around the OWASP top-10 security guidelines to keep personal transactions private and safe:
            </p>

            <ul className="space-y-3 text-sm text-zinc-400 list-disc list-inside">
              <li>
                <strong className="text-zinc-200">HttpOnly session cookies</strong> prevent client-side JS scripts from accessing login credentials or session identifiers, removing XSS hijack vectors.
              </li>
              <li>
                <strong className="text-zinc-200">State Proxying</strong> via Next.js rewrites masks direct service coordinates, routing traffic safely and bypassing browser CORS boundaries.
              </li>
              <li>
                <strong className="text-zinc-200">Cryptographically Random PRNG tokens</strong> are generated on the server side using Go's secure cryptographically strong randomizers for sessions and MFA setup links.
              </li>
              <li>
                <strong className="text-zinc-200">Dual-factor enforcement</strong> permits configuring Google Authenticator or custom email-code challenges to protect sensitive billing profiles.
              </li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="px-6 py-3 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all"
          >
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center border-t border-white/5 py-8 mt-16 text-xs text-zinc-500 z-10">
        <p>© {new Date().getFullYear()} ExpenseMate. All rights reserved.</p>
      </footer>
    </div>
  );
}

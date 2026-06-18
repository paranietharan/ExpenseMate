"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import CustomAlert from "../components/CustomAlert";
import QRCode from "qrcode";
import {
  User, Expense, ExpenseSplit,
  Settlement, DebtBalance, Friend, FriendRequest
} from "@/types";

// ---- ICONS ----
const IconReceipt = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconScale = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l9-3 9 3M3 6v14a1 1 0 001 1h4V6M3 6H1m20 0h2M20 6v14a1 1 0 01-1 1h-4V6m-5 7l-3-3m0 0l-3 3m3-3v8m6-5l3-3m0 0l3 3m-3-3v8" />
  </svg>
);
const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const IconBack = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const IconEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconFriends = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconActivity = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconSettings = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconAddPerson = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);
const IconSearch = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// ---- Utility ----
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const formatMonthYear = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()]} ${d.getFullYear()}`;
};
const formatDay = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
};
const emailsMatch = (a?: string, b?: string) =>
  (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
const findBalanceForEmail = (balances: DebtBalance[], email: string) =>
  balances.find(b => emailsMatch(b.user_email, email));

// Combined timeline item type
interface TimelineItem {
  id: string;
  type: "expense" | "settlement";
  date: string;
  description: string;
  payer_email?: string;
  amount: number;
  myShare?: number;
  splits?: ExpenseSplit[];
  canEdit?: boolean;
  raw?: Expense | Settlement;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, refreshStatus } = useAuth();

  const [activeTab, setActiveTab] = useState<"friends" | "activity" | "settings">("friends");

  // Core data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balances, setBalances] = useState<DebtBalance[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>([]);

  // View state
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResult, setFriendSearchResult] = useState<User | null>(null);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);

  // Modals
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Expense form
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState<"equal"|"custom">("equal");
  const [expenseSplits, setExpenseSplits] = useState<{[email:string]:string}>({});
  const [expenseSharedEmails, setExpenseSharedEmails] = useState<string[]>([]);
  const [expensePayerEmail, setExpensePayerEmail] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState("");

  // Settlement form
  const [settlementPayeeEmail, setSettlementPayeeEmail] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");

  // Settings
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [newEmailAddress, setNewEmailAddress] = useState("");
  const [emailChangeVerifyCode, setEmailChangeVerifyCode] = useState("");
  const [showEmailChangeVerify, setShowEmailChangeVerify] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success"|"error"|"warning"|"info">("error");

  // ---- LIFECYCLE ----
  useEffect(() => {
    if (totpUri) {
      QRCode.toDataURL(totpUri, { width: 200, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
        .then(setQrCodeDataUrl).catch(() => setQrCodeDataUrl(""));
    } else setQrCodeDataUrl("");
  }, [totpUri]);

  useEffect(() => { if (user) { setEditName(user.name||""); setEditAvatarUrl(user.avatarUrl||""); } }, [user]);
  useEffect(() => { if (!loading && !user) router.push("/login"); }, [user, loading, router]);
  useEffect(() => { if (user) loadAllData(); }, [user]);

  const loadAllData = async () => {
    await Promise.all([loadExpenses(), loadSettlements(), loadBalances(), loadFriends(), loadFriendRequests(), loadBlockedUsers(), loadNotificationSettings()]);
  };

  const loadExpenses = async () => { const r = await fetch("/api/v1/expenses"); if (r.ok) setExpenses(await r.json()); };
  const loadSettlements = async () => { const r = await fetch("/api/v1/settlements"); if (r.ok) setSettlements(await r.json()); };
  const loadBalances = async () => { const r = await fetch("/api/v1/balances"); if (r.ok) setBalances(await r.json()); };
  const loadFriends = async () => { const r = await fetch("/api/v1/auth/friends/list"); if (r.ok) setFriends(await r.json()); };
  const loadFriendRequests = async () => { const r = await fetch("/api/v1/auth/friends/requests"); if (r.ok) setFriendRequests(await r.json()); };
  const loadBlockedUsers = async () => { const r = await fetch("/api/v1/auth/friends/blocked"); if (r.ok) setBlockedUsers(await r.json()); };
  const loadNotificationSettings = async () => { const r = await fetch("/api/v1/settings"); if (r.ok) { const d = await r.json(); setNotificationsEnabled(d.notifications_enabled); } };

  // ---- HELPERS ----
  const getFriendName = (email: string) => {
    if (emailsMatch(email, user?.email)) return "You";
    const f = friends.find(f => emailsMatch(f.email, email));
    return f?.name || email.split("@")[0];
  };

  const getAvatar = (email: string, friend?: Friend) => {
    if (friend?.avatar_url) return <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />;
    const letter = (friend?.name || email || "?")[0].toUpperCase();
    const colors = ["from-teal-500 to-emerald-600","from-indigo-500 to-purple-600","from-pink-500 to-rose-600","from-amber-500 to-orange-600","from-cyan-500 to-blue-600"];
    const idx = email.charCodeAt(0) % colors.length;
    return <span className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${colors[idx]} text-white font-bold text-sm`}>{letter}</span>;
  };

  // Build combined sorted timeline for a friend
  const buildFriendTimeline = (f: Friend): TimelineItem[] => {
    const items: TimelineItem[] = [];

    // Expenses involving this friend
    expenses.forEach(ex => {
      const involvesFriend = ex.splits.some(s => emailsMatch(s.user_email, f.email)) || emailsMatch(ex.payer_email, f.email) || emailsMatch(ex.creator_email, f.email);
      if (!involvesFriend) return;

      const myShare = ex.splits.find(s => emailsMatch(s.user_email, user?.email));
      const theirShare = ex.splits.find(s => emailsMatch(s.user_email, f.email));
      const iPaid = emailsMatch(ex.payer_email, user?.email);
      const theyPaid = emailsMatch(ex.payer_email, f.email);
      const canEdit = emailsMatch(ex.payer_email, user?.email) || emailsMatch(ex.creator_email, user?.email);

      items.push({
        id: ex.id,
        type: "expense",
        date: ex.created_at,
        description: ex.description,
        payer_email: ex.payer_email,
        amount: ex.amount,
        myShare: myShare?.amount,
        splits: ex.splits,
        canEdit,
        raw: ex,
      });
    });

    // Settlements involving this friend
    settlements.forEach(s => {
      const directlyBetween = (emailsMatch(s.payer_email, user?.email) && emailsMatch(s.payee_email, f.email)) || (emailsMatch(s.payer_email, f.email) && emailsMatch(s.payee_email, user?.email));
      if (!directlyBetween) return;

      items.push({
        id: s.id,
        type: "settlement",
        date: s.created_at,
        description: emailsMatch(s.payer_email, user?.email) ? `You paid ${getFriendName(f.email)}` : `${getFriendName(f.email)} paid you`,
        amount: s.amount,
        raw: s,
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Group timeline items by month
  const groupByMonth = (items: TimelineItem[]) => {
    const groups: { month: string; items: TimelineItem[] }[] = [];
    items.forEach(item => {
      const m = formatMonthYear(item.date);
      const existing = groups.find(g => g.month === m);
      if (existing) existing.items.push(item);
      else groups.push({ month: m, items: [item] });
    });
    return groups;
  };

  // Build global activity feed
  const buildActivityFeed = useMemo(() => {
    const items: { date: string; text: string; subText: string; amount: number; isOwed: boolean; isSettlement?: boolean }[] = [];

    expenses.forEach(ex => {
      const myShare = ex.splits.find(s => emailsMatch(s.user_email, user?.email));
      const iPaid = emailsMatch(ex.payer_email, user?.email);
      if (!myShare && !iPaid) return;

      const otherMembers = ex.splits.filter(s => !emailsMatch(s.user_email, user?.email));
      const desc = ex.description;

      if (iPaid && otherMembers.length > 0) {
        const totalOwed = otherMembers.reduce((s, m) => s + m.amount, 0);
        items.push({ date: ex.created_at, text: `You added "${desc}".`, subText: new Date(ex.created_at).toLocaleString(), amount: totalOwed, isOwed: true });
      } else if (myShare && !iPaid) {
        items.push({ date: ex.created_at, text: `${getFriendName(ex.payer_email || "")} added "${desc}".`, subText: new Date(ex.created_at).toLocaleString(), amount: myShare.amount, isOwed: false });
      }
    });

    settlements.forEach(s => {
      const iPaid = emailsMatch(s.payer_email, user?.email);
      const iReceived = emailsMatch(s.payee_email, user?.email);
      if (!iPaid && !iReceived) return;
      if (iPaid) {
        items.push({ date: s.created_at, text: `You recorded a payment to ${getFriendName(s.payee_email)}.`, subText: new Date(s.created_at).toLocaleString(), amount: s.amount, isOwed: false, isSettlement: true });
      } else {
        items.push({ date: s.created_at, text: `You recorded a payment from ${getFriendName(s.payer_email)}.`, subText: new Date(s.created_at).toLocaleString(), amount: s.amount, isOwed: true, isSettlement: true });
      }
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, settlements, user, friends]);

  // ---- MUTATIONS ----
  const buildMembersList = () => [
    { user_id: user?.userId || "", user_email: user?.email || "" },
    ...expenseSharedEmails.map(email => ({
      user_id: friends.find(f => emailsMatch(f.email, email))?.user_id || "",
      user_email: email,
    })),
  ];

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (!expenseDesc.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const membersList = buildMembersList();
    if (membersList.length < 2 || membersList.length > 10) {
      setAlertType("warning"); setAlertMessage("Select 1–9 friends to split with."); return;
    }

    let splitsPayload: ExpenseSplit[] = [];
    if (expenseSplitType === "equal") {
      const share = amountNum / membersList.length;
      splitsPayload = membersList.map(m => ({ user_id: m.user_id, user_email: m.user_email, amount: parseFloat(share.toFixed(2)) }));
      const diff = amountNum - splitsPayload.reduce((s, m) => s + m.amount, 0);
      if (Math.abs(diff) > 0.001 && splitsPayload.length > 0) splitsPayload[0].amount = parseFloat((splitsPayload[0].amount + diff).toFixed(2));
    } else {
      let total = 0;
      splitsPayload = membersList.map(m => { const a = parseFloat(expenseSplits[m.user_email] || "0"); total += a; return { user_id: m.user_id, user_email: m.user_email, amount: a }; });
      if (Math.abs(total - amountNum) > 0.01) { setAlertType("warning"); setAlertMessage(`Splits ($${total.toFixed(2)}) must equal total ($${amountNum.toFixed(2)}).`); return; }
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: expenseDesc.trim(), amount: amountNum, payer_email: expensePayerEmail || user?.email || "", splits: splitsPayload }) });
      if (res.ok) { setAlertType("success"); setAlertMessage("Expense added!"); setShowCreateExpenseModal(false); resetExpenseForm(); await loadAllData(); }
      else { setAlertType("error"); setAlertMessage(await res.text() || "Failed."); }
    } catch { setAlertType("error"); setAlertMessage("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (!expenseDesc.trim() || isNaN(amountNum) || amountNum <= 0 || !editingExpenseId) return;

    const membersList = buildMembersList();
    if (membersList.length < 2 || membersList.length > 10) { setAlertType("warning"); setAlertMessage("Select 1–9 friends."); return; }

    let splitsPayload: ExpenseSplit[] = [];
    if (expenseSplitType === "equal") {
      const share = amountNum / membersList.length;
      splitsPayload = membersList.map(m => ({ user_id: m.user_id, user_email: m.user_email, amount: parseFloat(share.toFixed(2)) }));
      const diff = amountNum - splitsPayload.reduce((s, m) => s + m.amount, 0);
      if (Math.abs(diff) > 0.001) splitsPayload[0].amount = parseFloat((splitsPayload[0].amount + diff).toFixed(2));
    } else {
      let total = 0;
      splitsPayload = membersList.map(m => { const a = parseFloat(expenseSplits[m.user_email] || "0"); total += a; return { user_id: m.user_id, user_email: m.user_email, amount: a }; });
      if (Math.abs(total - amountNum) > 0.01) { setAlertType("warning"); setAlertMessage(`Splits must equal total.`); return; }
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/expenses/${editingExpenseId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: expenseDesc.trim(), amount: amountNum, payer_email: expensePayerEmail || user?.email || "", splits: splitsPayload }) });
      if (res.ok) { setAlertType("success"); setAlertMessage("Expense updated!"); setShowEditExpenseModal(false); resetExpenseForm(); await loadAllData(); }
      else { setAlertType("error"); setAlertMessage(await res.text() || "Failed."); }
    } catch { setAlertType("error"); setAlertMessage("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/expenses/${id}`, { method: "DELETE" });
      if (res.ok) { setAlertType("success"); setAlertMessage("Deleted."); await loadAllData(); }
      else { setAlertType("error"); setAlertMessage(await res.text() || "Failed."); }
    } catch { setAlertType("error"); setAlertMessage("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleSettleUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(settlementAmount);
    if (!settlementPayeeEmail || isNaN(amountNum) || amountNum <= 0) return;

    let payeeId = friends.find(f => emailsMatch(f.email, settlementPayeeEmail))?.user_id || findBalanceForEmail(balances, settlementPayeeEmail)?.user_id || "";
    if (!payeeId) { setAlertType("warning"); setAlertMessage("Cannot resolve payee."); return; }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/settlements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payee_id: payeeId, payee_email: settlementPayeeEmail, amount: amountNum }) });
      if (res.ok) { setAlertType("success"); setAlertMessage("Settlement recorded!"); setShowSettleModal(false); setSettlementPayeeEmail(""); setSettlementAmount(""); await loadAllData(); }
      else { setAlertType("error"); setAlertMessage(await res.text() || "Failed."); }
    } catch { setAlertType("error"); setAlertMessage("Network error."); }
    finally { setActionLoading(false); }
  };

  const resetExpenseForm = () => {
    setExpenseDesc(""); setExpenseAmount(""); setExpenseSharedEmails([]); setExpensePayerEmail(""); setExpenseSplits({}); setExpenseSplitType("equal"); setEditingExpenseId("");
  };

  const openExpenseModal = (prefillFriend?: string) => {
    resetExpenseForm();
    if (prefillFriend) setExpenseSharedEmails([prefillFriend]);
    setShowCreateExpenseModal(true);
  };

  const openEditModal = (ex: Expense) => {
    setEditingExpenseId(ex.id);
    setExpenseDesc(ex.description);
    setExpenseAmount(ex.amount.toString());
    setExpenseSplitType("custom");
    setExpensePayerEmail(ex.payer_email);
    setExpenseSharedEmails(ex.splits.map(s => s.user_email).filter(e => e !== user?.email));
    const map: {[e:string]:string} = {};
    ex.splits.forEach(s => { map[s.user_email] = s.amount.toString(); });
    setExpenseSplits(map);
    setShowEditExpenseModal(true);
  };

  const handleSearchFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFriendSearchLoading(true); setFriendSearchError(""); setFriendSearchResult(null);
    try {
      const res = await fetch(`/api/v1/auth/friends/search?email=${encodeURIComponent(friendSearchQuery.trim())}`);
      if (res.ok) setFriendSearchResult(await res.json());
      else if (res.status === 404) setFriendSearchError("User not found.");
      else setFriendSearchError("Search failed.");
    } catch { setFriendSearchError("Network error."); }
    finally { setFriendSearchLoading(false); }
  };

  const handleSendRequest = async (email: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friend_email: email }) });
      if (res.ok) { setAlertType("success"); setAlertMessage("Friend request sent!"); setFriendSearchResult(null); setFriendSearchQuery(""); await loadFriendRequests(); }
      else { setAlertType("error"); setAlertMessage(await res.text() || "Failed."); }
    } catch { setAlertType("error"); setAlertMessage("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleAcceptRequest = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: id }) });
      if (res.ok) { setAlertType("success"); setAlertMessage("Friend added!"); await loadFriendRequests(); await loadFriends(); }
      else { setAlertType("error"); setAlertMessage(await res.text() || "Failed."); }
    } catch { setAlertType("error"); setAlertMessage("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleRejectRequest = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: id }) });
      if (res.ok) { await loadFriendRequests(); }
    } catch {} finally { setActionLoading(false); }
  };

  const handleBlock = async (userId: string) => {
    if (!confirm("Block this user?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/block", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) });
      if (res.ok) { setSelectedFriend(null); await loadAllData(); }
    } catch {} finally { setActionLoading(false); }
  };

  const handleUnblock = async (userId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/unblock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) });
      if (res.ok) { await loadBlockedUsers(); }
    } catch {} finally { setActionLoading(false); }
  };

  // Settings mutations (abbreviated)
  const handleUpdateName = async (e: React.FormEvent) => { e.preventDefault(); setActionLoading(true); try { const r = await fetch("/api/v1/auth/profile/change-name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName }) }); if (r.ok) { setAlertType("success"); setAlertMessage("Name updated!"); await refreshStatus(); } else { setAlertType("error"); setAlertMessage(await r.text()); } } catch { setAlertType("error"); setAlertMessage("Network error."); } finally { setActionLoading(false); } };
  const handleUpdateAvatar = async (e: React.FormEvent) => { e.preventDefault(); setActionLoading(true); try { const r = await fetch("/api/v1/auth/profile/change-avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar_url: editAvatarUrl }) }); if (r.ok) { setAlertType("success"); setAlertMessage("Avatar updated!"); await refreshStatus(); } else { setAlertType("error"); setAlertMessage(await r.text()); } } catch { setAlertType("error"); setAlertMessage("Network error."); } finally { setActionLoading(false); } };
  const handleRequestEmailChange = async (e: React.FormEvent) => { e.preventDefault(); setActionLoading(true); try { const r = await fetch("/api/v1/auth/profile/change-email/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_email: newEmailAddress }) }); if (r.ok) { setShowEmailChangeVerify(true); setAlertType("success"); setAlertMessage("OTP sent!"); } else { setAlertType("error"); setAlertMessage(await r.text()); } } catch { setAlertType("error"); setAlertMessage("Network error."); } finally { setActionLoading(false); } };
  const handleVerifyEmailChange = async (e: React.FormEvent) => { e.preventDefault(); setActionLoading(true); try { const r = await fetch("/api/v1/auth/profile/change-email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: emailChangeVerifyCode }) }); if (r.ok) { setAlertType("success"); setAlertMessage("Email changed!"); setShowEmailChangeVerify(false); setNewEmailAddress(""); setEmailChangeVerifyCode(""); await refreshStatus(); } else { setAlertType("error"); setAlertMessage(await r.text()); } } catch { setAlertType("error"); setAlertMessage("Network error."); } finally { setActionLoading(false); } };
  const handleNotifToggle = async (v: boolean) => { setNotificationsEnabled(v); await fetch("/api/v1/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifications_enabled: v }) }); };
  const handleInitiateTotp = async () => { setActionLoading(true); try { const r = await fetch("/api/v1/auth/mfa/totp/setup", { method: "POST" }); if (r.ok) { const d = await r.json(); setTotpSecret(d.secret); setTotpUri(d.otpauth_url); setShowTotpSetup(true); } } catch {} finally { setActionLoading(false); } };
  const handleEnableTotp = async (e: React.FormEvent) => { e.preventDefault(); setActionLoading(true); try { const r = await fetch("/api/v1/auth/mfa/totp/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: totpCode }) }); if (r.ok) { setAlertType("success"); setAlertMessage("TOTP enabled!"); setShowTotpSetup(false); setTotpCode(""); await refreshStatus(); } } catch {} finally { setActionLoading(false); } };
  const handleDisableTotp = async () => { if (!confirm("Disable TOTP?")) return; const r = await fetch("/api/v1/auth/mfa/totp/disable", { method: "POST" }); if (r.ok) { setAlertType("success"); setAlertMessage("TOTP disabled."); await refreshStatus(); } };
  const handleInitiateEmailMfa = async () => { const r = await fetch("/api/v1/auth/mfa/email/setup", { method: "POST" }); if (r.ok) { setShowEmailSetup(true); setAlertType("success"); setAlertMessage("Code sent!"); } };
  const handleEnableEmailMfa = async (e: React.FormEvent) => { e.preventDefault(); setActionLoading(true); try { const r = await fetch("/api/v1/auth/mfa/email/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: emailCode }) }); if (r.ok) { setAlertType("success"); setAlertMessage("Email MFA enabled!"); setShowEmailSetup(false); setEmailCode(""); await refreshStatus(); } } catch {} finally { setActionLoading(false); } };
  const handleDisableEmailMfa = async () => { if (!confirm("Disable Email MFA?")) return; const r = await fetch("/api/v1/auth/mfa/email/disable", { method: "POST" }); if (r.ok) { setAlertType("success"); setAlertMessage("Email MFA disabled."); await refreshStatus(); } };
  const handleChangePassword = async (e: React.FormEvent) => { e.preventDefault(); if (newPassword !== confirmPassword) { setAlertType("warning"); setAlertMessage("Passwords don't match."); return; } setActionLoading(true); try { const r = await fetch("/api/v1/auth/password/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }) }); if (r.ok) { setAlertType("success"); setAlertMessage("Password updated!"); setOldPassword(""); setNewPassword(""); setConfirmPassword(""); } else { setAlertType("error"); setAlertMessage(await r.text()); } } catch { setAlertType("error"); setAlertMessage("Network error."); } finally { setActionLoading(false); } };

  // ---- EXPENSE MODAL FORM (shared for create & edit) ----
  const renderExpenseForm = (onSubmit: (e: React.FormEvent) => void, label: string) => {
    const amountVal = parseFloat(expenseAmount) || 0;
    const membersList = buildMembersList();
    const share = membersList.length > 0 ? amountVal / membersList.length : 0;
    const customSum = membersList.reduce((s, m) => s + (parseFloat(expenseSplits[m.user_email]) || 0), 0);
    const remaining = amountVal - customSum;

    return (
      <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Description</label>
            <input type="text" required value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="e.g. Dinner, Grocery..." className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Total Amount ($)</label>
            <input type="number" step="0.01" required value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
          </div>
        </div>

        {/* Friends checklist */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Split With (select friends)</label>
          {friends.length === 0
            ? <p className="text-xs text-zinc-500 italic">No friends yet.</p>
            : <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl bg-zinc-800/60 p-2 border border-zinc-700">
                {friends.map(f => {
                  const checked = expenseSharedEmails.includes(f.email);
                  return (
                    <label key={f.user_id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${checked ? "bg-teal-900/30 border border-teal-700/30" : "hover:bg-zinc-700/50"}`}>
                      <input type="checkbox" checked={checked} onChange={() => { setExpenseSharedEmails(prev => checked ? prev.filter(e => e !== f.email) : [...prev, f.email]); setExpenseSplits({}); }} className="w-3.5 h-3.5 accent-teal-500" />
                      <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">{getAvatar(f.email, f)}</div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white block truncate">{f.name || f.email.split("@")[0]}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
          }
          <p className="text-[10px] text-zinc-600 mt-1">{membersList.length} participant{membersList.length !== 1 ? "s" : ""} total</p>
        </div>

        {/* Payer */}
        {membersList.length >= 2 && (
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Who Paid?</label>
            <select value={expensePayerEmail || user?.email} onChange={e => setExpensePayerEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-teal-500/50">
              {membersList.map(m => <option key={m.user_email} value={m.user_email}>{m.user_email === user?.email ? `You (${user.email})` : m.user_email}</option>)}
            </select>
          </div>
        )}

        {/* Split type */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Split</label>
          <div className="flex gap-1 p-1 bg-zinc-800 rounded-xl border border-zinc-700">
            {(["equal","custom"] as const).map(t => (
              <button key={t} type="button" onClick={() => { setExpenseSplitType(t); if (t === "custom" && membersList.length > 0) { const eq = (amountVal / membersList.length).toFixed(2); const pf: {[e:string]:string} = {}; membersList.forEach(m => { pf[m.user_email] = eq; }); setExpenseSplits(pf); } }} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${expenseSplitType === t ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                {t === "equal" ? "Equally" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {expenseSplitType === "equal" && membersList.length >= 2 && (
          <div className="px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 space-y-1">
            {membersList.map((m, i) => (
              <div key={i} className="flex justify-between text-xs text-zinc-300">
                <span>{m.user_email === user?.email ? "You" : getFriendName(m.user_email)}</span>
                <span className="font-mono text-teal-400">${share.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {expenseSplitType === "custom" && (
          <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-3 space-y-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Custom amounts</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${Math.abs(remaining) < 0.01 ? "text-teal-400 bg-teal-900/30" : "text-rose-400 bg-rose-900/30"}`}>
                {Math.abs(remaining) < 0.01 ? "✓ Good" : remaining > 0 ? `$${remaining.toFixed(2)} left` : `$${Math.abs(remaining).toFixed(2)} over`}
              </span>
            </div>
            {membersList.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-zinc-300 truncate">{m.user_email === user?.email ? "You" : getFriendName(m.user_email)}</span>
                <input type="number" step="0.01" placeholder="0.00" value={expenseSplits[m.user_email] || ""} onChange={e => setExpenseSplits({ ...expenseSplits, [m.user_email]: e.target.value })} className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-right font-mono text-white text-xs focus:outline-none focus:border-teal-500/50" />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { const eq = (amountVal / membersList.length).toFixed(2); const pf: {[e:string]:string} = {}; membersList.forEach(m => { pf[m.user_email] = eq; }); setExpenseSplits(pf); }} className="flex-1 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-300 cursor-pointer">Reset Equal</button>
              <button type="button" onClick={() => { const empty = membersList.filter(m => !expenseSplits[m.user_email] || parseFloat(expenseSplits[m.user_email]) === 0); if (empty.length > 0 && remaining > 0) { const ds = (remaining / empty.length).toFixed(2); const ns = { ...expenseSplits }; empty.forEach(m => { ns[m.user_email] = ds; }); setExpenseSplits(ns); } }} className="flex-1 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-300 cursor-pointer">Distribute</button>
            </div>
          </div>
        )}

        <button type="submit" disabled={actionLoading || membersList.length < 2} className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 cursor-pointer transition-all">
          {actionLoading ? "Saving…" : label}
        </button>
      </form>
    );
  };

  // ---- FRIEND DETAIL VIEW ----
  const renderFriendDetail = () => {
    if (!selectedFriend) return null;
    const bal = findBalanceForEmail(balances, selectedFriend.email);
    const timeline = buildFriendTimeline(selectedFriend);
    const groups = groupByMonth(timeline);
    const owesMe = bal && bal.balance > 0;
    const iOwe = bal && bal.balance < 0;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="relative h-32 bg-gradient-to-br from-teal-800 to-teal-600 rounded-b-3xl mb-4 flex-shrink-0">
          <button onClick={() => setSelectedFriend(null)} className="absolute top-4 left-4 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 cursor-pointer"><IconBack /></button>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="w-16 h-16 rounded-full border-4 border-zinc-900 overflow-hidden bg-zinc-700">
              {getAvatar(selectedFriend.email, selectedFriend)}
            </div>
          </div>
        </div>

        <div className="pt-10 px-1 text-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">{selectedFriend.name || selectedFriend.email.split("@")[0]}</h2>
          {bal ? (
            <p className={`text-sm mt-0.5 font-medium ${owesMe ? "text-teal-400" : iOwe ? "text-rose-400" : "text-zinc-400"}`}>
              {owesMe ? `${selectedFriend.name || "They"} owes you $${bal.balance.toFixed(2)}` : iOwe ? `You owe ${selectedFriend.name || "them"} $${Math.abs(bal.balance).toFixed(2)}` : "All settled up"}
            </p>
          ) : (
            <p className="text-sm text-zinc-500 mt-0.5">No shared expenses yet</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-1 mb-4 flex-shrink-0 overflow-x-auto pb-1">
          <button onClick={() => { 
            setSettlementPayeeEmail(selectedFriend.email); 
            // Pre-fill with what user owes (negative balance), or 0 if they owe user
            setSettlementAmount(bal && bal.balance < 0 ? Math.abs(bal.balance).toFixed(2) : ""); 
            setShowSettleModal(true); 
          }} className="flex-shrink-0 px-4 py-2 rounded-full bg-teal-600 hover:bg-teal-500 text-sm font-bold text-white cursor-pointer transition-colors">Settle up</button>
          <button onClick={() => openExpenseModal(selectedFriend.email)} className="flex-shrink-0 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-white border border-zinc-600 cursor-pointer transition-colors">Add expense</button>
          <button onClick={() => handleBlock(selectedFriend.user_id)} className="flex-shrink-0 px-4 py-2 rounded-full bg-zinc-800 hover:bg-rose-900/30 text-sm font-semibold text-zinc-400 hover:text-rose-400 border border-zinc-700 cursor-pointer transition-colors">Block</button>
        </div>

        {/* Combined timeline */}
        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {groups.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">No activity yet</div>
          ) : groups.map(group => (
            <div key={group.month}>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">{group.month}</h4>
              <div className="space-y-1">
                {group.items.map(item => {
                  const ex = item.type === "expense" ? (item.raw as Expense) : null;
                  const iPaid = emailsMatch(ex?.payer_email, user?.email);
                  const theyPaid = emailsMatch(ex?.payer_email, selectedFriend.email);
                  const myShare = ex?.splits.find(s => emailsMatch(s.user_email, user?.email));
                  const theirShare = ex?.splits.find(s => emailsMatch(s.user_email, selectedFriend.email));

                  let statusLabel = "";
                  let statusColor = "";
                  let displayAmount = 0;

                  if (item.type === "settlement") {
                    statusLabel = "settled up";
                    statusColor = "text-zinc-400";
                    displayAmount = item.amount;
                  } else if (iPaid && theirShare) {
                    statusLabel = "you lent";
                    statusColor = "text-teal-400";
                    displayAmount = theirShare.amount;
                  } else if (theyPaid && myShare) {
                    statusLabel = "you borrowed";
                    statusColor = "text-rose-400";
                    displayAmount = myShare.amount;
                  } else if (myShare) {
                    statusLabel = "your share";
                    statusColor = "text-zinc-400";
                    displayAmount = myShare.amount;
                  }

                  return (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-800/50 transition-colors group">
                      {/* Date */}
                      <div className="w-10 text-center flex-shrink-0">
                        <span className="block text-[9px] text-zinc-500 uppercase">{formatDay(item.date).split(" ")[0]}</span>
                        <span className="block text-sm font-bold text-zinc-300">{formatDay(item.date).split(" ")[1]}</span>
                      </div>

                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === "settlement" ? "bg-teal-900/40 text-teal-400" : "bg-zinc-700/60 text-zinc-300"}`}>
                        {item.type === "settlement" ? <IconScale /> : <IconReceipt />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white truncate">{item.description}</span>
                        <span className="block text-[11px] text-zinc-500 truncate">
                          {item.type === "expense" && ex ? `${iPaid ? "You" : getFriendName(ex.payer_email||"")} paid $${ex.amount.toFixed(2)}` : ""}
                        </span>
                      </div>

                      {/* Status + Amount */}
                      <div className="text-right flex-shrink-0">
                        {statusLabel && (
                          <>
                            <span className={`block text-[10px] ${statusColor}`}>{statusLabel}</span>
                            {item.type !== "settlement" && <span className={`block text-sm font-bold font-mono ${statusColor}`}>${displayAmount.toFixed(2)}</span>}
                            {item.type === "settlement" && <span className="block text-sm font-bold font-mono text-zinc-400">${displayAmount.toFixed(2)}</span>}
                          </>
                        )}
                        {!statusLabel && <span className="text-zinc-600 text-xs">—</span>}
                      </div>

                      {/* Edit/Delete (hidden until hover, only if can edit) */}
                      {item.canEdit && item.type === "expense" && (
                        <div className="hidden group-hover:flex gap-1 flex-shrink-0">
                          <button onClick={() => openEditModal(item.raw as Expense)} className="p-1 rounded bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"><IconEdit /></button>
                          <button onClick={() => handleDeleteExpense(item.id)} className="p-1 rounded bg-rose-950/30 text-rose-400 hover:text-rose-300 cursor-pointer"><IconTrash /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---- FRIENDS LIST VIEW ----
  const renderFriendsList = () => {
    const owedSum = balances.filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0);
    const owesSum = Math.abs(balances.filter(b => b.balance < 0).reduce((s, b) => s + b.balance, 0));
    const netSum = owedSum - owesSum;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            {netSum !== 0 && (
              <p className="text-base font-semibold text-white">
                Overall, you {netSum > 0 ? "are owed" : "owe"}{" "}
                <span className={netSum > 0 ? "text-teal-400 font-bold" : "text-rose-400 font-bold"}>
                  ${Math.abs(netSum).toFixed(2)}
                </span>
              </p>
            )}
            {netSum === 0 && friends.length > 0 && <p className="text-sm text-zinc-400">All settled up ✓</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddFriend(!showAddFriend)} className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"><IconAddPerson /></button>
          </div>
        </div>

        {/* Pending invites */}
        {friendRequests.length > 0 && (
          <div className="mb-3 p-3 rounded-2xl bg-amber-950/20 border border-amber-800/30 space-y-2 flex-shrink-0">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending Invites ({friendRequests.length})</h4>
            {friendRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">{req.sender_email}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleAcceptRequest(req.id)} className="px-3 py-1 rounded-full bg-teal-600 text-white font-bold cursor-pointer text-[10px]">Accept</button>
                  <button onClick={() => handleRejectRequest(req.id)} className="px-3 py-1 rounded-full bg-zinc-700 text-zinc-400 cursor-pointer text-[10px]">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add friend panel */}
        {showAddFriend && (
          <div className="mb-3 p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700 space-y-3 flex-shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Find a friend by email</h4>
            <form onSubmit={handleSearchFriend} className="flex gap-2">
              <input type="email" required value={friendSearchQuery} onChange={e => setFriendSearchQuery(e.target.value)} placeholder="friend@example.com" className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
              <button type="submit" disabled={friendSearchLoading} className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50">Search</button>
            </form>
            {friendSearchError && <p className="text-xs text-rose-400">{friendSearchError}</p>}
            {friendSearchResult && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-700">
                <div>
                  <span className="block text-xs font-bold text-white">{friendSearchResult.name || "User"}</span>
                  <span className="text-[10px] text-zinc-500">{friendSearchResult.email}</span>
                </div>
                <button onClick={() => handleSendRequest(friendSearchResult.email)} disabled={actionLoading} className="px-3 py-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white cursor-pointer">Add</button>
              </div>
            )}
          </div>
        )}

        {/* Friends list */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {friends.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-zinc-400 text-sm">No friends yet</p>
              <p className="text-zinc-600 text-xs">Tap the + button to add friends</p>
            </div>
          ) : friends.map(f => {
            const bal = findBalanceForEmail(balances, f.email);
            // Find expense breakdowns for this friend
            const friendExpenses = expenses.filter(ex =>
              ex.splits.some(s => s.user_email === f.email) && (ex.payer_email === user?.email || ex.splits.some(s => s.user_email === user?.email))
            ).slice(0, 3);

            return (
              <button key={f.user_id} onClick={() => setSelectedFriend(f)} className="w-full text-left">
                <div className="px-3 py-3 rounded-2xl hover:bg-zinc-800/60 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
                      {getAvatar(f.email, f)}
                    </div>

                    {/* Name + balance */}
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-white">{f.name || f.email.split("@")[0]}</span>
                      {bal ? (
                        <div>
                          <span className={`text-xs font-medium ${bal.balance > 0 ? "text-zinc-400" : "text-zinc-400"}`}>
                            {bal.balance > 0 ? "owes you" : "you owe"}
                          </span>
                          <span className={`ml-1 text-xs font-bold font-mono ${bal.balance > 0 ? "text-teal-400" : "text-rose-400"}`}>
                            ${Math.abs(bal.balance).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">settled up</span>
                      )}
                    </div>

                    {/* Right side amount */}
                    {bal && (
                      <div className="text-right flex-shrink-0">
                        <span className="block text-[9px] text-zinc-500">{bal.balance > 0 ? "owes you" : "you owe"}</span>
                        <span className={`block text-sm font-bold font-mono ${bal.balance > 0 ? "text-teal-400" : "text-rose-400"}`}>
                          ${Math.abs(bal.balance).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {!bal && <span className="text-xs text-zinc-600 flex-shrink-0">settled up</span>}
                  </div>

                  {/* Inline balance breakdown — derived from authoritative net balance */}
                  {bal && (
                    <div className="ml-14 mt-1 space-y-0.5">
                      {bal.balance > 0 && (
                        <p className="text-[10px] text-zinc-500 truncate">
                          {f.name || f.email.split("@")[0]} owes you <span className="text-teal-400/80">${bal.balance.toFixed(2)}</span> overall
                        </p>
                      )}
                      {bal.balance < 0 && (
                        <p className="text-[10px] text-zinc-500 truncate">
                          You owe {f.name || f.email.split("@")[0]} <span className="text-rose-400/80">${Math.abs(bal.balance).toFixed(2)}</span> overall
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Blocked users section */}
          {blockedUsers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800/50">
              <p className="text-xs text-zinc-600 uppercase tracking-wider font-bold mb-2 px-1">Blocked</p>
              {blockedUsers.map(b => (
                <div key={b.user_id} className="flex items-center justify-between px-3 py-2 rounded-xl">
                  <span className="text-xs text-zinc-500">{b.email}</span>
                  <button onClick={() => handleUnblock(b.user_id)} className="text-[10px] text-zinc-500 hover:text-white px-2 py-1 rounded bg-zinc-800 cursor-pointer">Unblock</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---- ACTIVITY FEED ----
  const renderActivity = () => (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-bold text-white mb-4 flex-shrink-0">Recent activity</h2>
      <div className="flex-1 overflow-y-auto space-y-1">
        {buildActivityFeed.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm">No activity yet</div>
        ) : buildActivityFeed.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 px-3 py-3 rounded-2xl hover:bg-zinc-800/40 transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.isSettlement ? "bg-teal-900/40 text-teal-400" : "bg-zinc-700/60 text-zinc-300"}`}>
              {item.isSettlement ? <IconScale /> : <IconReceipt />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium leading-snug">{item.text}</p>
              <p className={`text-xs font-semibold mt-0.5 ${item.isOwed ? "text-teal-400" : "text-rose-400"}`}>
                {item.isOwed ? (item.isSettlement ? `You received $${item.amount.toFixed(2)}` : `You get back $${item.amount.toFixed(2)}`) : (item.isSettlement ? `You paid $${item.amount.toFixed(2)}` : `You owe $${item.amount.toFixed(2)}`)}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{item.subText}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ---- SETTINGS ----
  const renderSettings = () => (
    <div className="overflow-y-auto flex-1 space-y-4">
      {/* Profile */}
      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Profile</h3>
        <form onSubmit={handleUpdateName} className="space-y-2">
          <input id="name" type="text" required value={editName} onChange={e => setEditName(e.target.value)} placeholder="Display Name" className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
          <button type="submit" disabled={actionLoading} className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-sm font-bold text-white cursor-pointer disabled:opacity-50">Save Name</button>
        </form>
        <form onSubmit={handleUpdateAvatar} className="space-y-2">
          <input type="url" required value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)} placeholder="Avatar URL (https://...)" className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
          <button type="submit" disabled={actionLoading} className="w-full py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-sm font-bold text-white cursor-pointer disabled:opacity-50">Save Avatar</button>
        </form>
      </div>

      {/* Email */}
      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Change Email</h3>
        {!showEmailChangeVerify
          ? <form onSubmit={handleRequestEmailChange} className="flex gap-2">
              <input type="email" required value={newEmailAddress} onChange={e => setNewEmailAddress(e.target.value)} placeholder="new@email.com" className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
              <button type="submit" disabled={actionLoading} className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50">Send OTP</button>
            </form>
          : <form onSubmit={handleVerifyEmailChange} className="space-y-2">
              <input type="text" required maxLength={6} value={emailChangeVerifyCode} onChange={e => setEmailChangeVerifyCode(e.target.value.replace(/\D/g,""))} placeholder="000000" className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white text-center font-mono tracking-widest focus:outline-none focus:border-teal-500/50" />
              <div className="flex gap-2">
                <button type="submit" disabled={actionLoading} className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white cursor-pointer">Verify</button>
                <button type="button" onClick={() => setShowEmailChangeVerify(false)} className="flex-1 py-2 rounded-xl bg-zinc-700 text-xs text-zinc-400 cursor-pointer">Cancel</button>
              </div>
            </form>
        }
      </div>

      {/* Password */}
      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-2">
          <input type="password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Current password" className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
          <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
          <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
          <button type="submit" disabled={actionLoading} className="w-full py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-sm font-bold text-white cursor-pointer disabled:opacity-50">Update Password</button>
        </form>
      </div>

      {/* Notifications */}
      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Expense & settlement alerts</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={notificationsEnabled} onChange={e => handleNotifToggle(e.target.checked)} className="sr-only peer" />
          <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600 peer-checked:after:bg-white"></div>
        </label>
      </div>

      {/* TOTP */}
      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Authenticator (TOTP)</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Google Authenticator or similar</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${user?.totpEnabled ? "bg-teal-900/40 text-teal-400" : "bg-zinc-700 text-zinc-500"}`}>{user?.totpEnabled ? "Active" : "Off"}</span>
        </div>
        {user?.totpEnabled
          ? <button onClick={handleDisableTotp} className="w-full py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 text-xs font-bold text-rose-400 cursor-pointer border border-rose-900/30">Disable</button>
          : !showTotpSetup
            ? <button onClick={handleInitiateTotp} disabled={actionLoading} className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50">Set up</button>
            : <div className="space-y-3">
                <div className="flex justify-center p-3 bg-white rounded-xl w-fit mx-auto">
                  {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR" className="w-28 h-28" /> : <span className="text-zinc-700 text-xs">Loading…</span>}
                </div>
                <div className="text-xs bg-zinc-900 p-2 rounded-lg text-center font-mono text-white select-all break-all">{totpSecret}</div>
                <form onSubmit={handleEnableTotp} className="flex gap-2">
                  <input type="text" required maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,""))} placeholder="000000" className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-center font-mono text-white" />
                  <button type="submit" disabled={actionLoading} className="px-3 rounded-xl bg-teal-600 text-xs font-bold text-white cursor-pointer">Enable</button>
                  <button type="button" onClick={() => setShowTotpSetup(false)} className="px-3 rounded-xl bg-zinc-700 text-xs text-zinc-400 cursor-pointer">Cancel</button>
                </form>
              </div>
        }
      </div>

      {/* Email MFA */}
      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Email MFA</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Codes sent to your inbox</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${user?.emailMfaEnabled ? "bg-teal-900/40 text-teal-400" : "bg-zinc-700 text-zinc-500"}`}>{user?.emailMfaEnabled ? "Active" : "Off"}</span>
        </div>
        {user?.emailMfaEnabled
          ? <button onClick={handleDisableEmailMfa} className="w-full py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 text-xs font-bold text-rose-400 cursor-pointer border border-rose-900/30">Disable</button>
          : !showEmailSetup
            ? <button onClick={handleInitiateEmailMfa} disabled={actionLoading} className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50">Set up</button>
            : <form onSubmit={handleEnableEmailMfa} className="flex gap-2">
                <input type="text" required maxLength={6} value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g,""))} placeholder="000000" className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-center font-mono text-white" />
                <button type="submit" disabled={actionLoading} className="px-3 rounded-xl bg-teal-600 text-xs font-bold text-white cursor-pointer">Enable</button>
                <button type="button" onClick={() => setShowEmailSetup(false)} className="px-3 rounded-xl bg-zinc-700 text-xs text-zinc-400 cursor-pointer">Cancel</button>
              </form>
        }
      </div>
    </div>
  );

  // ---- LOADING / AUTH ----
  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <svg className="animate-spin h-7 w-7 text-teal-500 mb-3" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="text-sm text-zinc-500">Loading…</span>
    </div>
  );
  if (!user) return null;

  // ---- MAIN RENDER ----
  return (
    <div className="flex-1 flex flex-col h-full max-w-2xl mx-auto w-full relative">
      {/* Alert */}
      {alertMessage && (
        <div className="absolute top-2 left-4 right-4 z-50">
          <CustomAlert message={alertMessage} type={alertType as any} onClose={() => setAlertMessage("")} autoCloseDuration={alertType === "success" ? 4000 : 0} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 pt-4 pb-20">
        {activeTab === "friends" && (selectedFriend ? renderFriendDetail() : renderFriendsList())}
        {activeTab === "activity" && renderActivity()}
        {activeTab === "settings" && renderSettings()}
      </div>

      {/* Floating "Add expense" button */}
      {!showCreateExpenseModal && !showEditExpenseModal && !showSettleModal && (
        <div className="absolute bottom-20 right-4 flex flex-col items-end gap-2 z-30">
          <button
            onClick={() => openExpenseModal(selectedFriend?.email)}
            className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-xl shadow-teal-900/30 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <IconReceipt />
            Add expense
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 flex items-center justify-around px-2 py-2 z-20">
        {[
          { id: "friends", label: "Friends", icon: <IconFriends /> },
          { id: "activity", label: "Activity", icon: <IconActivity /> },
          { id: "settings", label: "Account", icon: (
            <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (user.name||user.email)[0].toUpperCase()}
            </div>
          ) },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); if (tab.id !== "friends") setSelectedFriend(null); }}
            className={`flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-xl transition-colors cursor-pointer ${activeTab === tab.id ? "text-teal-400" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {tab.icon}
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ======================== MODALS ======================== */}

      {/* Create Expense Modal */}
      {showCreateExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-zinc-900 rounded-t-3xl sm:rounded-2xl border border-zinc-700 shadow-2xl p-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Add expense</h3>
              <button onClick={() => { setShowCreateExpenseModal(false); resetExpenseForm(); }} className="text-zinc-500 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            {renderExpenseForm(handleCreateExpense, "Add expense")}
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-zinc-900 rounded-t-3xl sm:rounded-2xl border border-zinc-700 shadow-2xl p-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Edit expense</h3>
              <button onClick={() => { setShowEditExpenseModal(false); resetExpenseForm(); }} className="text-zinc-500 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            {renderExpenseForm(handleEditExpense, "Save changes")}
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-2xl border border-zinc-700 shadow-2xl p-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Settle up</h3>
              <button onClick={() => setShowSettleModal(false)} className="text-zinc-500 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSettleUp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Paying to</label>
                <select value={settlementPayeeEmail} onChange={e => setSettlementPayeeEmail(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white focus:outline-none focus:border-teal-500/50">
                  <option value="">Select friend…</option>
                  {friends.map(f => <option key={f.user_id} value={f.email}>{f.name || f.email}</option>)}
                  {balances.filter(b => !friends.some(f => emailsMatch(f.email, b.user_email))).map((b, i) => <option key={i} value={b.user_email}>{b.user_email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Amount ($)</label>
                <input type="number" step="0.01" required value={settlementAmount} onChange={e => setSettlementAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-teal-500/50" />
              </div>
              <button type="submit" disabled={actionLoading} className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-sm font-bold text-white cursor-pointer disabled:opacity-50">
                {actionLoading ? "Recording…" : "Record payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

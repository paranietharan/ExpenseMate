"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import CustomAlert from "../components/CustomAlert";
import QRCode from "qrcode";
import { 
  User, Group, GroupMember, Expense, ExpenseSplit, 
  Settlement, DebtBalance, Friend, FriendRequest 
} from "@/types";

// --- INLINE SVG ICONS FOR RICH VISUALS (No external module dependencies) ---
const IconOverview = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
  </svg>
);
const IconGroups = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const IconExpenses = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);
const IconSettlements = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const IconFriends = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);
const IconSettings = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, refreshStatus } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<
    "overview" | "groups" | "expenses" | "settlements" | "friends" | "settings"
  >("overview");

  // Core Data States
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balances, setBalances] = useState<DebtBalance[]>([]);
  
  // Friends list & requests states
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>([]);
  
  // Settings/MFA states
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
  const [actionLoading, setActionLoading] = useState(false);

  // Profile Edit fields
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [newEmailAddress, setNewEmailAddress] = useState("");
  const [emailChangeVerifyCode, setEmailChangeVerifyCode] = useState("");
  const [showEmailChangeVerify, setShowEmailChangeVerify] = useState(false);

  // Active Selected Group details
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedGroupBalances, setSelectedGroupBalances] = useState<DebtBalance[]>([]);
  const [selectedGroupExpenses, setSelectedGroupExpenses] = useState<Expense[]>([]);
  const [selectedGroupSettlements, setSelectedGroupSettlements] = useState<Settlement[]>([]);

  // Friends search states
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResult, setFriendSearchResult] = useState<User | null>(null);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);

  // Modals visibility states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [showCreateSettlementModal, setShowCreateSettlementModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);

  // Modal form states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembersText, setNewGroupMembersText] = useState(""); // Comma separated emails

  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseGroupId, setExpenseGroupId] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState<"equal" | "custom">("equal");
  const [expenseSplits, setExpenseSplits] = useState<{ [email: string]: string }>({});
  const [selectedP2PFriendEmail, setSelectedP2PFriendEmail] = useState("");
  
  const [editingExpenseId, setEditingExpenseId] = useState("");
  
  const [settlementGroupId, setSettlementGroupId] = useState("");
  const [settlementPayeeEmail, setSettlementPayeeEmail] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");

  // Alerts
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error" | "warning" | "info">("error");

  // Load TOTP QR Code
  useEffect(() => {
    if (totpUri) {
      QRCode.toDataURL(totpUri, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(""));
    } else {
      setQrCodeDataUrl("");
    }
  }, [totpUri]);

  // Loading initial user profile settings
  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  // Authorization Protection redirect
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch core data on tab change or mount
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadGroups(),
        loadExpenses(),
        loadSettlements(),
        loadBalances(),
        loadFriends(),
        loadFriendRequests(),
        loadBlockedUsers(),
        loadNotificationSettings()
      ]);
    } catch (err) {
      console.error("Error loading application datasets", err);
    }
  };

  // --- API CALLS ---
  const loadGroups = async () => {
    const res = await fetch("/api/v1/groups");
    if (res.ok) setGroups(await res.json());
  };

  const loadExpenses = async () => {
    const res = await fetch("/api/v1/expenses");
    if (res.ok) setExpenses(await res.json());
  };

  const loadSettlements = async () => {
    const res = await fetch("/api/v1/settlements");
    if (res.ok) setSettlements(await res.json());
  };

  const loadBalances = async () => {
    const res = await fetch("/api/v1/balances");
    if (res.ok) setBalances(await res.json());
  };

  const loadFriends = async () => {
    const res = await fetch("/api/v1/auth/friends/list");
    if (res.ok) setFriends(await res.json());
  };

  const loadFriendRequests = async () => {
    const res = await fetch("/api/v1/auth/friends/requests");
    if (res.ok) setFriendRequests(await res.json());
  };

  const loadBlockedUsers = async () => {
    const res = await fetch("/api/v1/auth/friends/blocked");
    if (res.ok) setBlockedUsers(await res.json());
  };

  const loadNotificationSettings = async () => {
    const res = await fetch("/api/v1/settings");
    if (res.ok) {
      const data = await res.json();
      setNotificationsEnabled(data.notifications_enabled);
    }
  };

  const loadGroupDetails = async (groupId: string) => {
    try {
      const gRes = await fetch(`/api/v1/groups/${groupId}`);
      if (!gRes.ok) throw new Error("Failed to load group metadata");
      const groupData = await gRes.json();
      setSelectedGroup(groupData);

      const [balRes, expRes, setRes] = await Promise.all([
        fetch(`/api/v1/balances?group_id=${groupId}`),
        fetch(`/api/v1/expenses?group_id=${groupId}`),
        fetch(`/api/v1/settlements?group_id=${groupId}`),
      ]);

      if (balRes.ok) setSelectedGroupBalances(await balRes.json());
      if (expRes.ok) setSelectedGroupExpenses(await expRes.json());
      if (setRes.ok) setSelectedGroupSettlements(await setRes.json());
    } catch (err) {
      setAlertType("error");
      setAlertMessage("Failed to load group details.");
    }
  };

  // --- MUTATIONS ---
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/profile/change-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Name updated successfully!");
        await refreshStatus();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to update name.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/profile/change-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: editAvatarUrl }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Avatar updated successfully!");
        await refreshStatus();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to update avatar.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/profile/change-email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_email: newEmailAddress }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Verification code has been dispatched. Check auth-service console.");
        setShowEmailChangeVerify(true);
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to initiate email change.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/profile/change-email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: emailChangeVerifyCode }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Email changed successfully!");
        setShowEmailChangeVerify(false);
        setNewEmailAddress("");
        setEmailChangeVerifyCode("");
        await refreshStatus();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to verify email change.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateNotificationToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications_enabled: enabled }),
      });
    } catch (err) {
      console.error("Failed to update notification settings", err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    const emailsList = newGroupMembersText
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName.trim(),
          members: emailsList,
        }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Group created successfully!");
        setNewGroupName("");
        setNewGroupMembersText("");
        setShowCreateGroupModal(false);
        await loadGroups();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to create group.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;

    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAlertType("warning");
      setAlertMessage("Please input a positive number amount.");
      return;
    }

    // Prepare splits list
    let splitsPayload: ExpenseSplit[] = [];

    if (expenseGroupId) {
      // Find members of selected group
      const grp = groups.find((g) => g.id === expenseGroupId);
      if (!grp) return;

      if (expenseSplitType === "equal") {
        const splitAmount = amountNum / grp.members.length;
        splitsPayload = grp.members.map((m) => ({
          user_id: m.user_id,
          user_email: m.user_email,
          amount: parseFloat(splitAmount.toFixed(2)),
        }));
        
        // Correct float remainder
        const sum = splitsPayload.reduce((acc, current) => acc + current.amount, 0);
        const diff = amountNum - sum;
        if (Math.abs(diff) > 0.001 && splitsPayload.length > 0) {
          splitsPayload[0].amount = parseFloat((splitsPayload[0].amount + diff).toFixed(2));
        }
      } else {
        // Custom Split
        let totalCustomSum = 0;
        for (const m of grp.members) {
          const mAmount = parseFloat(expenseSplits[m.user_email] || "0");
          totalCustomSum += mAmount;
          splitsPayload.push({
            user_id: m.user_id,
            user_email: m.user_email,
            amount: mAmount,
          });
        }
        if (Math.abs(totalCustomSum - amountNum) > 0.01) {
          setAlertType("warning");
          setAlertMessage(`Total custom splits ($${totalCustomSum.toFixed(2)}) must sum up exactly to the total expense amount ($${amountNum.toFixed(2)}).`);
          return;
        }
      }
    } else {
      // P2P split
      if (!selectedP2PFriendEmail) {
        setAlertType("warning");
        setAlertMessage("Please select a friend to split the expense with.");
        return;
      }

      const p2pFriend = friends.find((f) => f.email === selectedP2PFriendEmail);
      if (!p2pFriend) return;

      const membersList = [
        { user_id: user?.userId || "", user_email: user?.email || "" },
        { user_id: p2pFriend.user_id, user_email: p2pFriend.email },
      ];

      if (expenseSplitType === "equal") {
        const splitAmount = amountNum / 2;
        splitsPayload = membersList.map((m) => ({
          user_id: m.user_id,
          user_email: m.user_email,
          amount: parseFloat(splitAmount.toFixed(2)),
        }));
        // correct float remainder
        const sum = splitsPayload.reduce((acc, curr) => acc + curr.amount, 0);
        const diff = amountNum - sum;
        if (Math.abs(diff) > 0.001) {
          splitsPayload[0].amount = parseFloat((splitsPayload[0].amount + diff).toFixed(2));
        }
      } else {
        let totalCustomSum = 0;
        for (const m of membersList) {
          const mAmount = parseFloat(expenseSplits[m.user_email] || "0");
          totalCustomSum += mAmount;
          splitsPayload.push({
            user_id: m.user_id,
            user_email: m.user_email,
            amount: mAmount,
          });
        }
        if (Math.abs(totalCustomSum - amountNum) > 0.01) {
          setAlertType("warning");
          setAlertMessage(`Splits sum ($${totalCustomSum.toFixed(2)}) does not equal total amount ($${amountNum.toFixed(2)}).`);
          return;
        }
      }
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: expenseGroupId || null,
          description: expenseDesc.trim(),
          amount: amountNum,
          splits: splitsPayload,
        }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Expense recorded successfully!");
        setExpenseDesc("");
        setExpenseAmount("");
        setExpenseGroupId("");
        setSelectedP2PFriendEmail("");
        setExpenseSplits({});
        setShowCreateExpenseModal(false);
        await loadAllData();
        if (selectedGroup) {
          await loadGroupDetails(selectedGroup.id);
        }
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to log expense.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount || !editingExpenseId) return;

    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAlertType("warning");
      setAlertMessage("Please enter a positive amount.");
      return;
    }

    let splitsPayload: ExpenseSplit[] = [];
    const expenseObject = expenses.find((ex) => ex.id === editingExpenseId);
    if (!expenseObject) return;

    if (expenseObject.group_id) {
      const grp = groups.find((g) => g.id === expenseObject.group_id);
      if (!grp) return;

      if (expenseSplitType === "equal") {
        const splitAmount = amountNum / grp.members.length;
        splitsPayload = grp.members.map((m) => ({
          user_id: m.user_id,
          user_email: m.user_email,
          amount: parseFloat(splitAmount.toFixed(2)),
        }));
        // correct float remainder
        const sum = splitsPayload.reduce((acc, curr) => acc + curr.amount, 0);
        const diff = amountNum - sum;
        if (Math.abs(diff) > 0.001 && splitsPayload.length > 0) {
          splitsPayload[0].amount = parseFloat((splitsPayload[0].amount + diff).toFixed(2));
        }
      } else {
        let totalCustomSum = 0;
        for (const m of grp.members) {
          const mAmount = parseFloat(expenseSplits[m.user_email] || "0");
          totalCustomSum += mAmount;
          splitsPayload.push({
            user_id: m.user_id,
            user_email: m.user_email,
            amount: mAmount,
          });
        }
        if (Math.abs(totalCustomSum - amountNum) > 0.01) {
          setAlertType("warning");
          setAlertMessage(`Total custom splits sum ($${totalCustomSum.toFixed(2)}) must sum up exactly to the total expense amount ($${amountNum.toFixed(2)}).`);
          return;
        }
      }
    } else {
      // P2P
      const originalFriend = expenseObject.splits.find((s) => s.user_email !== user?.email);
      if (!originalFriend) return;

      const membersList = [
        { user_id: user?.userId || "", user_email: user?.email || "" },
        { user_id: originalFriend.user_id, user_email: originalFriend.user_email },
      ];

      if (expenseSplitType === "equal") {
        const splitAmount = amountNum / 2;
        splitsPayload = membersList.map((m) => ({
          user_id: m.user_id,
          user_email: m.user_email,
          amount: parseFloat(splitAmount.toFixed(2)),
        }));
        const sum = splitsPayload.reduce((acc, curr) => acc + curr.amount, 0);
        const diff = amountNum - sum;
        if (Math.abs(diff) > 0.001) {
          splitsPayload[0].amount = parseFloat((splitsPayload[0].amount + diff).toFixed(2));
        }
      } else {
        let totalCustomSum = 0;
        for (const m of membersList) {
          const mAmount = parseFloat(expenseSplits[m.user_email] || "0");
          totalCustomSum += mAmount;
          splitsPayload.push({
            user_id: m.user_id,
            user_email: m.user_email,
            amount: mAmount,
          });
        }
        if (Math.abs(totalCustomSum - amountNum) > 0.01) {
          setAlertType("warning");
          setAlertMessage(`Splits sum ($${totalCustomSum.toFixed(2)}) does not equal total amount ($${amountNum.toFixed(2)}).`);
          return;
        }
      }
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/expenses/${editingExpenseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: expenseObject.group_id || null,
          description: expenseDesc.trim(),
          amount: amountNum,
          splits: splitsPayload,
        }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Expense updated successfully!");
        setExpenseDesc("");
        setExpenseAmount("");
        setEditingExpenseId("");
        setExpenseSplits({});
        setShowEditExpenseModal(false);
        await loadAllData();
        if (selectedGroup) {
          await loadGroupDetails(selectedGroup.id);
        }
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to update expense.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Expense deleted successfully.");
        await loadAllData();
        if (selectedGroup) {
          await loadGroupDetails(selectedGroup.id);
        }
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to delete expense.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementPayeeEmail || !settlementAmount) return;

    const amountNum = parseFloat(settlementAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAlertType("warning");
      setAlertMessage("Please enter a positive settlement amount.");
      return;
    }

    // Resolve payee UserID
    let payeeId = "";
    // Check friends
    const friendObj = friends.find((f) => f.email === settlementPayeeEmail);
    if (friendObj) {
      payeeId = friendObj.user_id;
    } else if (selectedGroup) {
      // Check group members
      const memObj = selectedGroup.members.find((m) => m.user_email === settlementPayeeEmail);
      if (memObj) payeeId = memObj.user_id;
    }

    if (!payeeId) {
      // Fallback: search balances or settings
      const balObj = balances.find((b) => b.user_email === settlementPayeeEmail);
      if (balObj) payeeId = balObj.user_id;
    }

    if (!payeeId) {
      setAlertType("warning");
      setAlertMessage("Could not resolve Payee Identifier. Ensure they are a group member or friend.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: settlementGroupId || null,
          payee_id: payeeId,
          payee_email: settlementPayeeEmail,
          amount: amountNum,
        }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Settlement recorded successfully!");
        setSettlementGroupId("");
        setSettlementPayeeEmail("");
        setSettlementAmount("");
        setShowCreateSettlementModal(false);
        await loadAllData();
        if (selectedGroup) {
          await loadGroupDetails(selectedGroup.id);
        }
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to record settlement.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- FRIENDS & BLOCKING HANDLERS ---
  const handleSearchFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = friendSearchQuery.trim();
    if (!query) return;

    setFriendSearchLoading(true);
    setFriendSearchError("");
    setFriendSearchResult(null);

    try {
      const res = await fetch(`/api/v1/auth/friends/search?email=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setFriendSearchResult(data);
      } else if (res.status === 404) {
        setFriendSearchError("User not found or privacy restrictions prevent finding them.");
      } else {
        setFriendSearchError(await res.text() || "Failed to search friend.");
      }
    } catch {
      setFriendSearchError("Network error during search.");
    } finally {
      setFriendSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (email: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_email: email }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Friend request dispatched successfully!");
        setFriendSearchResult(null);
        setFriendSearchQuery("");
        await loadFriendRequests();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to send friend request.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Friend invitation accepted.");
        await loadFriendRequests();
        await loadFriends();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to accept friend request.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      if (res.ok) {
        setAlertType("info");
        setAlertMessage("Friend request declined.");
        await loadFriendRequests();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to reject friend request.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!confirm("Are you sure you want to block this user? Friendship relations will be severed.")) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("User blocked successfully.");
        await loadFriends();
        await loadBlockedUsers();
        await loadFriendRequests();
        await loadBalances();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to block user.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/friends/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("User unblocked successfully.");
        await loadBlockedUsers();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to unblock user.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- MFA SETTINGS PARAMS ---
  const handleInitiateTotp = async () => {
    setAlertMessage("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/totp/setup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTotpSecret(data.secret);
        setTotpUri(data.otpauth_url);
        setShowTotpSetup(true);
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to initiate TOTP setup.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode.trim() }),
      });

      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Authenticator MFA active!");
        setShowTotpSetup(false);
        setTotpCode("");
        await refreshStatus();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Invalid code. Validation failed.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!confirm("Disable Authenticator MFA?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/totp/disable", { method: "POST" });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Authenticator MFA disabled.");
        await refreshStatus();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to disable.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitiateEmailMfa = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/email/setup", { method: "POST" });
      if (res.ok) {
        setShowEmailSetup(true);
        setAlertType("success");
        setAlertMessage("Confirmation challenge sent to your email.");
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to send setup challenge.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableEmailMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailCode.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/email/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: emailCode.trim() }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Email MFA active!");
        setShowEmailSetup(false);
        setEmailCode("");
        await refreshStatus();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Invalid code.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableEmailMfa = async () => {
    if (!confirm("Disable Email MFA?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/email/disable", { method: "POST" });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Email MFA disabled.");
        await refreshStatus();
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to disable.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setAlertType("warning");
      setAlertMessage("New passwords do not match.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      if (res.ok) {
        setAlertType("success");
        setAlertMessage("Password updated successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setAlertType("error");
        setAlertMessage(await res.text() || "Failed to change password.");
      }
    } catch {
      setAlertType("error");
      setAlertMessage("Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- SUB-RENDERS FOR TABBED VIEW ---

  const renderOverview = () => {
    const owedSum = balances.filter((b) => b.balance > 0).reduce((sum, b) => sum + b.balance, 0);
    const owesSum = Math.abs(balances.filter((b) => b.balance < 0).reduce((sum, b) => sum + b.balance, 0));
    const netSum = owedSum - owesSum;

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Balance Cards Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Net Balance</span>
            <span className={`text-3xl font-black mt-2 font-mono ${netSum >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {netSum >= 0 ? `+$${netSum.toFixed(2)}` : `-$${Math.abs(netSum).toFixed(2)}`}
            </span>
          </div>
          <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">You are owed</span>
            <span className="text-3xl font-black mt-2 font-mono text-emerald-400">
              ${owedSum.toFixed(2)}
            </span>
          </div>
          <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">You owe</span>
            <span className="text-3xl font-black mt-2 font-mono text-rose-400">
              ${owesSum.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Quick Actions Buttons */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => {
              setExpenseGroupId("");
              setExpenseDesc("");
              setExpenseAmount("");
              setExpenseSplits({});
              setExpenseSplitType("equal");
              setShowCreateExpenseModal(true);
            }}
            className="px-5 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
          >
            <IconPlus /> Add Expense
          </button>
          <button
            onClick={() => {
              setSettlementGroupId("");
              setSettlementPayeeEmail("");
              setSettlementAmount("");
              setShowCreateSettlementModal(true);
            }}
            className="px-5 py-3 rounded-xl text-xs font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 transition-all cursor-pointer"
          >
            Record Settlement
          </button>
          <button
            onClick={() => {
              setNewGroupName("");
              setNewGroupMembersText("");
              setShowCreateGroupModal(true);
            }}
            className="px-5 py-3 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-white/5 border border-white/10 transition-all cursor-pointer"
          >
            Create Group
          </button>
        </div>

        {/* Peer Debts Splits List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-panel p-6 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3 mb-4">
              Balances Breakdown
            </h3>
            {balances.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No outstanding balances with friends.</p>
            ) : (
              <div className="space-y-4">
                {balances.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                    <div>
                      <span className="block text-xs font-bold text-white truncate max-w-[200px]">{b.user_email}</span>
                      <span className={`text-xs font-semibold font-mono mt-0.5 block ${b.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {b.balance >= 0 ? `owes you $${b.balance.toFixed(2)}` : `you owe them $${Math.abs(b.balance).toFixed(2)}`}
                      </span>
                    </div>

                    {b.balance < 0 && (
                      <button
                        onClick={() => {
                          setSettlementGroupId("");
                          setSettlementPayeeEmail(b.user_email);
                          setSettlementAmount(Math.abs(b.balance).toString());
                          setShowCreateSettlementModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                      >
                        Settle Up
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Expenses List */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3 mb-4">
              Recent Shared Bills
            </h3>
            {expenses.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No logged transactions found.</p>
            ) : (
              <div className="space-y-4">
                {expenses.slice(0, 5).map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                    <div className="truncate pr-4">
                      <span className="block text-xs font-bold text-white truncate">{ex.description}</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">
                        Paid by <span className="font-semibold">{ex.payer_email === user?.email ? "You" : ex.payer_email}</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold font-mono text-white flex-shrink-0">
                      ${ex.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroups = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-300">
        {/* Left Side Groups List */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 h-fit space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Groups</h3>
            <button
              onClick={() => {
                setNewGroupName("");
                setNewGroupMembersText("");
                setShowCreateGroupModal(true);
              }}
              className="p-1 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all cursor-pointer"
            >
              <IconPlus />
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">No groups created yet.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => loadGroupDetails(g.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer block truncate ${
                    selectedGroup?.id === g.id
                      ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-300"
                      : "bg-zinc-950/20 border-white/5 text-zinc-300 hover:border-zinc-700/50 hover:bg-zinc-950/45"
                  }`}
                >
                  {g.name}
                  <span className="block text-[10px] font-normal text-zinc-500 mt-1">
                    {g.members.length} members
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side Group Details Panel */}
        <div className="md:col-span-2 space-y-6">
          {!selectedGroup ? (
            <div className="glass-panel p-12 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
              <span className="text-3xl mb-2">👥</span>
              <h4 className="text-sm font-bold text-zinc-300">Select a group</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-normal">
                Choose a shared group from the sidebar to inspect member balances, group splits, and settlements.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Group Banner */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{selectedGroup.name}</h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-normal">
                    Formed on {new Date(selectedGroup.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setExpenseGroupId(selectedGroup.id);
                      setExpenseDesc("");
                      setExpenseAmount("");
                      setExpenseSplits({});
                      setExpenseSplitType("equal");
                      setShowCreateExpenseModal(true);
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconPlus /> Add Bill
                  </button>
                  <button
                    onClick={() => {
                      setSettlementGroupId(selectedGroup.id);
                      setSettlementPayeeEmail("");
                      setSettlementAmount("");
                      setShowCreateSettlementModal(true);
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 cursor-pointer"
                  >
                    Settle Debt
                  </button>
                </div>
              </div>

              {/* Group Balances Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Members List */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2 mb-3">
                    Members ({selectedGroup.members.length})
                  </h3>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {selectedGroup.members.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-transparent">
                        <span className="text-zinc-300 truncate max-w-[150px]">{m.user_email}</span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(m.joined_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group Balances */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2 mb-3">
                    Group Net Balances
                  </h3>
                  {selectedGroupBalances.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3">Group balances are even.</p>
                  ) : (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {selectedGroupBalances.map((b, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1.5">
                          <span className="text-zinc-300 truncate max-w-[150px]">{b.user_email}</span>
                          <span className={`font-semibold font-mono ${b.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {b.balance >= 0 ? `+ $${b.balance.toFixed(2)}` : `- $${Math.abs(b.balance).toFixed(2)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Group Expenses List */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3 mb-4">
                  Group Expenses Logs
                </h3>
                {selectedGroupExpenses.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">No group expenses logged yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {selectedGroupExpenses.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                        <div>
                          <span className="block text-xs font-bold text-white">{ex.description}</span>
                          <span className="text-[10px] text-zinc-500 mt-0.5 block">
                            Paid by <span className="font-semibold">{ex.payer_email}</span> on {new Date(ex.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold font-mono text-white">${ex.amount.toFixed(2)}</span>
                          
                          {ex.payer_email === user?.email && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingExpenseId(ex.id);
                                  setExpenseDesc(ex.description);
                                  setExpenseAmount(ex.amount.toString());
                                  setExpenseSplitType("custom");
                                  
                                  const splitsMap: { [email: string]: string } = {};
                                  ex.splits.forEach((s) => {
                                    splitsMap[s.user_email] = s.amount.toString();
                                  });
                                  setExpenseSplits(splitsMap);
                                  setShowEditExpenseModal(true);
                                }}
                                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/50 cursor-pointer"
                              >
                                <IconEdit />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(ex.id)}
                                className="p-1 rounded bg-rose-950/20 text-rose-400 hover:text-rose-200 border border-rose-900/30 cursor-pointer"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Group Settlements List */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3 mb-4">
                  Group Settlements Logs
                </h3>
                {selectedGroupSettlements.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">No group settlements recorded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {selectedGroupSettlements.map((set) => (
                      <div key={set.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                        <div className="text-xs">
                          <span className="text-indigo-300 font-semibold">{set.payer_email}</span> settled to{" "}
                          <span className="text-pink-300 font-semibold">{set.payee_email}</span>
                          <span className="block text-[10px] text-zinc-500 mt-0.5">
                            {new Date(set.created_at).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono text-emerald-400">
                          ${set.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExpenses = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">All Expenses Logs</h2>
          <button
            onClick={() => {
              setExpenseGroupId("");
              setExpenseDesc("");
              setExpenseAmount("");
              setExpenseSplits({});
              setExpenseSplitType("equal");
              setShowCreateExpenseModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <IconPlus /> Log Expense
          </button>
        </div>

        {expenses.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl border border-white/5 text-center">
            <p className="text-xs text-zinc-500">No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {expenses.map((ex) => (
              <div key={ex.id} className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">{ex.description}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                    <span>
                      Paid by <span className="font-semibold text-zinc-300">{ex.payer_email === user?.email ? "You" : ex.payer_email}</span>
                    </span>
                    {ex.group_id && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="bg-indigo-950/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-900/30 font-semibold text-[10px]">
                          Group: {groups.find((g) => g.id === ex.group_id)?.name || "Group Shared"}
                        </span>
                      </>
                    )}
                    <span className="text-zinc-600">•</span>
                    <span>{new Date(ex.created_at).toLocaleString()}</span>
                  </div>

                  {/* Splits breakdown list */}
                  <div className="pt-2 flex flex-wrap gap-2">
                    {ex.splits.map((s, sidx) => (
                      <span key={sidx} className="text-[10px] bg-zinc-950/30 border border-white/5 text-zinc-400 px-2 py-0.5 rounded-md font-mono">
                        {s.user_email === user?.email ? "you" : s.user_email.split("@")[0]}: ${s.amount.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-sm font-bold text-white font-mono">${ex.amount.toFixed(2)}</span>
                  </div>

                  {ex.payer_email === user?.email && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setEditingExpenseId(ex.id);
                          setExpenseDesc(ex.description);
                          setExpenseAmount(ex.amount.toString());
                          setExpenseSplitType("custom");
                          
                          const splitsMap: { [email: string]: string } = {};
                          ex.splits.forEach((s) => {
                            splitsMap[s.user_email] = s.amount.toString();
                          });
                          setExpenseSplits(splitsMap);
                          setShowEditExpenseModal(true);
                        }}
                        className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/50 cursor-pointer"
                      >
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(ex.id)}
                        className="p-1.5 rounded bg-rose-950/20 text-rose-400 hover:text-rose-200 border border-rose-900/30 cursor-pointer"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSettlements = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Payments & Settlements History</h2>
          <button
            onClick={() => {
              setSettlementGroupId("");
              setSettlementPayeeEmail("");
              setSettlementAmount("");
              setShowCreateSettlementModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <IconPlus /> Record Settlement
          </button>
        </div>

        {settlements.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl border border-white/5 text-center">
            <p className="text-xs text-zinc-500">No recorded settlements.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {settlements.map((set) => (
              <div key={set.id} className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white">
                    <span className="text-indigo-400 font-semibold">{set.payer_email === user?.email ? "You" : set.payer_email}</span> paid{" "}
                    <span className="text-pink-400 font-semibold">{set.payee_email === user?.email ? "you" : set.payee_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    {set.group_id && (
                      <span className="bg-indigo-950/20 text-indigo-400 px-1 rounded border border-indigo-900/30">
                        Group
                      </span>
                    )}
                    <span>{new Date(set.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  ${set.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFriends = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-300">
        {/* Friend Requests & Search column */}
        <div className="space-y-6">
          {/* Add Friend Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              Find Friends
            </h3>
            
            <form onSubmit={handleSearchFriend} className="flex gap-2">
              <input
                type="email"
                required
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                placeholder="search by email..."
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                type="submit"
                disabled={friendSearchLoading}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                Search
              </button>
            </form>

            {friendSearchError && <p className="text-[11px] text-rose-400">{friendSearchError}</p>}

            {friendSearchResult && (
              <div className="p-3 rounded-xl bg-zinc-950/40 border border-white/5 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
                <div className="truncate pr-2">
                  <span className="block font-bold text-white truncate">{friendSearchResult.name || "Default Display Name"}</span>
                  <span className="text-[10px] text-zinc-400 block truncate">{friendSearchResult.email}</span>
                </div>
                <button
                  onClick={() => handleSendFriendRequest(friendSearchResult.email)}
                  disabled={actionLoading}
                  className="px-2.5 py-1 rounded text-[10px] font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 cursor-pointer flex-shrink-0"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Pending Requests Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              Friend Invites
            </h3>
            
            {friendRequests.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-2">No pending invitations.</p>
            ) : (
              <div className="space-y-3">
                {friendRequests.map((req) => (
                  <div key={req.id} className="p-3 rounded-xl bg-zinc-950/20 border border-white/5 space-y-2 text-xs">
                    <span className="block text-zinc-300 font-medium truncate">{req.sender_email}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptFriendRequest(req.id)}
                        disabled={actionLoading}
                        className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectFriendRequest(req.id)}
                        disabled={actionLoading}
                        className="flex-1 py-1 rounded text-[10px] font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Friends List Column */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
            Active Friends
          </h3>
          
          {friends.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">Your friend list is currently empty.</p>
          ) : (
            <div className="space-y-3">
              {friends.map((f) => (
                <div key={f.user_id} className="p-3 rounded-xl bg-zinc-950/20 border border-white/5 flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <span className="block font-bold text-white truncate">{f.name || "Default Friend Name"}</span>
                    <span className="text-[10px] text-zinc-500 block truncate">{f.email}</span>
                  </div>
                  <button
                    onClick={() => handleBlockUser(f.user_id)}
                    disabled={actionLoading}
                    className="px-2 py-1 rounded text-[10px] font-semibold text-rose-300 hover:text-white bg-rose-950/20 border border-rose-500/20 transition-all cursor-pointer"
                  >
                    Block
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocked Users Column */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
            Blocked Users
          </h3>
          
          {blockedUsers.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No blocked profiles.</p>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((b) => (
                <div key={b.user_id} className="p-3 rounded-xl bg-zinc-950/20 border border-white/5 flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium truncate pr-2">{b.email}</span>
                  <button
                    onClick={() => handleUnblockUser(b.user_id)}
                    disabled={actionLoading}
                    className="px-2 py-1 rounded text-[10px] font-semibold text-zinc-400 hover:text-white bg-zinc-800 border border-zinc-700 cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-300">
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6 h-fit">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
            Profile Information
          </h3>

          {/* Edit Display Name */}
          <form onSubmit={handleUpdateName} className="space-y-3">
            <div>
              <label htmlFor="display-name" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
            >
              Save Name
            </button>
          </form>

          {/* Edit Avatar URL */}
          <form onSubmit={handleUpdateAvatar} className="space-y-3 pt-3 border-t border-white/5">
            <div>
              <label htmlFor="avatar-url" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Avatar Image URL
              </label>
              <input
                id="avatar-url"
                type="url"
                required
                value={editAvatarUrl}
                onChange={(e) => setEditAvatarUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
            >
              Save Avatar URL
            </button>
          </form>

          {/* Email Update */}
          <div className="pt-3 border-t border-white/5 space-y-3">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Change Email</h4>
            {!showEmailChangeVerify ? (
              <form onSubmit={handleRequestEmailChange} className="space-y-3">
                <input
                  type="email"
                  required
                  value={newEmailAddress}
                  onChange={(e) => setNewEmailAddress(e.target.value)}
                  placeholder="newemail@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  Send OTP Code
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailChange} className="space-y-3">
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 mb-2">
                  Check console logs of Go <code className="text-indigo-300">auth-service</code> for 6-digit update confirmation code.
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={emailChangeVerifyCode}
                  onChange={(e) => setEmailChangeVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white tracking-widest font-mono text-center focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  Verify & Change Email
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailChangeVerify(false)}
                  className="w-full text-center text-[10px] text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Security & MFA configs */}
        <div className="md:col-span-2 space-y-6">
          {/* Notifications Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Notification Alert Settings</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Toggle shared billing updates notifications enabled/disabled.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => handleUpdateNotificationToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
              </label>
            </div>
          </div>

          {/* Authenticator Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Google Authenticator MFA (TOTP)</h3>
                <p className="text-xs text-zinc-400 mt-0.5 font-medium">Verify logins with rotative codes.</p>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${user?.totpEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"}`}>
                {user?.totpEnabled ? "Active" : "Inactive"}
              </span>
            </div>

            {user?.totpEnabled ? (
              <button
                onClick={handleDisableTotp}
                disabled={actionLoading}
                className="px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/20 hover:bg-rose-600 border border-rose-500/20 hover:border-transparent rounded-lg transition-all cursor-pointer"
              >
                Disable Authenticator
              </button>
            ) : (
              <>
                {!showTotpSetup ? (
                  <button
                    onClick={handleInitiateTotp}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md cursor-pointer"
                  >
                    Configure Authenticator
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-zinc-400 leading-normal">
                      Scan QR code or enter secret manually:
                    </p>
                    <div className="flex flex-col items-center justify-center p-3 rounded bg-white max-w-[170px] mx-auto">
                      {qrCodeDataUrl ? (
                        <img src={qrCodeDataUrl} alt="QR Code" className="w-32 h-32" />
                      ) : (
                        <span className="text-[10px] text-zinc-700">QR Generating...</span>
                      )}
                    </div>
                    <div className="text-xs bg-zinc-900 border border-zinc-800 p-2 rounded text-center select-all font-mono font-bold text-white">
                      {totpSecret}
                    </div>

                    <form onSubmit={handleEnableTotp} className="flex gap-2">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-center font-mono text-white placeholder-zinc-500"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                      >
                        Enable
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTotpSetup(false)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Email MFA setup card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Email MFA Verification</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Receive verification codes in your inbox.</p>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${user?.emailMfaEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"}`}>
                {user?.emailMfaEnabled ? "Active" : "Inactive"}
              </span>
            </div>

            {user?.emailMfaEnabled ? (
              <button
                onClick={handleDisableEmailMfa}
                disabled={actionLoading}
                className="px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/20 hover:bg-rose-600 border border-rose-500/20 hover:border-transparent rounded-lg transition-all cursor-pointer"
              >
                Disable Email MFA
              </button>
            ) : (
              <>
                {!showEmailSetup ? (
                  <button
                    onClick={handleInitiateEmailMfa}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md cursor-pointer"
                  >
                    Configure Email MFA
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/5 space-y-3">
                    <p className="text-xs text-zinc-400">Enter setup verification code sent to email:</p>
                    <form onSubmit={handleEnableEmailMfa} className="flex gap-2">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-center font-mono text-white placeholder-zinc-500"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                      >
                        Enable
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmailSetup(false)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Change Password Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white">Change Credentials Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="old-pass" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Old Password
                  </label>
                  <input
                    id="old-pass"
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label htmlFor="new-pass" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    id="new-pass"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-pass" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Confirm New
                  </label>
                  <input
                    id="confirm-pass"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm text-zinc-500 font-medium tracking-wide">Retrieving session state...</span>
      </div>
    );
  }

  if (!user) return null; // let useEffect redirect

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row gap-8 relative z-10">
      {/* Background gradient spot */}
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"></div>

      {/* Left Sidebar Navigation (Desktop) / Bottom/Top (Mobile) */}
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-6">
        {/* User profile brief card */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 text-white font-black flex items-center justify-center border border-white/10 flex-shrink-0 overflow-hidden">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()
            )}
          </div>
          <div className="truncate">
            <span className="block text-xs font-bold text-white truncate">
              {user.name || "Default Profile Name"}
            </span>
            <span className="block text-[10px] text-zinc-400 truncate mt-0.5">
              {user.email}
            </span>
          </div>
        </div>

        {/* Tabs navigation buttons */}
        <div className="glass-panel p-3 rounded-2xl border border-white/5 flex flex-row md:flex-col gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: "overview", label: "Overview", icon: <IconOverview /> },
            { id: "groups", label: "Groups", icon: <IconGroups /> },
            { id: "expenses", label: "Expenses", icon: <IconExpenses /> },
            { id: "settlements", label: "Settlements", icon: <IconSettlements /> },
            { id: "friends", label: "Friends", icon: <IconFriends /> },
            { id: "settings", label: "Settings", icon: <IconSettings /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide border transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-300"
                  : "bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 min-w-0">
        {alertMessage && (
          <div className="mb-6">
            <CustomAlert
              message={alertMessage}
              type={alertType as any}
              onClose={() => setAlertMessage("")}
              autoCloseDuration={alertType === "success" ? 5000 : 0}
            />
          </div>
        )}

        {activeTab === "overview" && renderOverview()}
        {activeTab === "groups" && renderGroups()}
        {activeTab === "expenses" && renderExpenses()}
        {activeTab === "settlements" && renderSettlements()}
        {activeTab === "friends" && renderFriends()}
        {activeTab === "settings" && renderSettings()}
      </div>

      {/* --- POPUPS / MODALS MODIFIERS --- */}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create Group</h3>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="text-zinc-400 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Flatmates 402"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Invited Members Emails (Comma-separated)
                </label>
                <textarea
                  rows={3}
                  value={newGroupMembersText}
                  onChange={(e) => setNewGroupMembersText(e.target.value)}
                  placeholder="sarah@example.com, david@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 cursor-pointer disabled:opacity-50"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {showCreateExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Log Expense</h3>
              <button
                onClick={() => setShowCreateExpenseModal(false)}
                className="text-zinc-400 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Group Association
                  </label>
                  <select
                    value={expenseGroupId}
                    onChange={(e) => {
                      setExpenseGroupId(e.target.value);
                      setExpenseSplits({});
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="">No Group (Peer-to-Peer)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {!expenseGroupId && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Choose Friend
                    </label>
                    <select
                      value={selectedP2PFriendEmail}
                      onChange={(e) => setSelectedP2PFriendEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                    >
                      <option value="">-- Choose friend --</option>
                      {friends.map((f) => (
                        <option key={f.user_id} value={f.email}>{f.name || f.email}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Description / Bill Name
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="e.g. Grocery dinner shopping"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Total Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="120.00"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Split type choosing */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Split Configuration
                </label>
                <div className="flex gap-4 text-xs mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={expenseSplitType === "equal"}
                      onChange={() => setExpenseSplitType("equal")}
                    />
                    Split Equally
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={expenseSplitType === "custom"}
                      onChange={() => setExpenseSplitType("custom")}
                    />
                    Split Manually / Custom
                  </label>
                </div>
              </div>

              {/* Display list of split inputs if split custom */}
              {expenseSplitType === "custom" && (
                <div className="p-3 bg-zinc-950/40 border border-white/5 rounded-xl space-y-2 max-h-[160px] overflow-y-auto">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Custom splits amounts:
                  </span>
                  
                  {/* For Group members splits */}
                  {expenseGroupId ? (
                    groups.find((g) => g.id === expenseGroupId)?.members.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-zinc-300 truncate max-w-[200px]">{m.user_email}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={expenseSplits[m.user_email] || ""}
                          onChange={(e) => setExpenseSplits({
                            ...expenseSplits,
                            [m.user_email]: e.target.value,
                          })}
                          className="w-24 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-right text-white"
                        />
                      </div>
                    ))
                  ) : (
                    // For Peer splits
                    <>
                      <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-zinc-300">You ({user?.email})</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={expenseSplits[user?.email || ""] || ""}
                          onChange={(e) => setExpenseSplits({
                            ...expenseSplits,
                            [user?.email || ""]: e.target.value,
                          })}
                          className="w-24 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-right text-white"
                        />
                      </div>
                      {selectedP2PFriendEmail && (
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-zinc-300 truncate max-w-[200px]">{selectedP2PFriendEmail}</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={expenseSplits[selectedP2PFriendEmail] || ""}
                            onChange={(e) => setExpenseSplits({
                              ...expenseSplits,
                              [selectedP2PFriendEmail]: e.target.value,
                            })}
                            className="w-24 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-right text-white"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 cursor-pointer disabled:opacity-50"
              >
                Record Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Modify Expense</h3>
              <button
                onClick={() => {
                  setShowEditExpenseModal(false);
                  setEditingExpenseId("");
                  setExpenseSplits({});
                }}
                className="text-zinc-400 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Total Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Split type choosing */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Split Configuration
                </label>
                <div className="flex gap-4 text-xs mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={expenseSplitType === "equal"}
                      onChange={() => setExpenseSplitType("equal")}
                    />
                    Split Equally
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={expenseSplitType === "custom"}
                      onChange={() => setExpenseSplitType("custom")}
                    />
                    Split Manually / Custom
                  </label>
                </div>
              </div>

              {/* Display list of split inputs if split custom */}
              {expenseSplitType === "custom" && (
                <div className="p-3 bg-zinc-950/40 border border-white/5 rounded-xl space-y-2 max-h-[160px] overflow-y-auto">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Custom splits amounts:
                  </span>
                  
                  {expenses.find((ex) => ex.id === editingExpenseId)?.splits.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-zinc-300 truncate max-w-[200px]">{s.user_email}</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={expenseSplits[s.user_email] || ""}
                        onChange={(e) => setExpenseSplits({
                          ...expenseSplits,
                          [s.user_email]: e.target.value,
                        })}
                        className="w-24 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-right text-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 cursor-pointer disabled:opacity-50"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Record Settlement Modal */}
      {showCreateSettlementModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Record Settlement</h3>
              <button
                onClick={() => setShowCreateSettlementModal(false)}
                className="text-zinc-400 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSettlement} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Group Association (Optional)
                </label>
                <select
                  value={settlementGroupId}
                  onChange={(e) => setDynamicPayeeDropdown(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  <option value="">No Group (Direct Peer Settlement)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Recipient User / Friend Email
                </label>
                {settlementGroupId ? (
                  <select
                    value={settlementPayeeEmail}
                    onChange={(e) => setSettlementPayeeEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="">-- Choose member --</option>
                    {groups
                      .find((g) => g.id === settlementGroupId)
                      ?.members.filter((m) => m.user_email !== user?.email)
                      .map((m, idx) => (
                        <option key={idx} value={m.user_email}>{m.user_email}</option>
                      ))}
                  </select>
                ) : (
                  <select
                    value={settlementPayeeEmail}
                    onChange={(e) => setSettlementPayeeEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="">-- Choose recipient --</option>
                    {friends.map((f) => (
                      <option key={f.user_id} value={f.email}>{f.name || f.email}</option>
                    ))}
                    {/* Fallback addition of balances emails not on friends list */}
                    {balances
                      .filter((b) => !friends.some((f) => f.email === b.user_email) && b.user_email !== user?.email)
                      .map((b, idx) => (
                        <option key={idx} value={b.user_email}>{b.user_email}</option>
                      ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Settlement Amount ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 cursor-pointer disabled:opacity-50"
              >
                Submit Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function setDynamicPayeeDropdown(gId: string) {
    setSettlementGroupId(gId);
    setSettlementPayeeEmail("");
  }
}

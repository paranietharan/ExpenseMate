export interface User {
  userId: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  emailMfaEnabled: boolean;
  name?: string;
  avatarUrl?: string;
}

export interface GroupMember {
  user_id: string;
  user_email: string;
  joined_at: string;
}

export interface Group {
  id: string;
  name: string;
  created_at: string;
  members: GroupMember[];
}

export interface ExpenseSplit {
  user_id: string;
  user_email: string;
  amount: number;
}

export interface Expense {
  id: string;
  group_id?: string;
  description: string;
  amount: number;
  payer_id: string;
  payer_email: string;
  created_at: string;
  splits: ExpenseSplit[];
}

export interface Settlement {
  id: string;
  group_id?: string;
  payer_id: string;
  payer_email: string;
  payee_id: string;
  payee_email: string;
  amount: number;
  created_at: string;
}

export interface DebtBalance {
  user_id: string;
  user_email: string;
  balance: number; // Positive = user is owed by them; Negative = user owes them
}

export interface Friend {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  sender_email: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

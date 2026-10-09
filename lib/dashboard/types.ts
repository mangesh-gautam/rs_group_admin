export type Dashboard = {
  generatedAt: string;
  scope: { allOffices: boolean; officeId: number | null };
  month: string;
  summary: { totalMembers: number; totalDeposits: string; totalWithdrawals: string; totalBalance: string; totalInterest: string };
  thisMonth: { newMembers: number; deposits: string; withdrawals: string; interest: string };
  accountTypes: { daily: number; weekly: number; monthly: number };
  recentAccounts: { accountNo: string; name: string; accountType: "DAILY" | "WEEKLY" | "MONTHLY"; openingAmount: string; balance: string; createdAt: string }[];
};

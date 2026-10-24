// Jira epics and stories of the Digital Wallet project (key DW), hardcoded for the Coverage tab.
// tests / passed / coverage / quality are SAMPLE figures for the layout: nothing has been run against these tickets yet.
export type CoverageTicket = { key: string; name: string; tests: number; passed: number; coverage: number; quality: number };
export type CoverageEpic = { key: string; name: string; tickets: CoverageTicket[] };

export const COVERAGE_EPICS: CoverageEpic[] = [
  {
    key: "DW-1",
    name: "Authentication & Account",
    tickets: [
      { key: "DW-10", name: "WALLET-112: User Profile", tests: 4, passed: 3, coverage: 45, quality: 50 },
      { key: "DW-9", name: "WALLET-108: Logout", tests: 4, passed: 4, coverage: 72, quality: 74 },
      { key: "DW-8", name: "WALLET-103: Forgot Password (OTP Reset)", tests: 6, passed: 4, coverage: 52, quality: 58 },
      { key: "DW-7", name: "WALLET-102: Login", tests: 12, passed: 11, coverage: 94, quality: 92 },
      { key: "DW-6", name: "WALLET-101: User Registration", tests: 14, passed: 11, coverage: 78, quality: 80 },
    ],
  },
  {
    key: "DW-2",
    name: "KYC",
    tickets: [{ key: "DW-11", name: "WALLET-104: KYC Document Upload", tests: 9, passed: 7, coverage: 68, quality: 70 }],
  },
  {
    key: "DW-3",
    name: "Wallet & Transactions",
    tickets: [
      { key: "DW-15", name: "WALLET-142: Send Money", tests: 18, passed: 14, coverage: 74, quality: 76 },
      { key: "DW-14", name: "WALLET-107: Transaction History", tests: 9, passed: 8, coverage: 82, quality: 83 },
      { key: "DW-13", name: "WALLET-106: Add Money", tests: 8, passed: 5, coverage: 62, quality: 64 },
      { key: "DW-12", name: "WALLET-105: Wallet Dashboard", tests: 16, passed: 15, coverage: 90, quality: 91 },
    ],
  },
  {
    key: "DW-4",
    name: "Admin Console",
    tickets: [
      { key: "DW-18", name: "WALLET-111: Admin Transaction Oversight", tests: 1, passed: 1, coverage: 30, quality: 35 },
      { key: "DW-17", name: "WALLET-110: Admin User Directory", tests: 2, passed: 2, coverage: 55, quality: 60 },
      { key: "DW-16", name: "WALLET-109: Admin KYC Approvals", tests: 5, passed: 3, coverage: 38, quality: 42 },
    ],
  },
];

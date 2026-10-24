// Screens and their elements, from "Digital Wallet App — Full Specification" (section 4, Pages & Elements).
// `elements` are the items the spec lists on each page, so "page objects" is a count of real spec content.
// tests / passed / coverage / quality are SAMPLE figures for the layout: nothing has been run against these pages yet.
export type PageGroup = "Public" | "Customer" | "Admin";
export type CoveragePage = { group: PageGroup; screen: string; url: string; elements: string[]; tests: number; passed: number; coverage: number; quality: number };

export const COVERAGE_PAGES: CoveragePage[] = [
  { group: "Public", screen: "Login", url: "/login", elements: ["Mobile number input", "Password input", "Submit button", "Forgot password? link", "Link to /register"], tests: 12, passed: 11, coverage: 94, quality: 92 },
  { group: "Public", screen: "Register", url: "/register", elements: ["First name", "Last name", "Mobile number", "Password", "Confirm password", "Submit (creates user and wallet)"], tests: 14, passed: 11, coverage: 78, quality: 80 },
  { group: "Public", screen: "Forgot password", url: "/forgot-password", elements: ["Mobile / email input (request OTP)", "OTP input", "New password", "Confirm password", "Submit"], tests: 6, passed: 4, coverage: 52, quality: 58 },
  { group: "Customer", screen: "KYC upload", url: "/kyc/upload", elements: ["Document type dropdown", "File upload input (type and size validated)", "Status badge per document", "List of uploaded documents"], tests: 9, passed: 7, coverage: 68, quality: 70 },
  { group: "Customer", screen: "Dashboard", url: "/dashboard", elements: ["Wallet balance", "Wallet type", "KYC status indicator", "Quick action: Add Money", "Quick action: Send Money", "Quick action: View All Transactions", "Recent transactions (last 5)"], tests: 16, passed: 15, coverage: 90, quality: 91 },
  { group: "Customer", screen: "Wallet", url: "/wallet", elements: ["Type", "Currency", "Status", "Created date"], tests: 5, passed: 5, coverage: 85, quality: 84 },
  { group: "Customer", screen: "Add money", url: "/add-money", elements: ["Amount input", "Add Money button (Razorpay checkout)", "Success / failure state"], tests: 8, passed: 5, coverage: 62, quality: 64 },
  { group: "Customer", screen: "Send money", url: "/send-money", elements: ["Recipient mobile number input", "Recipient lookup / confirmation step", "Amount input", "Submit and confirmation dialog", "Success / failure state", "Error states (not found, insufficient balance, self-transfer, KYC not verified)"], tests: 18, passed: 14, coverage: 74, quality: 76 },
  { group: "Customer", screen: "Transactions", url: "/transactions", elements: ["Paginated table", "Date range filter", "Type filter (add money / sent / received)"], tests: 9, passed: 8, coverage: 82, quality: 83 },
  { group: "Customer", screen: "Transaction detail", url: "/transactions/[id]", elements: ["Amount and status", "Timestamps", "Reference / gateway IDs", "Ledger entries involved", "Back to list"], tests: 6, passed: 5, coverage: 70, quality: 72 },
  { group: "Customer", screen: "Profile", url: "/profile", elements: ["User details", "KYC status", "Logout"], tests: 4, passed: 3, coverage: 45, quality: 50 },
  { group: "Admin", screen: "KYC approvals", url: "/admin/kyc-approvals", elements: ["Pending KYC documents list", "Approve / reject actions"], tests: 5, passed: 3, coverage: 38, quality: 42 },
  { group: "Admin", screen: "Users", url: "/admin/users", elements: ["Read-only user list with KYC and wallet status"], tests: 2, passed: 2, coverage: 55, quality: 60 },
  { group: "Admin", screen: "All transactions", url: "/admin/transactions", elements: ["Read-only list of every transaction"], tests: 1, passed: 1, coverage: 30, quality: 35 },
];

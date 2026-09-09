import "./globals.css";
import "./auth/style.scss";
import { dm_sans } from "./config/fonts";
import ToastProvider from "./lib/toastify";
import AuthProvider from "./lib/provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <title>AI Accelerators - ProTest</title>
      <body
        suppressHydrationWarning
        className={`${dm_sans.className} antialiased`}
      >
        <AuthProvider>
          <ToastProvider />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

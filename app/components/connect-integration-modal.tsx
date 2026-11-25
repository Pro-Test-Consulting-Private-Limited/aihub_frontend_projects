"use client";

import { useState, type CSSProperties } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import Modal from "./modal";

type Provider = "jira" | "github" | "swagger" | "figma";

export default function ConnectIntegrationModal({
  provider,
  onClose,
  onConnected,
}: {
  provider: Provider | null;
  onClose: () => void;
  onConnected: (
    provider: Provider,
    meta?: {
      title?: string;
      specUrl?: string;
      username?: string;
      siteName?: string;
      handle?: string;
      email?: string;
      userId?: string;
    },
  ) => void;
}) {
  const [siteUrl, setSiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [githubOrgUrl, setGithubOrgUrl] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [swaggerToken, setSwaggerToken] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [showFigmaToken, setShowFigmaToken] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const title =
    provider === "jira"
      ? "Connect Jira"
      : provider === "github"
        ? "Connect GitHub"
        : provider === "figma"
          ? "Connect Figma"
          : "Connect Swagger";

  const handleSubmit = async () => {
    if (!provider) return;
    setError("");
    setSaving(true);
    try {
      if (provider === "github") {
        const org = githubOrgUrl.trim();
        if (!org) {
          setError("Enter your GitHub organization URL.");
          return;
        }
        window.location.href = `/api/auth/github/authorize?org=${encodeURIComponent(org)}&returnTo=${encodeURIComponent("/integrations")}`;
        return;
      }

      const body =
        provider === "jira"
          ? { siteUrl, email, apiToken }
          : provider === "figma"
            ? { accessToken: figmaToken }
            : { specUrl, token: swaggerToken || undefined };

      const res = await fetch(`/api/auth/${provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not connect. Check your details and try again.");
        return;
      }

      onConnected(provider, {
        title: data.title,
        specUrl: data.specUrl,
        username: data.username,
        siteName: data.siteName,
        handle: data.handle,
        email: data.email,
        userId: data.userId,
      });
      onClose();
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(provider)}
      onClose={onClose}
      title={title}
      modalStyle="w-[440px] dark:bg-[#141414]"
    >
      <p className="text-[13px] text-[#7E7E7E] dark:text-[#9ca3af] mb-4">
        {provider === "jira"
          ? "Use your Jira Cloud site, Atlassian email, and an API token. The app will verify the account and mark Jira as connected."
          : provider === "github"
            ? "Enter your GitHub organization URL, then continue to sign in with GitHub."
            : provider === "figma"
              ? "Paste a Figma personal access token. We verify it against your Figma account and mark Figma as connected on Integrations."
              : "Paste an OpenAPI / Swagger JSON or YAML URL. Swagger UI pages like /docs are OK — we'll resolve the JSON. Add a bearer token only if the spec is private."}
      </p>

      {provider === "jira" ? (
        <div className="flex flex-col gap-3">
          <label className="text-[12px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
            Jira site URL
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://your-site.atlassian.net"
              className="mt-1 w-full h-[38px] px-3 rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-[13px] outline-none"
            />
          </label>
          <label className="text-[12px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 w-full h-[38px] px-3 rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-[13px] outline-none"
            />
          </label>
          <label className="text-[12px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
            API token
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Jira API token"
              className="mt-1 w-full h-[38px] px-3 rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-[13px] outline-none"
            />
          </label>
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-[#2684FF]"
          >
            Create a Jira API token
          </a>
        </div>
      ) : provider === "github" ? (
        <div className="flex flex-col gap-3">
          <label className="text-[12px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
            GitHub organization URL
            <input
              value={githubOrgUrl}
              onChange={(e) => setGithubOrgUrl(e.target.value)}
              placeholder="https://github.com/organizations/Pro-Test-Consulting-Private-Limited"
              className="mt-1 w-full h-[38px] px-3 rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-[13px] outline-none"
            />
          </label>
          <p className="text-[12px] text-[#7E7E7E] dark:text-[#9ca3af]">
            Example: https://github.com/Pro-Test-Consulting-Private-Limited
          </p>
        </div>
      ) : provider === "figma" ? (
        <div className="flex flex-col gap-3">
          <label className="text-[12px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
            Personal access token
            <div className="relative mt-1">
              <input
                type="text"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                placeholder="figd_…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                // text + disc mask: avoids Edge/Chrome native password "eye" that fights our control
                style={showFigmaToken ? undefined : ({ WebkitTextSecurity: "disc" } as CSSProperties)}
                className="w-full h-[38px] pl-3 pr-10 rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-[13px] outline-none"
              />
              <button
                type="button"
                aria-label={showFigmaToken ? "Hide token" : "Show token"}
                onClick={() => setShowFigmaToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#7E7E7E] hover:text-[#1F1F1F] dark:hover:text-[#ededed]"
              >
                {showFigmaToken ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
              </button>
            </div>
          </label>
          <a
            href="https://developers.figma.com/docs/rest-api/personal-access-tokens/"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-[#2684FF]"
          >
            How to create a Figma personal access token
          </a>
          <a
            href="https://www.figma.com/settings"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-[#2684FF]"
          >
            Open Figma settings (generate token)
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="text-[12px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
            OpenAPI / Swagger URL
            <input
              value={specUrl}
              onChange={(e) => setSpecUrl(e.target.value)}
              placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
              className="mt-1 w-full h-[38px] px-3 rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-[13px] outline-none"
            />
          </label>
          <label className="text-[12px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
            Access token (optional)
            <input
              type="password"
              value={swaggerToken}
              onChange={(e) => setSwaggerToken(e.target.value)}
              placeholder="Bearer token if the spec is private"
              className="mt-1 w-full h-[38px] px-3 rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-[13px] outline-none"
            />
          </label>
          <a
            href="https://petstore3.swagger.io/api/v3/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-[#2684FF]"
          >
            Try the public Petstore OpenAPI example
          </a>
        </div>
      )}

      {error ? (
        <div className="mt-3 text-[12px] text-[#D97706]">{error}</div>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={handleSubmit}
        className="mt-5 w-full h-[40px] rounded-[8px] bg-[#8664f2] text-white text-[13px] font-[500] disabled:opacity-60"
      >
        {saving
          ? provider === "github"
            ? "Continuing to GitHub..."
            : "Connecting..."
          : provider === "github"
            ? "Continue with GitHub"
            : title}
      </button>
    </Modal>
  );
}

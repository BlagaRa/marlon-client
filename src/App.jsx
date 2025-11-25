import { useRef, useState } from "react";
import { Onfido } from "onfido-sdk-ui";

const CONFIG = {
  backgrounds: { home: "/bank2.png", form: "/bank2.png", workflow: "/bank2.png" },
  navbars: { success: "/results-banner.png", failure: "/results-banner.png" },
  supportPhone: "1 (800) 999-0000",
  referenceCode: "Onboarding Verification 05jx1-0fmt",
};

const WORKFLOW_ID = import.meta.env.VITE_WORKFLOW_ID || "";
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const api = (path) => `${API_ORIGIN}${path}`;

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || "Request failed"), { details: data?.details });
  return data;
}

async function waitForWebhook(runId, { tries = 200, intervalMs = 2000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const data = await fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(runId)}`));
      
      // CRITICAL CHANGE: Do not return if status is "processing".
      // We must wait for the final status (approved, declined, review) 
      // to ensure we have received ALL webhooks, including the data extraction one.
      const status = (data.status || "").toLowerCase();
      
      if (status === "approved" || status === "declined" || status === "review" || status === "abandoned") {
          return data;
      }
      
      // Optional: If you see 'processing' but already have the data, you COULD return, 
      // but it's safer to wait for the final flag to catch all 9 webhooks.
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timeout waiting for completion");
}

function OverlayCard({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[92svh] overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <h2 className="m-0 text-2xl font-extrabold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold shadow-sm hover:bg-gray-50 cursor-pointer"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        {subtitle && <p className="px-6 pt-4 text-gray-600">{subtitle}</p>}
        <div className="px-6 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}

function WhiteScreen({ title, subtitle, danger, onBack, onRetry, navbarUrl, children }) {
  return (
    <div className="fixed inset-0 z-30 overflow-auto bg-white">
      {navbarUrl && (
        <img 
          src={navbarUrl} 
          alt="Banner" 
          className="w-full h-auto block"
        />
      )}
      
      <div className="mx-auto max-w-xl px-6 py-6">
        <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
        
        {danger && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
            ⚠ {danger}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onBack}
            className="rounded-xl border border-black/10 bg-black px-4 py-2 font-bold text-white hover:opacity-95"
          >
            Back to home
          </button>
          {danger && (
            <button
              onClick={onRetry}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 font-bold hover:bg-gray-50"
            >
              Try again
            </button>
          )}
        </div>
      </div>

      {children && (
        <div className="mx-auto my-10 w-full max-w-3xl px-4">
          {children}
        </div>
      )}
    </div>
  );
}

function FullBg({ view, children, clickable = false, onActivate }) {
  const wantsBg = view === "home" || view === "form" || view === "workflow";
  const bg = { home: "/bank2.png", form: "/bank2.png", workflow: "/bank2.png" }[view] || "/bank2.png";
  if (!wantsBg) return <>{children}</>;
  return (
    <div
      className={"min-h-[100svh] bg-cover bg-center bg-no-repeat " + (clickable ? "cursor-pointer" : "")}
      style={{ backgroundImage: `url(${bg})` }}
      onClick={clickable ? onActivate : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {children}
    </div>
  );
}

function ResultBadge({ value }) {
  const normalized = (value || "").toLowerCase();
  const isClear = normalized === "clear";
  const isConsider = normalized === "consider";
  
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-600";
  let label = value || "—";

  if (isClear) {
    bgColor = "bg-green-100";
    textColor = "text-green-800";
    label = "Clear";
  } else if (isConsider) {
    bgColor = "bg-orange-100";
    textColor = "text-orange-800";
    label = "Consider";
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${bgColor} ${textColor}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value, isBadge }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3 items-center">
      <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="sm:col-span-2 text-gray-900 break-words font-medium">
        {isBadge ? <ResultBadge value={value} /> : String(value ?? "—")}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home"); 
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [finalData, setFinalData] = useState(null);

  const onfidoRef = useRef(null);

  async function loadFinalData(id) {
    const [runData, webhookData] = await Promise.all([
      fetchJSON(api(`/api/workflow_runs/${encodeURIComponent(id)}`)),
      fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(id)}`)).catch(() => null),
    ]);

    // Combine outputs from the API run call and the accumulated webhook data
    const combinedOutput = {
      ...(runData.output || {}),
      ...(webhookData?.raw_output || {}),
    };
    
    setFinalData({
      status: runData.status,
      full_name: runData.full_name || [combinedOutput.first_name, combinedOutput.last_name].filter(Boolean).join(" ") || [runData.first_name, runData.last_name].filter(Boolean).join(" "),
      workflow_run_id: runData.workflow_run_id,
      dashboard_url: runData.dashboard_url,
      webhook: webhookData || null,
      
      address: combinedOutput.address,
      gender: combinedOutput.gender,
      dob: combinedOutput.dob,
      document_number: combinedOutput.document_number,
      document_type: combinedOutput.document_type,
      date_expiry: combinedOutput.date_expiry,
    });
    setView("final");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const applicant = await fetchJSON(api(`/api/applicants`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
        }),
      });

      const run = await fetchJSON(api(`/api/workflow_runs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: WORKFLOW_ID, applicant_id: applicant.id }),
      });

      setView("workflow");

      onfidoRef.current?.tearDown?.();
      onfidoRef.current = Onfido.init({
        token: run.sdk_token,
        workflowRunId: run.id,
        containerId: "onfido-mount",
        onComplete: async () => {
          setView("pending");
          try {
            await waitForWebhook(run.id);
            await loadFinalData(run.id);
          } catch (err) {
            setErrorMsg(err?.message || "Something went wrong.");
            setView("error");
          }
        },
        onError: (err) => {
          setErrorMsg(err?.message || "Something went wrong.");
          setView("error");
        },
      });
    } catch (err) {
      setErrorMsg(err?.message || "Something went wrong.");
      setView("error");
    } finally {
      setLoading(false);
    }
  }

  function closeAndCleanup() {
    onfidoRef.current?.tearDown?.();
    onfidoRef.current = null;
    setView("home");
    setErrorMsg("");
    setFinalData(null);
    setFirstName("");
    setLastName("");
    setEmail("");
  }

  const isApproved = (finalData?.status || "").toLowerCase() === "approved";
  const computedFullName = finalData?.full_name || [firstName, lastName].filter(Boolean).join(" ");
  
  const webhookResult = finalData?.webhook?.result;
  const breakdown = finalData?.webhook?.breakdown || {};
  
  // Access nested breakdown fields safely
  const visualAuth = breakdown?.visual_authenticity?.result;
  const digitalTampering = breakdown?.visual_authenticity?.breakdown?.digital_tampering?.result;

  // Robust address formatting
  let addressStr = "—";
  if (finalData?.address) {
    if (typeof finalData.address === "string") {
        addressStr = finalData.address;
    } else if (typeof finalData.address === "object") {
        // Extract address parts, handle line1 specifically as seen in payload
        const { line1, town, state, country, postcode } = finalData.address;
        addressStr = [line1, town, state, postcode, country].filter(Boolean).join(", ");
    }
  }

  const errorReason = (!isApproved ? "Verification requires manual review." : undefined);

  return (
    <FullBg view={view} clickable={view === "home"} onActivate={() => setView("form")}>
      <div className="min-h-[100svh]">
        {(view === "form" || view === "workflow") && (
          <OverlayCard
            title={view === "form" ? "Applicant details" : "Verify your identity"}
            onClose={closeAndCleanup}
          >
            {view === "form" ? (
              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="font-bold">
                    First name
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:outline-none"
                    />
                  </label>
                  <label className="font-bold">
                    Last name
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:outline-none"
                    />
                  </label>
                </div>

                <label className="font-bold">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:outline-none"
                  />
                </label>

                <div className="mt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="min-w-[220px] rounded-xl border border-black/10 bg-black px-5 py-3 font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? "Submitting…" : "Create & start workflow"}
                  </button>
                </div>
              </form>
            ) : (
              <div id="onfido-mount" className="min-h-[480px]" />
            )}
          </OverlayCard>
        )}

        {view === "pending" && (
          <WhiteScreen
            title="Thank you for uploading"
            subtitle="We are currently verifying your information. This may take a few minutes."
            navbarUrl={CONFIG.navbars.success}
            onBack={closeAndCleanup}
          />
        )}

        {view === "error" && (
          <WhiteScreen
            title="Something went wrong"
            subtitle="We couldn't complete your verification."
            danger={errorMsg}
            navbarUrl={CONFIG.navbars.failure}
            onBack={closeAndCleanup}
            onRetry={() => {
              setView("form");
              setErrorMsg("");
            }}
          />
        )}

        {view === "final" && finalData && (
          <WhiteScreen
            title={isApproved ? "You're approved ✅" : "Process Complete"}
            subtitle={
              isApproved
                ? "Your verification looks good."
                : `Please call us at ${CONFIG.supportPhone} and reference ${CONFIG.referenceCode}.`
            }
            navbarUrl={isApproved ? CONFIG.navbars.success : CONFIG.navbars.failure}
            onBack={closeAndCleanup}
            onRetry={!isApproved ? () => setView("form") : undefined}
            danger={!isApproved ? errorReason : undefined}
          >
            <div className="grid gap-4">
              <InfoRow label="Verification Status" value={finalData.status} />
              <InfoRow label="Full name" value={computedFullName || "—"} />
              
              <InfoRow label="Address" value={addressStr} />
              <InfoRow label="Gender" value={finalData.gender} />
              <InfoRow label="Date of birth" value={finalData.dob} />
              <InfoRow label="Document number" value={finalData.document_number} />
              <InfoRow label="Document type" value={finalData.document_type} />
              <InfoRow label="Date of expiry" value={finalData.date_expiry} />

              <div className="my-2 border-t border-gray-200"></div>
              <h3 className="text-lg font-bold text-gray-900">Detailed Results</h3>
              
              <InfoRow label="Overall Result" value={webhookResult} isBadge />
              <InfoRow label="Visual Authenticity" value={visualAuth} isBadge />
              <InfoRow label="Digital Tampering" value={digitalTampering} isBadge />
            </div>
          </WhiteScreen>
        )}
      </div>
    </FullBg>
  );
}

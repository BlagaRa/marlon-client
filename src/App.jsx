import { useRef, useState } from "react";
import { Onfido } from "onfido-sdk-ui";

const CONFIG = {
  backgrounds: { home: "/bank2.png", form: "/bank2.png", workflow: "/bank2.png" },
  navbars: { success: "/results-banner.png", failure: "/results-banner.png" },
  supportPhone: "1(800)999-0000",
  referenceCode: "Onboarding Verification 05JX1-0WWE",
};

const DUMMY_PHONE_DISPLAY = "+1 800-328-3996";

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
  const TERMINAL = ["approved", "declined", "review", "abandoned"];

  for (let i = 0; i < tries; i++) {
    try {
      const data = await fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(runId)}`));

      const status = String(data?.status || "").toLowerCase();
      const hasRaw = data && Object.keys(data.raw_output || {}).length > 0;

      const hasBreakdown = Boolean(data?.breakdown?.visual_authenticity);


      const hasResult = Boolean(data?.result || data?.raw_output?.sub_result || data?.raw_output?.result);

      if (hasRaw && TERMINAL.includes(status)) {
        if (status === "review") {
          if (hasBreakdown || hasResult) return data;
        } else {
          return data;
        }
      }
    } catch {
      // ignore transient errors
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Timeout waiting for completion");
}


function OverlayCard({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 backdrop-blur-sm p-4 overflow-x-hidden">
      <div className="w-full max-w-2xl max-h-[98svh] h-fit overflow-y-auto rounded-3xl border border-white/40 bg-white/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <h2 className="m-0 text-2xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-200 cursor-pointer"
          >
            Close
          </button>
        </div>
        {subtitle && <p className="px-6 pt-4 text-gray-600 font-medium">{subtitle}</p>}
        <div className="px-6 pb-6 pt-6">{children}</div>
      </div>
    </div>
  );
}

function WhiteScreen({ title, subtitle, danger, onBack, navbarUrl, children }) {
  return (
    <div className="fixed inset-0 z-30 overflow-x-hidden overflow-y-auto bg-gray-50">
      {navbarUrl && <img src={navbarUrl} alt="Banner" className="w-full h-auto block shadow-sm" />}

      <div className="mx-auto max-w-xl px-4 py-8 w-full">
        <h1 className="text-3xl font-extrabold text-gray-900 break-words tracking-tight">{title}</h1>

        {danger && (
          <div className="mt-4 mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 font-bold break-words shadow-sm flex items-start gap-2">
            <span>⚠</span>
            {danger}
          </div>
        )}

        {subtitle && <p className="mt-2 text-lg text-gray-600 break-words leading-relaxed">{subtitle}</p>}

        <div className="mt-6 mb-40 flex gap-3 flex-wrap">
          <button
            onClick={onBack}
            className="rounded-xl bg-gray-900 px-6 py-3 font-bold text-white shadow-lg shadow-gray-900/20 hover:bg-black transition-all hover:-translate-y-0.5"
          >
            Back to home
          </button>
        </div>
      </div>

      {children && <div className="mx-auto my-6 w-full max-w-3xl px-4 pb-20">{children}</div>}
    </div>
  );
}

function FullBg({ view, children, clickable = false, onActivate }) {
  const wantsBg = view === "home" || view === "form" || view === "workflow";
  const bg = { home: "/bank2.png", form: "/bank2.png", workflow: "/bank2.png" }[view] || "/bank2.png";
  if (!wantsBg) return <>{children}</>;
  return (
    <div
      className="min-h-[100svh] w-full bg-cover bg-center bg-no-repeat cursor-pointer overflow-x-hidden transition-all duration-700"
      style={{ backgroundImage: `url(${bg})` }}
      onClick={clickable ? onActivate : undefined}
    >
      {children}
    </div>
  );
}


function ResultBadge({ value, mode = "default" }) {
  const normalized = String(value || "").toLowerCase();
  const label = value ? value.charAt(0).toUpperCase() + value.slice(1) : "N/A";

  if (mode === "workflowStatus") {
    if (normalized === "approved") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {label}
        </span>
      );
    }

    if (normalized === "review") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {label}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        {label}
      </span>
    );
  }

  if (normalized === "clear" || normalized === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {label}
      </span>
    );
  } else if (["review", "consider", "suspected"].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {label}
      </span>
    );
  } else if (["declined", "rejected", "abandoned"].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        {label}
      </span>
    );
  }

  return <span className="text-gray-400 font-normal">{label}</span>;
}

function InfoRow({ label, value, isBadge, badgeMode }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-3 items-center w-full transition hover:border-gray-300">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{label}</div>
      <div className="sm:col-span-2 text-gray-900 font-medium break-all">
        {isBadge ? <ResultBadge value={value} mode={badgeMode} /> : String(value ?? "N/A")}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(DUMMY_PHONE_DISPLAY);
  const [isUsCitizen, setIsUsCitizen] = useState("no");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [finalData, setFinalData] = useState(null);

  const onfidoRef = useRef(null);

  function normalizePhone(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return raw.startsWith("+") ? `+${digits}` : `+${digits}`;
  }

  function isValidPhoneE164(phoneE164) {
    return /^\+\d{9,15}$/.test(phoneE164);
  }

  /**
   * Robustly extracts verification results from the breakdown object.
   * Handles multiple possible data structures and provides fallbacks.
   * @param {Object} breakdown - The breakdown object from Onfido
   * @param {Object} webhookData - Optional webhook data to check document_breakdown
   * @returns {Object} Object with visual_authenticity, digital_tampering, and security_features
   */
  function extractVerificationResults(breakdown, webhookData = null, merged = null, runOutput = null) {
    let visualAuth = null;
    let digitalTampering = null;
    let securityFeatures = null;

    const checkBreakdown = (bd, source = "unknown") => {
      if (!bd || typeof bd !== "object") return;

      if (!visualAuth && bd?.visual_authenticity?.result != null) {
        visualAuth = bd.visual_authenticity.result;
        console.log(`[${source}] ✓ Found visual_authenticity: ${visualAuth}`);
        console.log(`[${source}]   Structure check:`, {
          has_digital_tampering: !!bd.visual_authenticity?.breakdown?.digital_tampering,
          has_security_features: !!bd.visual_authenticity?.breakdown?.security_features,
          has_liveness_detected: !!bd.visual_authenticity?.breakdown?.liveness_detected
        });
      }

      if (!digitalTampering) {
        if (bd?.digital_tampering?.result != null) {
          digitalTampering = bd.digital_tampering.result;
          console.log(`[${source}] ✓ Found digital_tampering (direct): ${digitalTampering}`);
        } else if (bd?.visual_authenticity?.breakdown?.digital_tampering?.result != null) {
          digitalTampering = bd.visual_authenticity.breakdown.digital_tampering.result;
          console.log(`[${source}] ✓ Found digital_tampering (from visual_authenticity.breakdown): ${digitalTampering}`);
        }
      }

      if (!securityFeatures) {
        if (bd?.security_features?.result != null) {
          securityFeatures = bd.security_features.result;
          console.log(`[${source}] ✓ Found security_features (direct): ${securityFeatures}`);
        } else if (bd?.visual_authenticity?.breakdown?.security_features?.result != null) {
          securityFeatures = bd.visual_authenticity.breakdown.security_features.result;
          console.log(`[${source}] ✓ Found security_features (from visual_authenticity.breakdown): ${securityFeatures}`);
        }
      }
    };

    const isCompleteDocumentBreakdown = (bd) => {
      if (!bd || typeof bd !== "object") return false;
      return (
        bd?.visual_authenticity?.result != null &&
        bd?.visual_authenticity?.breakdown?.digital_tampering?.result != null &&
        bd?.visual_authenticity?.breakdown?.security_features?.result != null
      );
    };

    console.log("=== EXTRACTING VERIFICATION RESULTS ===");
    let foundCompleteBreakdown = false;

    if (webhookData?.breakdowns && typeof webhookData.breakdowns === "object") {
      console.log("Checking webhookData.breakdowns...");
      for (const taskId in webhookData.breakdowns) {
        const taskBreakdown = webhookData.breakdowns[taskId];
        if (isCompleteDocumentBreakdown(taskBreakdown)) {
          console.log(`✓ Found complete breakdown in: webhookData.breakdowns["${taskId}"]`);
          checkBreakdown(taskBreakdown, `webhookData.breakdowns["${taskId}"]`);
          foundCompleteBreakdown = true;
          break;
        }
      }
      
      if (!foundCompleteBreakdown) {
        console.log("No complete breakdown found, checking all breakdowns...");
        for (const taskId in webhookData.breakdowns) {
          const taskBreakdown = webhookData.breakdowns[taskId];
          checkBreakdown(taskBreakdown, `webhookData.breakdowns["${taskId}"]`);
          if (visualAuth && digitalTampering && securityFeatures) break;
        }
      }
    }

    if (!foundCompleteBreakdown && webhookData?.document_breakdown) {
      console.log("Checking webhookData.document_breakdown...");
      if (isCompleteDocumentBreakdown(webhookData.document_breakdown)) {
        console.log("✓ Found complete breakdown in: webhookData.document_breakdown");
        checkBreakdown(webhookData.document_breakdown, "webhookData.document_breakdown");
        foundCompleteBreakdown = true;
      } else {
        checkBreakdown(webhookData.document_breakdown, "webhookData.document_breakdown");
      }
    }

    if (!foundCompleteBreakdown && webhookData?.breakdown) {
      console.log("Checking webhookData.breakdown...");
      if (isCompleteDocumentBreakdown(webhookData.breakdown)) {
        console.log("✓ Found complete breakdown in: webhookData.breakdown");
        checkBreakdown(webhookData.breakdown, "webhookData.breakdown");
        foundCompleteBreakdown = true;
      } else {
        checkBreakdown(webhookData.breakdown, "webhookData.breakdown");
      }
    }

    if (!foundCompleteBreakdown && merged?.breakdown) {
      console.log("Checking merged.breakdown...");
      if (isCompleteDocumentBreakdown(merged.breakdown)) {
        console.log("✓ Found complete breakdown in: merged.breakdown");
        checkBreakdown(merged.breakdown, "merged.breakdown");
        foundCompleteBreakdown = true;
      } else {
        checkBreakdown(merged.breakdown, "merged.breakdown");
      }
    }

    if (!foundCompleteBreakdown && breakdown) {
      console.log("Checking breakdown parameter...");
      if (isCompleteDocumentBreakdown(breakdown)) {
        console.log("✓ Found complete breakdown in: breakdown parameter");
        checkBreakdown(breakdown, "breakdown parameter");
        foundCompleteBreakdown = true;
      } else {
        checkBreakdown(breakdown, "breakdown parameter");
      }
    }

    if (!foundCompleteBreakdown && (!visualAuth || !digitalTampering || !securityFeatures)) {
      if (runOutput?.breakdown) {
        console.log("Checking runOutput.breakdown (fallback)...");
        checkBreakdown(runOutput.breakdown, "runOutput.breakdown");
      }
    }

    console.log("=== EXTRACTION RESULTS ===");
    console.log("visual_authenticity:", visualAuth);
    console.log("digital_tampering:", digitalTampering);
    console.log("security_features:", securityFeatures);
    console.log("=== END EXTRACTION RESULTS ===");

    return {
      visual_authenticity: visualAuth,
      digital_tampering: digitalTampering,
      security_features: securityFeatures,
    };
  }

  async function loadFinalData(id) {
    const [runData, webhookData] = await Promise.all([
      fetchJSON(api(`/api/workflow_runs/${encodeURIComponent(id)}`)),
      fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(id)}`)).catch(() => null),
    ]);

    const runOutput = runData?.output || {};
    const merged = webhookData?.raw_output || {};

    let breakdown = {};

    console.log("=== BREAKDOWN SELECTION ===");
    if (webhookData?.breakdowns?.["document_check_with_address_information"]) {
      breakdown = webhookData.breakdowns["document_check_with_address_information"];
      console.log("✓ Selected: webhookData.breakdowns['document_check_with_address_information']");
      console.log("  Structure:", {
        has_visual_authenticity: !!breakdown.visual_authenticity,
        has_digital_tampering: !!breakdown.visual_authenticity?.breakdown?.digital_tampering,
        has_security_features: !!breakdown.visual_authenticity?.breakdown?.security_features,
        has_liveness_detected: !!breakdown.visual_authenticity?.breakdown?.liveness_detected
      });
    } else if (webhookData?.document_breakdown) {
      breakdown = webhookData.document_breakdown;
      console.log("✓ Selected: webhookData.document_breakdown");
    } else if (webhookData?.breakdown) {
      breakdown = webhookData.breakdown;
      console.log("⚠ Selected: webhookData.breakdown (may be from face_check_motion)");
    } else if (merged?.breakdown) {
      breakdown = merged.breakdown;
      console.log("⚠ Selected: merged.breakdown");
    } else if (runOutput?.breakdown) {
      breakdown = runOutput.breakdown;
      console.log("⚠ Selected: runOutput.breakdown");
    } else {
      console.log("⚠ Selected: empty object");
    }
    console.log("Selected breakdown:", breakdown);
    console.log("=== END BREAKDOWN SELECTION ===");

    const verificationResults = extractVerificationResults(breakdown, webhookData, merged, runOutput);

    const subResult =
      runOutput?.sub_result ??
      webhookData?.result ??
      merged?.sub_result ??
      merged?.result ??
      null;

    const addrObj =
      merged?.address_lines ||
      merged?.address ||
      runOutput?.address_lines ||
      runOutput?.address;

    const first = merged?.first_name || runOutput?.first_name;
    const last = merged?.last_name || runOutput?.last_name;

    setFinalData({
      status: runData?.status || null,
      sub_result: subResult,
      full_name: runData?.full_name || [first, last].filter(Boolean).join(" ") || "",
      workflow_run_id: runData?.workflow_run_id || null,

      webhook: webhookData || null,
      breakdown,
      verificationResults,

      address: addrObj,
      gender: merged?.gender || runOutput?.gender || null,
      dob: merged?.date_of_birth || runOutput?.dob || runOutput?.date_of_birth || null,
      document_number: merged?.document_number || runOutput?.document_number || null,
      document_type: merged?.document_type || runOutput?.document_type || null,
      date_expiry: merged?.date_of_expiry || runOutput?.date_expiry || runOutput?.date_of_expiry || null,
    });

    setView("final");
  }



  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const phoneE164 = normalizePhone(phone);
    if (!isValidPhoneE164(phoneE164)) {
      setErrorMsg("Phone number must be valid (example: +18003283996).");
      setLoading(false);
      return;
    }

    try {
      const applicant = await fetchJSON(api(`/api/applicants`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phoneE164,
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
    setPhone(DUMMY_PHONE_DISPLAY);
    setIsUsCitizen("no");
  }

  const computedFullName = finalData?.full_name || [firstName, lastName].filter(Boolean).join(" ");
  const breakdown = finalData?.breakdown || {};
  const webhookData = finalData?.webhook || null;
  const merged = webhookData?.raw_output || null;

  const verificationResults = finalData?.verificationResults || extractVerificationResults(breakdown, webhookData, merged, null);
  console.log("verification Results:", verificationResults);
  const visualAuth = verificationResults.visual_authenticity ?? "N/A";
  const digitalTampering = verificationResults.digital_tampering ?? "N/A";
  const securityFeatures = verificationResults.security_features ?? "N/A";

  let addressStr = "N/A";
  if (finalData?.address) {
    if (typeof finalData.address === "object") {
      const { town, state, postcode, country } = finalData.address;
      addressStr = [town, state, postcode, country].filter(Boolean).join(", ") || "N/A";
    } else if (typeof finalData.address === "string") {
      const parts = finalData.address.split(",").map((s) => s.trim());
      if (parts.length > 3) {
        addressStr = parts.slice(1).join(", ");
      } else {
        addressStr = finalData.address;
      }
    }
  }

  const runStatus = String(finalData?.status || "").toLowerCase();

const approvedMeta = {
  title: "You have successfully verified your identity!✅",
  subtitle: "Let's proceed with the next step of your account opening.",
  danger: undefined,
  banner: CONFIG.navbars.success,
};

const nonApprovedMeta = {
  title: "Verification requires additional review",
  subtitle: `Please call us at ${CONFIG.supportPhone} and reference ${CONFIG.referenceCode}.`,
  danger: "Identity Verification will require additional review.",
  banner: CONFIG.navbars.failure,
};

const meta = runStatus === "approved" ? approvedMeta : nonApprovedMeta;


  return (
    <FullBg view={view} clickable={view === "home"} onActivate={() => setView("form")}>
      <div className="min-h-[100svh] w-full overflow-x-hidden">
        {(view === "form" || view === "workflow") && (
          <OverlayCard title={view === "form" ? "Applicant details" : "Verify your identity"} onClose={closeAndCleanup}>
            {errorMsg && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 font-bold">
                ⚠ {errorMsg}
              </div>
            )}

            {view === "form" ? (
              <form onSubmit={handleSubmit} className="grid gap-6 w-full">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">First name</span>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">Last name</span>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">Phone Number</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={DUMMY_PHONE_DISPLAY}
                      required
                      className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="block text-sm font-bold text-gray-700 mb-1">Are you a US Citizen?</span>
                  <select
                    value={isUsCitizen}
                    onChange={(e) => setIsUsCitizen(e.target.value)}
                    className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black bg-white transition"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>

                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto rounded-xl bg-gray-900 px-8 py-4 font-extrabold text-white shadow-lg shadow-gray-900/20 hover:bg-black hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? "Submitting…" : "Step 2: Verify Your Identity..."}
                  </button>
                </div>
              </form>
            ) : (
              <div id="onfido-mount" className="min-h-[600px] w-full" />
            )}
          </OverlayCard>
        )}

        {view === "pending" && (
          <WhiteScreen
            title="Thank you for uploading"
            subtitle="We are currently verifying your information. This may take a few minutes."
            navbarUrl={CONFIG.navbars.success}
            onBack={() => {
              closeAndCleanup();
              setView("home");
            }}
          >
            <div className="flex justify-center mt-12 mb-8">
              <svg
                className="animate-spin h-10 w-10 text-gray-900"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          </WhiteScreen>
        )}

        {view === "error" && (
          <WhiteScreen
            title="Something went wrong"
            subtitle="We couldn't complete your verification."
            danger={errorMsg}
            navbarUrl={CONFIG.navbars.failure}
            onBack={() => {
              closeAndCleanup();
              setView("home");
            }}
          />
        )}

        {view === "final" && finalData && (
          <WhiteScreen
            title={meta.title}
            subtitle={meta.subtitle}
            navbarUrl={meta.banner}
            danger={meta.danger}
            onBack={() => {
              closeAndCleanup();
              setView("home");
            }}
          >
            <div className="grid gap-3 w-full">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Detailed Results</h3>

              <InfoRow label="Verification Result" value={finalData.status} isBadge badgeMode="workflowStatus" />

              <InfoRow label="Sub-Result" value={finalData.sub_result} isBadge />
              <InfoRow label="Visual Authenticity" value={visualAuth} isBadge />
              <InfoRow label="Digital Tampering" value={digitalTampering} isBadge />
              <InfoRow label="Security Features" value={securityFeatures} isBadge />

              <div className="my-6 border-t border-gray-100"></div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">Personal Data</h3>
              <InfoRow label="Full name" value={computedFullName || "N/A"} />
              <InfoRow label="Address" value={addressStr} />
              <InfoRow label="Gender" value={finalData.gender} />
              <InfoRow label="Date of birth" value={finalData.dob} />
              <InfoRow label="Document number" value={finalData.document_number} />
              <InfoRow label="Document type" value={finalData.document_type} />
              <InfoRow label="Date of expiry" value={finalData.date_expiry} />
            </div>
          </WhiteScreen>
        )}
      </div>
    </FullBg>
  );
}

import { XCircle, AlertCircle, Upload, AlertTriangle } from "lucide-react";

export function VerificationBanner({ role, docStatus, accountStatus, rejectionReason, coachType }) {
  // Venue Owner banner
  if (role === "venue_owner" && docStatus !== "verified" && accountStatus !== "active") {
    return (
      <div className={`rounded-xl p-5 mb-6 border-2 ${
        docStatus === "rejected" ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" :
        docStatus === "pending_review" ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" :
        "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
      }`}>
        {docStatus === "rejected" && (
          <>
            <div className="font-display font-bold text-base text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              Documents Rejected
            </div>
            <div className="text-sm text-red-600 dark:text-red-300">
              {rejectionReason || "Please re-upload corrected documents."}
            </div>
          </>
        )}
        {docStatus === "pending_review" && (
          <>
            <div className="font-display font-bold text-base text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              Documents Under Review
            </div>
            <div className="text-sm text-amber-600 dark:text-amber-300">
              Your documents are being reviewed by the admin. You will be notified once approved.
            </div>
          </>
        )}
        {(docStatus === "not_uploaded" || !docStatus) && (
          <>
            <div className="font-display font-bold text-base text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              Upload Verification Documents
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-300">
              Please upload your business documents to get your account verified.
            </div>
          </>
        )}
      </div>
    );
  }

  // Coach banner
  if (role === "coach" && coachType === "individual" && docStatus !== "verified") {
    return (
      <div className={`rounded-xl p-5 mb-6 border-2 ${
        docStatus === "rejected" ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" :
        docStatus === "pending_review" ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" :
        "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
      }`}>
        {docStatus === "rejected" && (
          <>
            <div className="font-display font-bold text-base text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              Verification Rejected
            </div>
            <div className="text-sm text-red-600 dark:text-red-300">
              {rejectionReason || "Please re-upload corrected documents."}
            </div>
          </>
        )}
        {docStatus === "pending_review" && (
          <>
            <div className="font-display font-bold text-base text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              Documents Under Review
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-300">
              Your documents are being reviewed by the admin. You will be notified once approved.
            </div>
          </>
        )}
        {(docStatus === "not_uploaded" || !docStatus) && (
          <>
            <div className="font-display font-bold text-base text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              Complete Your Profile Verification
            </div>
            <div className="text-sm text-amber-600 dark:text-amber-300">
              Upload your documents below to get verified and start coaching.
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

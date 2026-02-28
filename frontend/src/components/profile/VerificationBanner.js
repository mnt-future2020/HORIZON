import { XCircle, AlertCircle, Upload, AlertTriangle } from "lucide-react";

export function VerificationBanner({ role, docStatus, accountStatus, rejectionReason, coachType }) {
  // Venue Owner banner
  if (role === "venue_owner" && docStatus !== "verified" && accountStatus !== "active") {
    return (
      <div className={`rounded-lg p-4 mb-6 border ${
        docStatus === "rejected" ? "bg-destructive/10 border-destructive/30" :
        docStatus === "pending_review" ? "bg-amber-500/10 border-amber-500/30" :
        "bg-blue-500/10 border-blue-500/30"
      }`}>
        {docStatus === "rejected" && (
          <>
            <div className="font-bold text-sm text-destructive mb-1 flex items-center gap-1.5">
              <XCircle className="h-4 w-4" /> Documents Rejected
            </div>
            <div className="text-xs text-muted-foreground">
              {rejectionReason || "Please re-upload corrected documents."}
            </div>
          </>
        )}
        {docStatus === "pending_review" && (
          <>
            <div className="font-bold text-sm text-amber-400 mb-1 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Documents Under Review
            </div>
            <div className="text-xs text-muted-foreground">
              Your documents are being reviewed by the admin. You will be notified once approved.
            </div>
          </>
        )}
        {(docStatus === "not_uploaded" || !docStatus) && (
          <>
            <div className="font-bold text-sm text-blue-400 mb-1 flex items-center gap-1.5">
              <Upload className="h-4 w-4" /> Upload Verification Documents
            </div>
            <div className="text-xs text-muted-foreground">
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
      <div className={`rounded-lg p-4 mb-6 border ${
        docStatus === "rejected" ? "bg-destructive/10 border-destructive/30" :
        docStatus === "pending_review" ? "bg-blue-500/10 border-blue-500/30" :
        "bg-amber-500/10 border-amber-500/30"
      }`}>
        {docStatus === "rejected" && (
          <>
            <div className="font-bold text-sm text-destructive mb-1 flex items-center gap-1.5">
              <XCircle className="h-4 w-4" /> Verification Rejected
            </div>
            <div className="text-xs text-muted-foreground">
              {rejectionReason || "Please re-upload corrected documents."}
            </div>
          </>
        )}
        {docStatus === "pending_review" && (
          <>
            <div className="font-bold text-sm text-blue-400 mb-1 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Documents Under Review
            </div>
            <div className="text-xs text-muted-foreground">
              Your documents are being reviewed by the admin. You will be notified once approved.
            </div>
          </>
        )}
        {(docStatus === "not_uploaded" || !docStatus) && (
          <>
            <div className="font-bold text-sm text-amber-400 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Complete Your Profile Verification
            </div>
            <div className="text-xs text-muted-foreground">
              Upload your documents below to get verified and start coaching.
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

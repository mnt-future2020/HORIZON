import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { authAPI } from "@/lib/api";
import { toast } from "sonner";

const DEFAULT_PW_FORM = { current: "", new_pw: "", confirm: "" };

export function PasswordChangeSection() {
  const [showPwChange, setShowPwChange] = useState(false);
  const [pwForm, setPwForm] = useState(() => ({ ...DEFAULT_PW_FORM }));
  const [changingPw, setChangingPw] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleChangePassword = async () => {
    if (pwForm.new_pw !== pwForm.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setChangingPw(true);
    try {
      const res = await authAPI.changePassword({
        current_password: pwForm.current,
        new_password: pwForm.new_pw,
      });
      localStorage.setItem("horizon_token", res.data.token);
      localStorage.setItem("horizon_refresh_token", res.data.refresh_token);
      toast.success("Password changed!");
      setPwForm({ ...DEFAULT_PW_FORM });
      setShowPwChange(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to change password");
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="mt-6 border border-border rounded-xl overflow-hidden bg-background">
      <button
        onClick={() => setShowPwChange(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors cursor-pointer touch-manipulation min-h-[52px]"
        aria-expanded={showPwChange}
        aria-label="Toggle password change section"
      >
        <span className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900">
            <Lock className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          </div>
          <span className="font-display">Change Password</span>
        </span>
        <span className="text-muted-foreground text-sm font-bold transition-transform duration-200" aria-hidden="true" style={{ transform: showPwChange ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>
      {showPwChange && (
        <div className="px-5 pb-5 pt-2 space-y-4 border-t border-border bg-muted/20">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Current Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                className="bg-background border-border pr-12 h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                placeholder="Enter current password"
                aria-label="Current password"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted transition-all"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">New Password</Label>
            <Input
              type={showPw ? "text" : "password"}
              value={pwForm.new_pw}
              onChange={e => setPwForm(p => ({ ...p, new_pw: e.target.value }))}
              className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
              aria-label="New password"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Confirm New Password</Label>
            <Input
              type={showPw ? "text" : "password"}
              value={pwForm.confirm}
              onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
              className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Re-enter new password"
              aria-label="Confirm new password"
            />
          </div>
          <Button
            className="w-full font-semibold min-h-[52px] cursor-pointer touch-manipulation bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white transition-colors"
            disabled={changingPw || !pwForm.current || !pwForm.new_pw || !pwForm.confirm}
            onClick={handleChangePassword}
          >
            {changingPw ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              "Update Password"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

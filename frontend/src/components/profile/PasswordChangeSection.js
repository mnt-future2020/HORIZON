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
    <div className="mt-6 border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setShowPwChange(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/30 transition-colors cursor-pointer touch-manipulation min-h-[48px]"
        aria-expanded={showPwChange}
        aria-label="Toggle password change section"
      >
        <span className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span>Change Password</span>
        </span>
        <span className="text-muted-foreground text-xs" aria-hidden="true">
          {showPwChange ? "▲" : "▼"}
        </span>
      </button>
      {showPwChange && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Current Password</Label>
            <div className="relative mt-1">
              <Input
                type={showPw ? "text" : "password"}
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                className="bg-background border-border pr-10"
                placeholder="Enter current password"
                aria-label="Current password"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">New Password</Label>
            <Input
              type={showPw ? "text" : "password"}
              value={pwForm.new_pw}
              onChange={e => setPwForm(p => ({ ...p, new_pw: e.target.value }))}
              className="mt-1 bg-background border-border"
              placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
              aria-label="New password"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
            <Input
              type={showPw ? "text" : "password"}
              value={pwForm.confirm}
              onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
              className="mt-1 bg-background border-border"
              placeholder="Re-enter new password"
              aria-label="Confirm new password"
            />
          </div>
          <Button
            className="w-full font-bold min-h-[48px] cursor-pointer touch-manipulation"
            disabled={changingPw || !pwForm.current || !pwForm.new_pw || !pwForm.confirm}
            onClick={handleChangePassword}
          >
            {changingPw ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              "Update Password"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

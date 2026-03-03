import { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

/**
 * GroupDetailPage — Legacy redirect.
 * Now redirects /communities/:groupId to /chat?group=:groupId
 * so the unified ChatPage handles group chat.
 */
export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Preserve invite code if present
    const invite = searchParams.get("invite");
    const params = new URLSearchParams();
    params.set("group", groupId);
    if (invite) params.set("invite", invite);
    navigate(`/chat?${params.toString()}`, { replace: true });
  }, [groupId, navigate, searchParams]);

  return null;
}

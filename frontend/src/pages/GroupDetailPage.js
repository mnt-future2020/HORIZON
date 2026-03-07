import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

/**
 * GroupDetailPage — Legacy redirect.
 * Now redirects /communities/:groupId to /chat?group=:groupId
 * so the unified ChatPage handles group chat.
 */
export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Preserve invite code if present
    const invite = new URLSearchParams(window.location.search).get("invite");
    const params = new URLSearchParams();
    params.set("group", groupId);
    if (invite) params.set("invite", invite);
    navigate(`/chat?${params.toString()}`, { replace: true });
  }, [groupId, navigate]);

  return null;
}

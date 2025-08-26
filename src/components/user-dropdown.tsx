import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserType } from "@/lib/utils";
import { ChevronRight, LogOut, User } from "lucide-react";
import { googleLogout } from "@react-oauth/google";
import axios from "axios";

interface UserDropdownProps {
  user: UserType | null;
  setUser: (user: UserType) => void;
  onSignInClick: () => void;
  onChangeUsernameClick: () => void;
}

export function UserDropdown({
  user,
  setUser,
  onSignInClick,
  onChangeUsernameClick,
}: UserDropdownProps) {
  const API_URL = import.meta.env.VITE_API_URL;
  const isGuest = user?.provider === "guest";

  const handleLogout = async () => {
    googleLogout(); // This signs the user out from Google's context for your app
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
      console.log("JWT cookie cleared.");

      // Call /me again to trigger guest creation
      const { data: userProfile } = await axios.get<UserType>(`${API_URL}/me`, {
        withCredentials: true,
      });
      setUser(userProfile);
      console.log("Guest session:", userProfile);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="hover:bg-muted rounded px-4 py-2 transition-all">
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none select-none">
          <span>{user?.username}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {isGuest ? (
            //    guest menu
            <DropdownMenuItem onClick={onSignInClick}>
              <User className="h-4 w-4" />
              Sign in
            </DropdownMenuItem>
          ) : (
            //   account menu
            <>
              <DropdownMenuItem onClick={onChangeUsernameClick}>
                <User className="h-4 w-4" />
                Change Username
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

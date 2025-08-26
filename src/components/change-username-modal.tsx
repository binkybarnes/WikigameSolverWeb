import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import axios from "axios";
import type { UserType } from "@/lib/utils";

interface ChangeUsernameModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setUser: (user: UserType) => void; // adjust type if needed
}

export default function ChangeUsernameModal({
  isOpen,
  setIsOpen,
  setUser,
}: ChangeUsernameModalProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_URL = import.meta.env.VITE_API_URL;

  const handleChangeUsername = async () => {
    if (!username.trim()) return;
    setLoading(true);

    try {
      await axios.post(
        `${API_URL}/user/change-username`,
        { username },
        { withCredentials: true },
      );

      // refresh user
      const { data: updatedUser } = await axios.get<UserType>(`${API_URL}/me`, {
        withCredentials: true,
      });

      setUser(updatedUser);
      setIsOpen(false);
    } catch (err: any) {
      if (err.response) {
        // backend returned an error response
        if (err.response.data?.message) {
          setError(err.response.data.message);
        } else {
          setError(`HTTP error: ${err.response.status}`);
        }
      } else {
        setError("Network error or server unreachable");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Username</DialogTitle>
          <DialogDescription>Special characters allowed!</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="eg. 👟Tralalero Tralala🦈"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button onClick={handleChangeUsername} disabled={loading}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

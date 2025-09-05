import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Globe } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import axios from "axios";
import type { UserType } from "@/lib/utils";

const isLoading = false;

interface LoginProps {
  setUser: (user: UserType) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  setIsChangeUsernameModalOpen: (isOpen: boolean) => void;
}

const SignInModal = ({
  setUser,
  isOpen,
  setIsOpen,
  setIsChangeUsernameModalOpen,
}: LoginProps) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    console.log("Google Sign-In Success:", credentialResponse);

    // The 'credential' field is the ID Token (a JWT).
    const idToken = credentialResponse.credential;

    if (idToken) {
      try {
        // Send this token to your Axum backend
        const { data: authResponse } = await axios.post(
          `${API_URL}/auth/google`,
          { token: idToken },
          { withCredentials: true },
        );

        const { data: userProfile } = await axios.get<UserType>(
          `${API_URL}/me`,
          { withCredentials: true },
        );

        console.log("Backend verification successful:");
        setIsOpen(false);
        setUser(userProfile);

        // if first time sign in prompt change username
        if (authResponse.first_time) {
          setTimeout(() => {
            setIsChangeUsernameModalOpen(true);
          }, 300);
        }
      } catch (error) {
        console.error("Error sending token to backend:", error);
        // Handle error (e.g., show an error message to the user)
      }
    }
  };

  const handleError = () => {
    console.error("Google Sign-In Failed");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
      //  onOpenChange={onClose}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Save your searches!
          </DialogTitle>
          <DialogDescription>
            👑 Keep your spot on the leaderboard and see your past searches
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center space-y-4 py-4">
          <div className="w-full">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              type="standard"
              // useOneTap
            />
          </div>

          {/* <p className="text-muted-foreground text-center text-xs">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p> */}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignInModal;

import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const GOOGLE_CLIENT_ID = "3142184875-d5bcgf2d6232n8kbhccnhirujo2clvqd.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

interface UploadOptions {
  fileName: string;
  fileBlob: Blob;
  mimeType?: string;
}

export function useGoogleDriveUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadToDrive = useCallback(({ fileName, fileBlob, mimeType }: UploadOptions) => {
    setUploading(true);

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      toast({
        title: "Google Sign-In not loaded",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response: any) => {
        if (response.error) {
          toast({
            title: "Google Sign-In failed",
            description: response.error,
            variant: "destructive",
          });
          setUploading(false);
          return;
        }

        try {
          const accessToken = response.access_token;

          // Create multipart upload
          const metadata = {
            name: fileName,
            mimeType:
              mimeType ||
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          };

          const form = new FormData();
          form.append(
            "metadata",
            new Blob([JSON.stringify(metadata)], { type: "application/json" })
          );
          form.append("file", fileBlob);

          const uploadResp = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}` },
              body: form,
            }
          );

          if (!uploadResp.ok) {
            throw new Error(`Upload failed (${uploadResp.status})`);
          }

          const result = await uploadResp.json();
          const driveUrl = `https://drive.google.com/file/d/${result.id}/view`;

          // Use a toast action so the user can click to open — window.open inside
          // async callbacks is blocked by browser popup blockers.
          toast({
            title: "Uploaded to Google Drive",
            description: `"${fileName}" saved to your Drive.`,
            action: (
              <ToastAction
                altText="Open in Drive"
                onClick={() => window.open(driveUrl, "_blank")}
              >
                Open in Drive
              </ToastAction>
            ),
          });
        } catch (err: any) {
          toast({
            title: "Upload failed",
            description: err.message,
            variant: "destructive",
          });
        } finally {
          setUploading(false);
        }
      },
    });

    // prompt: "" reuses an existing token silently; only shows consent on first use.
    // prompt: "consent" (the previous value) forces re-authorization every single time.
    tokenClient.requestAccessToken({ prompt: "" });
  }, []);

  return { uploadToDrive, uploading };
}

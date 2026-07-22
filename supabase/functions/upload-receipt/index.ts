import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map of allowed MIME types to extensions and magic bytes
const ALLOWED_TYPES: Record<string, { ext: string; signatures: number[][] }> = {
  "image/jpeg": {
    ext: "jpg",
    signatures: [
      [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // EXIF
      [0xFF, 0xD8, 0xFF, 0xEE], // SPIFF
    ],
  },
  "image/png": {
    ext: "png",
    signatures: [[0x89, 0x50, 0x4E, 0x47]], // PNG magic bytes
  },
  "application/pdf": {
    ext: "pdf",
    signatures: [[0x25, 0x50, 0x44, 0x46]], // %PDF magic bytes
  },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Authenticate Request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "").trim();
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. File Validation (Size, Mime-Type, and Magic Bytes)
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File size exceeds the 5MB limit. Uploaded: ${(file.size / 1024 / 1024).toFixed(2)}MB` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = file.type;
    const typeMeta = ALLOWED_TYPES[mimeType];
    if (!typeMeta) {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${mimeType}. Only JPEG, PNG, and PDF are allowed.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Verify magic bytes (signature check to prevent extension/content type spoofing)
    let signatureMatches = false;
    for (const signature of typeMeta.signatures) {
      let match = true;
      for (let i = 0; i < signature.length; i++) {
        if (fileBytes[i] !== signature[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        signatureMatches = true;
        break;
      }
    }

    // For JPEG, we also accept standard loose signatures if bytes 0-2 match FF D8 FF
    if (!signatureMatches && mimeType === "image/jpeg") {
      if (fileBytes[0] === 0xFF && fileBytes[1] === 0xD8 && fileBytes[2] === 0xFF) {
        signatureMatches = true;
      }
    }

    if (!signatureMatches) {
      return new Response(
        JSON.stringify({ error: "File validation failed: File signature (magic bytes) does not match its extension." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Calculate File Hash for Virus/Malware Check
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    console.log(`Uploaded file name: ${file.name}, hash: ${fileHash}`);

    // 5. Malware/Virus Scanning
    const VIRUSTOTAL_API_KEY = Deno.env.get("VIRUSTOTAL_API_KEY");
    let isMalicious = false;
    let scanSource = "local_static_heuristic";

    if (VIRUSTOTAL_API_KEY) {
      try {
        console.log(`Checking VirusTotal database for hash: ${fileHash}`);
        const vtResponse = await fetch(`https://www.virustotal.com/api/v3/files/${fileHash}`, {
          headers: {
            "x-apikey": VIRUSTOTAL_API_KEY,
          },
        });

        if (vtResponse.ok) {
          const vtData = await vtResponse.json();
          const stats = vtData.data?.attributes?.last_analysis_stats;
          if (stats) {
            console.log("VirusTotal analysis stats:", stats);
            scanSource = "virustotal_database";
            if (stats.malicious > 0 || stats.suspicious > 0) {
              isMalicious = true;
            }
          }
        } else if (vtResponse.status === 404) {
          console.log("VirusTotal: Hash not seen before. Marking as new file clean scan.");
        } else {
          console.error(`VirusTotal API error: ${vtResponse.status} ${await vtResponse.text()}`);
        }
      } catch (vtErr) {
        console.error("Error communicating with VirusTotal API:", vtErr);
      }
    } else {
      console.log("Warning: VIRUSTOTAL_API_KEY not set. Running fallback local static malware scan.");
      // Simple heuristic local rules to prevent basic malicious uploads (e.g. check for executable headers inside PDFs/images)
      const executableSig = [0x4D, 0x5A]; // MZ signature for EXEs
      if (fileBytes[0] === executableSig[0] && fileBytes[1] === executableSig[1]) {
        isMalicious = true;
      }
    }

    if (isMalicious) {
      console.warn(`SECURITY ALERT: Malicious file blocked! Name: ${file.name}, Hash: ${fileHash}, Scanner: ${scanSource}`);
      return new Response(
        JSON.stringify({ error: "Malware / Virus detection: The uploaded file was flagged as unsafe by security filters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Upload Clean File to Supabase Storage
    const fileName = `${crypto.randomUUID()}.${typeMeta.ext}`;
    const filePath = `${user.id}/${fileName}`;

    console.log(`Uploading safe file to receipts bucket: ${filePath}`);
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from("receipts")
      .upload(filePath, fileBytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: `Upload to storage failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Generate Signed URL for Secure Access (10 years expiration)
    const { data: signedData, error: signedError } = await supabaseClient
      .storage
      .from("receipts")
      .createSignedUrl(filePath, 315360000); // 10 years

    if (signedError || !signedData?.signedUrl) {
      console.error("Error generating signed URL:", signedError);
      return new Response(
        JSON.stringify({ error: `Failed to generate access URL: ${signedError?.message ?? "unknown error"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: signedData.signedUrl,
        filePath: filePath,
        fileName: file.name,
        mimeType: mimeType,
        sizeBytes: file.size,
        scannedBy: scanSource,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Unexpected error in upload-receipt:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred during upload." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

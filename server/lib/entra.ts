import { ConfidentialClientApplication } from "@azure/msal-node";

export function isEntraConfigured(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_REDIRECT_URI
  );
}

let msalClient: ConfidentialClientApplication | null = null;

export function getMsalClient(): ConfidentialClientApplication {
  if (msalClient) return msalClient;

  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;
  const tenantId = process.env.AZURE_TENANT_ID!;

  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });

  return msalClient;
}

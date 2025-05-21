import "@std/dotenv/load";

// Configuration
const config = {
  domains: Deno.env.get("DOMAINS")?.split(",").map(d => d.trim()) ?? [],
  notificationWebhook: Deno.env.get("DISCORD_WEBHOOK_URL") as string,
};

// Type definitions
type Domain = string;

interface DomainStatus {
  domain: Domain;
  isAvailable: boolean;
  status: string[];
  registrar?: string;
  expiryDate?: string;
  timestamp: Date;
}

interface RdapResponse {
  status?: string[];
  entities?: Array<{
    roles?: string[];
    vcardArray?: any[];
  }>;
  events?: Array<{
    eventAction?: string;
    eventDate?: string;
  }>;
}

// RDAP server discovery function
const findRdapServer = async (tld: string): Promise<string | null> => {

  try {
    const response = await fetch("https://data.iana.org/rdap/dns.json");
    const data = await response.json();

    const server = data.services
      .find((service: any[]) => service[0].includes(`${tld}`))
      ?.[1]?.[0];

    return server || null;
  } catch (error) {
    console.log(error)
    console.error("RDAP server lookup error:", error);
    return null;
  }
};

// Fetch RDAP information for a specific domain
const fetchRdapInfo = async (domain: Domain): Promise<DomainStatus> => {
  const tld = domain.split('.').pop() || "";
  const rdapServer = await findRdapServer(tld);

  if (!rdapServer) {
    return {
      domain,
      isAvailable: false,
      status: ["RDAP server not found"],
      timestamp: new Date()
    };
  }

  try {
    const rdapUrl = `${rdapServer}/domain/${domain}`;
    const response = await fetch(rdapUrl);

    // 404 means the domain doesn't exist (= available)
    if (response.status === 404) {
      return {
        domain,
        isAvailable: true,
        status: ["Available for registration"],
        timestamp: new Date()
      };
    }

    // Parse RDAP response
    const data = await response.json() as RdapResponse;

    // Extract related information
    const extractRegistrar = (data: RdapResponse): string =>
      data.entities
        ?.find(e => e.roles?.includes("registrar"))
        ?.vcardArray?.[1]
        ?.find((v: string[]) => v[0] === "fn")?.[3] || "Unknown";

    const extractExpiryDate = (data: RdapResponse): string =>
      data.events
        ?.find(e => e.eventAction === "expiration")
        ?.eventDate || "";

    return {
      domain,
      isAvailable: false,
      status: data.status || ["Active"],
      registrar: extractRegistrar(data),
      expiryDate: extractExpiryDate(data),
      timestamp: new Date()
    };
  } catch (error) {
    console.error(`RDAP query error for ${domain}:`, error);
    return {
      domain,
      isAvailable: false,
      status: ["Error querying RDAP"],
      timestamp: new Date()
    };
  }
};

// Generate Discord notification payload
const createNotificationPayload = (status: DomainStatus) => {
  // Determine notification color based on status
  const getStatusColor = (status: DomainStatus): number => {
    if (status.isAvailable) return 5814783; // Green (available)
    if (status.status.some(s => /redemption|pending\s*delete/i.test(s))) return 16776960; // Yellow (redemption period)
    return 15548997; // Red (other statuses)
  };

  const color = getStatusColor(status);
  const statusText = status.status.join(", ");

  const title = status.isAvailable
    ? `Domain Available: ${status.domain}`
    : `Domain Status Update: ${status.domain}`;

  const description = status.isAvailable
    ? "This domain is currently available for registration. Please proceed with registration immediately."
    : status.status.some(s => /redemption|pending\s*delete/i.test(s))
      ? "This domain is in redemption period or pending delete status. It may become available soon."
      : "The status of this domain has been updated.";

  // Add mention (if available)
  const content = status.isAvailable
    ? `@everyone 🔍 Domain ${status.domain} is now available! Please proceed with registration!`
    : `🔍 Domain ${status.domain} status: **${statusText}**`;

  // Build additional info fields
  const infoFields = [];

  infoFields.push({
    name: "Status",
    value: statusText || "Unknown",
    inline: true
  });

  if (status.registrar || status.expiryDate) {
    infoFields.push({
      name: "Information",
      value: [
        status.registrar ? `Registrar: ${status.registrar}` : "",
        status.expiryDate ? `Expiry Date: ${status.expiryDate}` : ""
      ].filter(Boolean).join("\n") || "No detailed information",
      inline: true
    });
  }

  infoFields.push({
    name: "Registration Links (if available)",
    value: [
      `[Namecheap](https://www.namecheap.com/domains/registration/results/?domain=${status.domain})`,
      `[Google Domains](https://domains.google.com/registrar/search?searchTerm=${status.domain})`,
      `[GoDaddy](https://www.godaddy.com/domainsearch/find?domainToCheck=${status.domain})`
    ].join("\n")
  });

  return {
    content,
    embeds: [{
      title,
      description,
      color,
      fields: infoFields,
      timestamp: status.timestamp.toISOString()
    }]
  };
};

// Send Discord notification
const sendNotification = async (status: DomainStatus): Promise<void> => {
  try {
    const payload = createNotificationPayload(status);

    await fetch(config.notificationWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log(`Notification sent successfully: ${status.domain} (Status: ${status.status.join(", ")})`);
  } catch (error) {
    console.error("Notification sending error:", error);
  }
};

// Main domain checking process
const checkDomain = async (domain: Domain): Promise<DomainStatus> => {
  console.log(`Checking domain: ${domain}`);
  const status = await fetchRdapInfo(domain);
  console.log(`Result: ${domain} - ${status.isAvailable ? "Available" : "Unavailable"} - ${status.status.join(", ")}`);
  return status;
};

// Check all domains and send notifications
const monitorDomains = async (): Promise<void> => {
  console.log(`${new Date().toISOString()} - Running domain monitoring`);

  // Process all configured domains in parallel
  const results = await Promise.all(
    config.domains.map(async domain => {
      try {
        // Check each domain
        const status = await checkDomain(domain);

        // Notify for interesting statuses
        await sendNotification(status);

        return { success: true, domain, status };
      } catch (error) {
        console.error(`Error processing domain ${domain}:`, error);
        return { success: false, domain, error };
      }
    })
  );

  const successCount = results.filter(r => r.success).length;
  console.log(`Domain monitoring completed: ${successCount}/${config.domains.length} successful`);
};

// Use Deno's built-in cron functionality
Deno.cron("domain-monitor-task", "*/5 * * * *", monitorDomains);

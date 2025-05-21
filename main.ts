import "@std/dotenv/load";

// 設定
const config = {
  domains: Deno.env.get("DOMAINS")?.split(",").map(d => d.trim()) ?? [],
  notificationWebhook: Deno.env.get("DISCORD_WEBHOOK_URL") as string,
};

// 型定義
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

// RDAPサーバー探索関数
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

// 特定ドメインのRDAP情報取得
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

    // 404はドメインが存在しない（=利用可能）
    if (response.status === 404) {
      return {
        domain,
        isAvailable: true,
        status: ["Available for registration"],
        timestamp: new Date()
      };
    }

    // RDAPレスポンスを解析
    const data = await response.json() as RdapResponse;

    // 関連情報の抽出
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

// Discord通知ペイロードの生成
// Discord通知ペイロードの生成
const createNotificationPayload = (status: DomainStatus) => {
  // ステータスに基づいて通知の色を決定
  const getStatusColor = (status: DomainStatus): number => {
    if (status.isAvailable) return 5814783; // 緑色（利用可能）
    if (status.status.some(s => /redemption|pending\s*delete/i.test(s))) return 16776960; // 黄色（リデンプション期間）
    return 15548997; // 赤色（その他のステータス）
  };

  const color = getStatusColor(status);
  const statusText = status.status.join(", ");

  const title = status.isAvailable
    ? `ドメイン利用可能: ${status.domain}`
    : `ドメインステータス更新: ${status.domain}`;

  const description = status.isAvailable
    ? "このドメインは現在登録可能な状態です。すぐに登録手続きを行ってください。"
    : status.status.some(s => /redemption|pending\s*delete/i.test(s))
      ? "このドメインはリデンプション期間またはペンディングデリート状態にあります。間もなく利用可能になる可能性があります。"
      : "このドメインのステータスが更新されました。";

  // メンション追加（登録可能な場合）
  const content = status.isAvailable
    ? `@everyone 🔍 ドメイン ${status.domain} が利用可能になりました！登録手続きを行ってください！`
    : `🔍 ドメイン ${status.domain} のステータス: **${statusText}**`;

  // 追加情報フィールドを構築
  const infoFields = [];

  infoFields.push({
    name: "ステータス",
    value: statusText || "不明",
    inline: true
  });

  if (status.registrar || status.expiryDate) {
    infoFields.push({
      name: "情報",
      value: [
        status.registrar ? `登録者: ${status.registrar}` : "",
        status.expiryDate ? `有効期限: ${status.expiryDate}` : ""
      ].filter(Boolean).join("\n") || "詳細情報なし",
      inline: true
    });
  }

  infoFields.push({
    name: "登録リンク (利用可能な場合)",
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

// Discord通知の送信
const sendNotification = async (status: DomainStatus): Promise<void> => {
  try {
    const payload = createNotificationPayload(status);

    await fetch(config.notificationWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log(`通知送信成功: ${status.domain} (ステータス: ${status.status.join(", ")})`);
  } catch (error) {
    console.error("通知送信エラー:", error);
  }
};

// メインのドメインチェック処理
const checkDomain = async (domain: Domain): Promise<DomainStatus> => {
  console.log(`ドメインをチェック中: ${domain}`);
  const status = await fetchRdapInfo(domain);
  console.log(`結果: ${domain} - ${status.isAvailable ? "利用可能" : "利用不可"} - ${status.status.join(", ")}`);
  return status;
};

// すべてのドメインをチェックして通知
const monitorDomains = async (): Promise<void> => {
  console.log(`${new Date().toISOString()} - ドメイン監視を実行します`);

  // 設定されたすべてのドメインを並行処理
  const results = await Promise.all(
    config.domains.map(async domain => {
      try {
        // 各ドメインをチェック
        const status = await checkDomain(domain);

        // 興味深いステータスの場合は通知
        await sendNotification(status);

        return { success: true, domain, status };
      } catch (error) {
        console.error(`ドメイン ${domain} の処理中にエラーが発生:`, error);
        return { success: false, domain, error };
      }
    })
  );

  const successCount = results.filter(r => r.success).length;
  console.log(`ドメイン監視完了: ${successCount}/${config.domains.length} 成功`);
};

// Deno組み込みのcron機能を使用
Deno.cron("domain-monitor-task", "*/5 * * * *", monitorDomains);
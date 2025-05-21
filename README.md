# Deno Domain Checker

A lightweight domain monitoring system built with Deno that tracks domain status
and sends notifications via Discord when changes are detected.

[![DeepWiki](https://img.shields.io/badge/DeepWiki-yutakobayashidev%2Fdeno--domain--checker-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/yutakobayashidev/deno-domain-checker)

## Features

- Monitor multiple domains for status changes
- Check domain availability using RDAP protocol
- Send notifications to Discord when domains become available or change status
- Automatically run checks at regular intervals (default: every 5 minutes)
- Highlight domains in redemption period or pending delete status

## What is RDAP?

RDAP (Registration Data Access Protocol) is a modern protocol designed to
replace the older WHOIS protocol for querying domain registration data. It
provides structured, machine-readable data about domain names, IP addresses, and
autonomous system numbers.

This tool uses RDAP to check domain status and availability by:

1. Discovering the appropriate RDAP server for a given top-level domain
2. Querying that server for domain registration information
3. Parsing the response to determine domain status

For more information about RDAP, visit the
[ICANN RDAP resource page](https://www.icann.org/en/contracted-parties/registry-operators/resources/registration-data-access-protocol).

## Usage

1. Clone the repository
2. Create a `.env` file based on `.env.example`
3. Configure your Discord webhook URL and domains to monitor
4. Run the application

```bash
deno run --unstable-cron --allow-net --allow-env --allow-read main.ts
```

Or use the predefined task:

```bash
deno task dev
```

## Configuration

Configure the application using environment variables:

```
# Discord Webhook URL for notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url-here

# Comma-separated list of domains to monitor
DOMAINS=example.com,example.org,example.net
```

## Deployment

You can deploy this application to Deno Deploy:

```bash
deno task deploy
```

## License

MIT

import sql from '@/lib/db';

// ── Marketing engagement events store ──────────────────────────────────────
// One row per (campaign, recipient, event) tracked from the embedded
// open-pixel and click-proxy URLs. We deliberately keep events append-only
// so we can later compute first-event / repeat-event timelines if asked,
// but the campaign aggregate views only care about "did this recipient
// open?" / "did this recipient click anything?".

export type MarketingEventType = 'open' | 'click';

let schemaReady: Promise<void> | null = null;
export function ensureMarketingEventsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS marketing_campaign_events (
        id BIGSERIAL PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        event TEXT NOT NULL,
        url TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mkt_events_campaign ON marketing_campaign_events(campaign_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mkt_events_camp_recip ON marketing_campaign_events(campaign_id, recipient_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mkt_events_camp_event ON marketing_campaign_events(campaign_id, event)`;
    })().catch(err => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

export async function recordMarketingEvent(params: {
  campaignId: string;
  recipientId: string;
  event: MarketingEventType;
  url?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await ensureMarketingEventsSchema();
  const { campaignId, recipientId, event } = params;
  if (!campaignId || !recipientId || (event !== 'open' && event !== 'click')) return;
  await sql`
    INSERT INTO marketing_campaign_events (campaign_id, recipient_id, event, url, user_agent)
    VALUES (${campaignId}, ${recipientId}, ${event}, ${params.url ?? null}, ${(params.userAgent ?? '').slice(0, 300) || null})
  `;
}

export interface RecipientEngagement {
  opened: boolean;
  openCount: number;
  firstOpenedAt: string | null;
  clicked: boolean;
  clickCount: number;
  firstClickedAt: string | null;
}

interface RecipientEngagementRow {
  recipient_id: string;
  opens: number;
  clicks: number;
  first_open: string | null;
  first_click: string | null;
}

export async function getCampaignEngagementByRecipient(campaignId: string): Promise<Map<string, RecipientEngagement>> {
  await ensureMarketingEventsSchema();
  const rows = (await sql`
    SELECT
      recipient_id,
      COUNT(*) FILTER (WHERE event = 'open')::int  AS opens,
      COUNT(*) FILTER (WHERE event = 'click')::int AS clicks,
      MIN(created_at) FILTER (WHERE event = 'open')  AS first_open,
      MIN(created_at) FILTER (WHERE event = 'click') AS first_click
    FROM marketing_campaign_events
    WHERE campaign_id = ${campaignId}
    GROUP BY recipient_id
  `) as unknown as RecipientEngagementRow[];
  const out = new Map<string, RecipientEngagement>();
  for (const r of rows || []) {
    out.set(r.recipient_id, {
      opened: Number(r.opens) > 0,
      openCount: Number(r.opens) || 0,
      firstOpenedAt: r.first_open ? new Date(r.first_open).toISOString() : null,
      clicked: Number(r.clicks) > 0,
      clickCount: Number(r.clicks) || 0,
      firstClickedAt: r.first_click ? new Date(r.first_click).toISOString() : null,
    });
  }
  return out;
}

export interface CampaignEngagementTotals {
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
}

interface EngagementTotalsRow {
  unique_opens: number;
  total_opens: number;
  unique_clicks: number;
  total_clicks: number;
}

export interface CampaignClicksByUrl {
  url: string;
  totalClicks: number;
  uniqueClickers: number;
}

interface ClicksByUrlRow {
  url: string | null;
  total_clicks: number;
  unique_clickers: number;
}

// Aggregate every click event for a campaign by destination URL so the
// drilldown can rank which CTAs were actually pulled. Rows with a null/empty
// url are dropped — those would just be noise from very old events recorded
// before the click-proxy started passing the destination through.
export async function getCampaignClicksByUrl(campaignId: string): Promise<CampaignClicksByUrl[]> {
  await ensureMarketingEventsSchema();
  const rows = (await sql`
    SELECT
      url,
      COUNT(*)::int                          AS total_clicks,
      COUNT(DISTINCT recipient_id)::int      AS unique_clickers
    FROM marketing_campaign_events
    WHERE campaign_id = ${campaignId}
      AND event = 'click'
      AND url IS NOT NULL
      AND url <> ''
    GROUP BY url
    ORDER BY total_clicks DESC, unique_clickers DESC, url ASC
  `) as unknown as ClicksByUrlRow[];
  return (rows || []).map(r => ({
    url: String(r.url || ''),
    totalClicks: Number(r.total_clicks) || 0,
    uniqueClickers: Number(r.unique_clickers) || 0,
  }));
}

export interface CampaignClicksByDay {
  date: string;          // YYYY-MM-DD (UTC)
  url: string;           // empty string == aggregate row across all URLs
  totalClicks: number;
  uniqueClickers: number;
}

interface ClicksByDayRow {
  date: string;
  url: string | null;
  total_clicks: number;
  unique_clickers: number;
}

// Bucket every click event into per-day rows so the campaign drilldown can
// chart engagement decay over time. We emit one row per (day, url) pair so
// the client can either show the all-links total or filter to a single CTA
// without a second round-trip. Days are bucketed in UTC — small caveat
// surfaced in the UI tooltip — to keep the SQL portable.
export async function getCampaignClicksByDay(campaignId: string): Promise<CampaignClicksByDay[]> {
  await ensureMarketingEventsSchema();
  const rows = (await sql`
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
      COALESCE(url, '')                                                       AS url,
      COUNT(*)::int                                                           AS total_clicks,
      COUNT(DISTINCT recipient_id)::int                                       AS unique_clickers
    FROM marketing_campaign_events
    WHERE campaign_id = ${campaignId}
      AND event = 'click'
    GROUP BY 1, 2
    ORDER BY 1 ASC, total_clicks DESC
  `) as unknown as ClicksByDayRow[];
  return (rows || []).map(r => ({
    date: String(r.date || ''),
    url: String(r.url || ''),
    totalClicks: Number(r.total_clicks) || 0,
    uniqueClickers: Number(r.unique_clickers) || 0,
  }));
}

export async function getCampaignEngagementTotals(campaignId: string): Promise<CampaignEngagementTotals> {
  await ensureMarketingEventsSchema();
  const rows = (await sql`
    SELECT
      COUNT(DISTINCT recipient_id) FILTER (WHERE event = 'open')::int  AS unique_opens,
      COUNT(*) FILTER (WHERE event = 'open')::int                       AS total_opens,
      COUNT(DISTINCT recipient_id) FILTER (WHERE event = 'click')::int AS unique_clicks,
      COUNT(*) FILTER (WHERE event = 'click')::int                      AS total_clicks
    FROM marketing_campaign_events
    WHERE campaign_id = ${campaignId}
  `) as unknown as EngagementTotalsRow[];
  const r = rows?.[0];
  return {
    uniqueOpens: Number(r?.unique_opens || 0),
    totalOpens: Number(r?.total_opens || 0),
    uniqueClicks: Number(r?.unique_clicks || 0),
    totalClicks: Number(r?.total_clicks || 0),
  };
}

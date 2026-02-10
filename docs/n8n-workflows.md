# n8n Workflow: RSS to Draft Pipeline

## Overview
This workflow fetches RSS feeds, processes items, generates AI content, and sends for approval.

## Prerequisites
- n8n instance (self-hosted or cloud)
- Supabase project URL and service role key
- LLM API key (OpenAI/Anthropic/Gemini)

---

## Workflow A: RSS → AI Generation → Approval

### Trigger: Schedule (every 15 minutes)

```
┌─────────────────┐
│  Schedule       │
│  (15 min)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  Get RSS Sources│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Loop: Sources  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RSS Read       │
│  (fetch feed)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Loop: Items    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTTP Request   │
│  POST /webhook  │
│  process-rss    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTTP Request   │
│  POST /webhook  │
│  generate-ai    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTTP Request   │
│  POST /webhook  │
│  send-approval  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Telegram/Email │
│  Notification   │
└─────────────────┘
```

---

## Webhook Endpoints

### POST /api/webhook/process-rss
```json
{
  "title": "Article Title",
  "description": "Article description",
  "link": "https://example.com/article",
  "guid": "unique-id",
  "sourceId": "uuid-of-source",
  "categoryId": "uuid-of-category",
  "image": "https://example.com/image.jpg"
}
```

### POST /api/webhook/generate-ai
```json
{
  "contentId": "uuid-of-content"
}
```

### POST /api/webhook/send-approval
```json
{
  "contentId": "uuid-of-content"
}
```

---

## Workflow B: Approval → Publish

### Trigger: Webhook (on approval action)

```
┌─────────────────┐
│  Webhook        │
│  /approved      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  Get Content    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate Image │
│  (Playwright)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Buffer API     │
│  Schedule Post  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  Update Status  │
└─────────────────┘
```

---

## n8n JSON Import

Copy this into n8n to import the workflow:

```json
{
  "name": "RSS to Draft Pipeline",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [{ "field": "minutes", "minutesInterval": 15 }]
        }
      }
    },
    {
      "name": "Get RSS Sources",
      "type": "n8n-nodes-base.supabase",
      "position": [450, 300],
      "parameters": {
        "operation": "getAll",
        "tableId": "rss_sources",
        "filters": {
          "conditions": [
            { "keyName": "is_active", "condition": "equal", "keyValue": true }
          ]
        }
      }
    },
    {
      "name": "Loop Sources",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [650, 300],
      "parameters": { "batchSize": 1 }
    },
    {
      "name": "Fetch RSS",
      "type": "n8n-nodes-base.rssFeedRead",
      "position": [850, 300],
      "parameters": {
        "url": "={{ $json.url }}"
      }
    }
  ],
  "connections": {
    "Schedule Trigger": { "main": [[{ "node": "Get RSS Sources", "type": "main", "index": 0 }]] },
    "Get RSS Sources": { "main": [[{ "node": "Loop Sources", "type": "main", "index": 0 }]] },
    "Loop Sources": { "main": [[{ "node": "Fetch RSS", "type": "main", "index": 0 }]] }
  }
}
```

---

## Environment Variables for n8n

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
APP_WEBHOOK_URL=https://your-app.com/api/webhook
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

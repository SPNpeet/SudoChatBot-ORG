# REPO MAP
> generated: 2026-07-18T21:15:43.320Z · files: 56 · lines: 4,949

## ./
- middleware.ts (36L) → middleware, config

## app/
- layout.tsx (29L) → metadata, viewport, default  ⇒ route: / (layout)
- manifest.ts (17L) → default
- page.tsx (90L) → default  ⇒ route: /

## app/(legal)/
- layout.tsx (23L) → default  ⇒ route: / (layout)

## app/(legal)/data-deletion/
- page.tsx (35L) → metadata, default  ⇒ route: /data-deletion

## app/(legal)/privacy/
- page.tsx (59L) → metadata, default  ⇒ route: /privacy

## app/(legal)/terms/
- page.tsx (42L) → metadata, default  ⇒ route: /terms

## app/api/admin/test-ai/
- route.ts (61L) → POST  ⇒ route: /api/admin/test-ai (API)

## app/api/billing/omise/webhook/
- route.ts (66L) → POST  ⇒ route: /api/billing/omise/webhook (API)

## app/api/billing/topup-slip/
- route.ts (58L) → POST  ⇒ route: /api/billing/topup-slip (API)

## app/api/channels/meta/callback/
- route.ts (74L) → GET  ⇒ route: /api/channels/meta/callback (API)

## app/api/channels/meta/start/
- route.ts (30L) → GET  ⇒ route: /api/channels/meta/start (API)

## app/api/health/
- route.ts (36L) → dynamic, GET  ⇒ route: /api/health (API)

## app/auth/callback/
- route.ts (21L) → GET  ⇒ route: /auth/callback (API)

## app/dashboard/
- actions.ts [use server] (439L) → toggleConversationMode, sendManualReply, markShipped, verifyPaymentManual, upsertProduct, archiveProduct, addKnowledgeText, uploadKnowledgeFile, deleteDocument, saveBotSettings, …
- layout.tsx (82L) → default  ⇒ route: /dashboard (layout)
- mobile-nav.tsx [use client] (58L) → default
- notifications.tsx (42L) → default
- page.tsx (107L) → dynamic, default  ⇒ route: /dashboard
- revenue-chart.tsx [use client] (31L) → default
- setup-checklist.tsx (91L) → default

## app/dashboard/admin/
- actions.ts [use server] (73L) → claimAdmin, saveProviderKey, deleteProviderKey, saveRouting
- ai-center.tsx [use client] (195L) → default
- page.tsx (57L) → dynamic, default  ⇒ route: /dashboard/admin

## app/dashboard/admin/billing/
- actions.ts [use server] (56L) → confirmTopup, savePlatformBilling
- page.tsx (138L) → dynamic, default  ⇒ route: /dashboard/admin/billing

## app/dashboard/billing/
- actions.ts [use server] (96L) → createTopup, createOmiseTopup, getTopupStatus, changePlan
- billing-client.tsx [use client] (161L) → default
- page.tsx (123L) → dynamic, default  ⇒ route: /dashboard/billing

## app/dashboard/billing/receipt/
- print-button.tsx [use client] (11L) → PrintButton

## app/dashboard/billing/receipt/[id]/
- page.tsx (109L) → dynamic, default  ⇒ route: /dashboard/billing/receipt/[id]

## app/dashboard/channels/
- page.tsx (151L) → dynamic, default  ⇒ route: /dashboard/channels

## app/dashboard/chats/
- chat-live.tsx [use client] (28L) → default
- page.tsx (153L) → dynamic, default  ⇒ route: /dashboard/chats

## app/dashboard/knowledge/
- page.tsx (114L) → dynamic, default  ⇒ route: /dashboard/knowledge

## app/dashboard/orders/
- page.tsx (135L) → dynamic, default  ⇒ route: /dashboard/orders

## app/dashboard/playground/
- actions.ts [use server] (73L) → PlaygroundTurn, PlaygroundReply, playgroundReply
- chat.tsx [use client] (151L) → default
- engine.ts (368L) → ChatConfig, PlaygroundCtx, PlaygroundResult, resolvePlaygroundConfig, TOOL_LABEL_TH, runPlayground
- page.tsx (40L) → dynamic, default  ⇒ route: /dashboard/playground

## app/dashboard/products/
- page.tsx (96L) → dynamic, default  ⇒ route: /dashboard/products
- product-form.tsx [use client] (116L) → default

## app/dashboard/settings/
- page.tsx (205L) → dynamic, default  ⇒ route: /dashboard/settings

## app/dashboard/slips/
- page.tsx (145L) → dynamic, default  ⇒ route: /dashboard/slips

## app/login/
- page.tsx [use client] (131L) → default  ⇒ route: /login

## app/onboarding/
- page.tsx [use server] (41L) → default  ⇒ route: /onboarding

## components/
- logo.tsx (14L) → Logo
- ui.tsx (115L) → Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea, Select, Label, Badge, …

## lib/
- ai-catalog.ts (73L) → Provider, PROVIDERS, OPENAI_COMPAT_BASE, CHAT_MODELS, EMBED_MODELS, TIERS, providerLabel
- omise.ts (63L) → OmiseCharge, getOmiseSecretKey, createPromptPayCharge, retrieveCharge
- shop.ts (39L) → requireUser, getCurrentShop, assertMember
- utils.ts (38L) → cn, baht, dateTH, timeAgo, ORDER_STATUS_TH, DOC_STATUS_TH

## lib/supabase/
- client.ts [use client] (10L) → createClient
- server.ts (32L) → createClient, createServiceClient

## lib/types/
- db.ts (72L) → Shop, Channel, Customer, Conversation, Message, Product, ProductVariant, Order, Payment, KnowledgeDocument, …

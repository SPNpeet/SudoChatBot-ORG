# REPO MAP
> generated: 2026-07-23T13:17:42.496Z · files: 119 · lines: 11,169

## ./
- middleware.ts (36L) → middleware, config

## app/
- apple-icon.tsx (25L) → size, contentType, default
- error.tsx [use client] (18L) → default
- global-error.tsx [use client] (34L) → default
- icon.tsx (25L) → size, contentType, default
- layout.tsx (81L) → metadata, viewport, default  ⇒ route: / (layout)
- manifest.ts (17L) → default
- not-found.tsx (23L) → default
- opengraph-image.tsx (38L) → size, contentType, alt, default
- page.tsx (204L) → default  ⇒ route: /
- robots.ts (9L) → default
- sitemap.ts (14L) → default

## app/(legal)/
- layout.tsx (24L) → default  ⇒ route: / (layout)

## app/(legal)/data-deletion/
- page.tsx (35L) → metadata, default  ⇒ route: /data-deletion

## app/(legal)/privacy/
- page.tsx (59L) → metadata, default  ⇒ route: /privacy

## app/(legal)/terms/
- page.tsx (42L) → metadata, default  ⇒ route: /terms

## app/api/admin/test-ai/
- route.ts (63L) → POST  ⇒ route: /api/admin/test-ai (API)

## app/api/billing/omise/webhook/
- route.ts (66L) → POST  ⇒ route: /api/billing/omise/webhook (API)

## app/api/billing/topup-slip/
- route.ts (58L) → POST  ⇒ route: /api/billing/topup-slip (API)

## app/api/finance/extract/
- route.ts (227L) → maxDuration, ExtractedBill, POST  ⇒ route: /api/finance/extract (API)

## app/api/health/
- route.ts (36L) → dynamic, GET  ⇒ route: /api/health (API)

## app/api/log-error/
- route.ts (25L) → POST  ⇒ route: /api/log-error (API)

## app/api/products/import-extract/
- route.ts (227L) → maxDuration, ImportRow, POST  ⇒ route: /api/products/import-extract (API)

## app/api/public/doc/slip/
- route.ts (87L) → maxDuration, POST  ⇒ route: /api/public/doc/slip (API)

## app/auth/callback/
- route.ts (21L) → GET  ⇒ route: /auth/callback (API)

## app/dashboard/
- actions.ts [use server] (226L) → ActionResult, submitFeedback, upsertProduct, archiveProduct, uploadProductImage, savePaymentSettings, addMember, removeMember, markNotificationRead, saveTaxInfo, …
- cashflow-chart.tsx [use client] (33L) → default
- company-switcher.tsx [use client] (87L) → CompanyLite, default
- error.tsx [use client] (27L) → default
- feedback-widget.tsx [use client] (61L) → default
- layout.tsx (117L) → default  ⇒ route: /dashboard (layout)
- loading.tsx (25L) → default
- mobile-nav.tsx [use client] (70L) → default
- notifications.tsx (49L) → default
- page.tsx (139L) → dynamic, default  ⇒ route: /dashboard
- setup-checklist.tsx (91L) → default

## app/dashboard/admin/
- actions.ts [use server] (114L) → claimAdmin, saveProviderKey, deleteProviderKey, saveRouting, PurposeKeyPurpose, savePurposeKey, deletePurposeKey, AiGuardResult, savePlatformAiGuard
- ai-center.tsx [use client] (301L) → PurposeKeyRow, default
- ai-guard-card.tsx [use client] (112L) → AiGuardStatus, default
- page.tsx (64L) → dynamic, default  ⇒ route: /dashboard/admin

## app/dashboard/admin/billing/
- actions.ts [use server] (103L) → ActionResult, PendingTopup, ListTopupsResult, listPendingTopups, confirmTopup, savePlatformBilling
- billing-settings-form.tsx [use client] (92L) → default
- page.tsx (75L) → dynamic, default  ⇒ route: /dashboard/admin/billing
- pending-topups-list.tsx [use client] (39L) → default
- topup-row.tsx [use client] (45L) → default

## app/dashboard/admin/feedback/
- actions.ts [use server] (29L) → ActionResult, markFeedback
- feedback-row.tsx [use client] (54L) → default
- page.tsx (62L) → dynamic, default  ⇒ route: /dashboard/admin/feedback

## app/dashboard/admin/logs/
- page.tsx (82L) → dynamic, default  ⇒ route: /dashboard/admin/logs

## app/dashboard/admin/shops/
- actions.ts [use server] (49L) → ActionResult, setShopStatus, setShopPlan
- page.tsx (69L) → dynamic, default  ⇒ route: /dashboard/admin/shops
- shop-row.tsx [use client] (56L) → default

## app/dashboard/admin/stats/
- page.tsx (209L) → dynamic, default  ⇒ route: /dashboard/admin/stats

## app/dashboard/assistant/
- actions.ts [use server] (61L) → AssistantTurn, AssistantReply, assistantReply
- chat.tsx [use client] (144L) → default
- engine.ts (699L) → AssistantCtx, AssistantResult, ASSISTANT_TOOL_LABEL_TH, runAssistant
- page.tsx (57L) → dynamic, maxDuration, default  ⇒ route: /dashboard/assistant

## app/dashboard/billing/
- actions.ts [use server] (120L) → TopupResult, PlanResult, createTopup, createOmiseTopup, getTopupStatus, changePlan
- billing-client.tsx [use client] (225L) → default
- page.tsx (142L) → dynamic, default  ⇒ route: /dashboard/billing

## app/dashboard/billing/receipt/
- print-button.tsx [use client] (11L) → PrintButton

## app/dashboard/billing/receipt/[id]/
- page.tsx (109L) → dynamic, default  ⇒ route: /dashboard/billing/receipt/[id]

## app/dashboard/contacts/
- contact-form.tsx [use client] (106L) → default
- page.tsx (107L) → dynamic, default  ⇒ route: /dashboard/contacts

## app/dashboard/expenses/
- page.tsx (91L) → dynamic, default  ⇒ route: /dashboard/expenses

## app/dashboard/expenses/[id]/
- page.tsx (125L) → dynamic, maxDuration, default  ⇒ route: /dashboard/expenses/[id]

## app/dashboard/expenses/new/
- page.tsx (27L) → dynamic, maxDuration, default  ⇒ route: /dashboard/expenses/new

## app/dashboard/finance/
- actions.ts [use server] (590L) → ActionResult, DocResult, upsertContact, archiveContact, uploadFinFile, SaveDocInput, saveDoc, voidDoc, convertDoc, RecordPaymentInput, …
- doc-actions.tsx [use client] (176L) → DocActionsProps, default
- doc-form.tsx [use client] (318L) → DocFormProps, default

## app/dashboard/help/
- page.tsx (91L) → dynamic, default  ⇒ route: /dashboard/help

## app/dashboard/journal/
- manual-form.tsx [use client] (100L) → default
- page.tsx (107L) → dynamic, default  ⇒ route: /dashboard/journal

## app/dashboard/money/
- page.tsx (135L) → dynamic, maxDuration, default  ⇒ route: /dashboard/money
- slip-match.tsx [use client] (91L) → default
- statement-import.tsx [use client] (117L) → default

## app/dashboard/print/[id]/
- page.tsx (239L) → dynamic, default  ⇒ route: /dashboard/print/[id]
- print-button.tsx [use client] (12L) → default

## app/dashboard/products/
- archive-button.tsx [use client] (26L) → default
- page.tsx (96L) → dynamic, default  ⇒ route: /dashboard/products
- product-form.tsx [use client] (128L) → default

## app/dashboard/products/import/
- actions.ts [use server] (97L) → BulkRow, BulkOptions, BulkResult, bulkImportProducts
- import-client.tsx [use client] (295L) → default
- page.tsx (20L) → dynamic, default  ⇒ route: /dashboard/products/import

## app/dashboard/reports/
- export-buttons.tsx [use client] (46L) → default
- page.tsx (444L) → dynamic, default  ⇒ route: /dashboard/reports

## app/dashboard/sales/
- page.tsx (97L) → dynamic, default  ⇒ route: /dashboard/sales

## app/dashboard/sales/[id]/
- page.tsx (130L) → dynamic, maxDuration, default  ⇒ route: /dashboard/sales/[id]

## app/dashboard/sales/new/
- page.tsx (37L) → dynamic, maxDuration, default  ⇒ route: /dashboard/sales/new

## app/dashboard/settings/
- page.tsx (64L) → dynamic, default  ⇒ route: /dashboard/settings
- payment-settings-form.tsx [use client] (56L) → default
- tax-info-form.tsx [use client] (36L) → default
- team-form.tsx [use client] (71L) → default

## app/doc/[key]/
- page.tsx (130L) → dynamic, default  ⇒ route: /doc/[key]
- slip-upload.tsx [use client] (51L) → default

## app/icon-192.png/
- route.tsx (22L) → GET

## app/icon-512.png/
- route.tsx (22L) → GET

## app/login/
- page.tsx [use client] (142L) → default  ⇒ route: /login

## app/onboarding/
- page.tsx (66L) → default  ⇒ route: /onboarding
- submit-button.tsx [use client] (19L) → default

## components/
- logo.tsx (10L) → Logo
- submit-button.tsx [use client] (28L) → default
- ui.tsx (120L) → Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea, Select, Label, Badge, …

## lib/
- ads-errors.ts (29L) → friendlyAdsError
- ai-catalog.ts (100L) → Provider, PROVIDERS, OPENAI_COMPAT_BASE, CHAT_MODELS, EMBED_MODELS, TIERS, providerLabel, estimateAiCost
- ai-config.ts (67L) → ChatConfig, DEFAULT_CHAT_MODEL, resolvePurposeKey, resolveDefaultAiConfig
- ai-errors.ts (41L) → friendlyAiError
- channel-errors.ts (17L) → friendlyChannelError
- finance-server.ts (154L) → ACC, JournalLineInput, PostJournalInput, postJournal, reverseJournalOf, bkkToday, PayableDoc, applyPaymentToDoc
- finance.ts (132L) → DOC_TYPE_TH, DOC_STATUS_TH, QT_STATUS_TH, docStatusLabel, docStatusTone, WHT_RATES, DocTotals, calcDocTotals, agingBucket, AGING_LABEL_TH, …
- omise.ts (63L) → OmiseCharge, getOmiseSecretKey, createPromptPayCharge, retrieveCharge
- promptpay.ts (15L) → promptPayPayload
- shop.ts (60L) → requireUser, getMemberships, getCurrentShop, assertMember, isPlatformAdmin
- slip-verify.ts (85L) → SlipResult, verifyWithEasySlip, verifyWithSlipOK, verifySlip
- utils.ts (46L) → cn, baht, bahtDoc, dateTH, dateOnlyTH, timeAgo, PLAN_TH, SHOP_STATUS_TH

## lib/supabase/
- client.ts [use client] (10L) → createClient
- server.ts (32L) → createClient, createServiceClient

## lib/types/
- db.ts (21L) → Shop, Product, ProductVariant, ShopPaymentSettings
- finance.ts (70L) → DocType, DocStatus, VatMode, Contact, ExpenseCategory, FinDocItem, FinDoc, FinPayment, Account, JournalEntry, …

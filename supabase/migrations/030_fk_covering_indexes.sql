-- 030: เพิ่ม covering index ให้ FK ที่ advisor แจ้ง (unindexed_foreign_keys) — idempotent
create index if not exists ai_provider_keys_updated_by_idx on ai_provider_keys (updated_by);
create index if not exists ai_settings_updated_by_idx on ai_settings (updated_by);
create index if not exists channels_connected_by_idx on channels (connected_by);
create index if not exists conversations_assigned_to_idx on conversations (assigned_to);
create index if not exists knowledge_documents_created_by_idx on knowledge_documents (created_by);
create index if not exists orders_channel_id_idx on orders (channel_id);
create index if not exists payments_verifier_id_idx on payments (verifier_id);
create index if not exists shop_members_invited_by_idx on shop_members (invited_by);
create index if not exists topups_created_by_idx on topups (created_by);
create index if not exists topups_verifier_id_idx on topups (verifier_id);
create index if not exists wallet_transactions_created_by_idx on wallet_transactions (created_by);

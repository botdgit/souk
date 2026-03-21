-- =============================================================
-- Souk — Initial Schema
-- PostgreSQL 16 / Supabase
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE listing_category AS ENUM (
  'designer', 'abayas', 'modest', 'streetwear', 'bags', 'shoes'
);

CREATE TYPE listing_condition AS ENUM (
  'new_with_tags', 'like_new', 'excellent', 'good', 'fair'
);

CREATE TYPE listing_status AS ENUM (
  'draft', 'active', 'reserved', 'sold', 'archived'
);

CREATE TYPE order_status AS ENUM (
  'pending_payment', 'paid', 'shipped', 'delivered', 'completed',
  'disputed', 'refunded', 'cancelled'
);

CREATE TYPE delivery_method AS ENUM ('meetup', 'delivery');

CREATE TYPE offer_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TYPE message_type AS ENUM ('text', 'image', 'offer', 'system');

CREATE TYPE transaction_type AS ENUM ('sale', 'purchase', 'payout', 'refund');

CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');

CREATE TYPE notification_type AS ENUM (
  'new_message', 'new_offer', 'offer_accepted', 'offer_declined',
  'sale_confirmed', 'payment_confirmed', 'payment_failed',
  'payout_sent', 'payout_failed', 'dispute_opened', 'listing_liked'
);

-- =============================================================
-- USERS
-- =============================================================

CREATE TABLE users (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name              TEXT NOT NULL,
  avatar_url                TEXT,
  bio                       TEXT,
  area                      TEXT,
  phone                     TEXT,
  stripe_account_id         TEXT UNIQUE,
  stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_payouts_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified               BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg                NUMERIC(2, 1) DEFAULT 0,
  rating_count              INTEGER NOT NULL DEFAULT 0,
  followers_count           INTEGER NOT NULL DEFAULT 0,
  push_token                TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- LISTINGS
-- =============================================================

CREATE TABLE listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        listing_category NOT NULL,
  brand           TEXT,
  size            TEXT,
  condition       listing_condition NOT NULL,
  price_aed       INTEGER NOT NULL CHECK (price_aed > 0),
  open_to_offers  BOOLEAN NOT NULL DEFAULT FALSE,
  open_to_swaps   BOOLEAN NOT NULL DEFAULT FALSE,
  area            TEXT NOT NULL,
  status          listing_status NOT NULL DEFAULT 'active',
  images          JSONB NOT NULL DEFAULT '[]',
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(brand, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(area, '')
    )
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_seller_id ON listings(seller_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_area ON listings(area);
CREATE INDEX idx_listings_price_aed ON listings(price_aed);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX idx_listings_search_vector ON listings USING GIN(search_vector);

-- =============================================================
-- MEETUP POINTS
-- =============================================================

CREATE TABLE meetup_points (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  latitude    NUMERIC(9, 6) NOT NULL,
  longitude   NUMERIC(9, 6) NOT NULL,
  area        TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed some Dubai meetup points
INSERT INTO meetup_points (name, address, latitude, longitude, area, verified) VALUES
  ('Dubai Mall Main Entrance', 'Financial Centre Road, Downtown Dubai', 25.1972, 55.2796, 'Downtown Dubai', TRUE),
  ('Mall of the Emirates Food Court', 'Sheikh Zayed Road, Al Barsha', 25.1180, 55.2006, 'Al Barsha', TRUE),
  ('JBR The Walk — Roxy Cinemas', 'Jumeirah Beach Residence', 25.0760, 55.1327, 'JBR', TRUE),
  ('City Walk Entrance', 'Al Safa Street, Al Wasl', 25.2000, 55.2414, 'City Walk', TRUE),
  ('Global Village Main Gate', 'Sheikh Mohammed Bin Zayed Road', 25.0691, 55.3049, 'Global Village', TRUE),
  ('Dubai Marina Mall', 'Sheikh Zayed Road, Dubai Marina', 25.0753, 55.1403, 'Dubai Marina', TRUE),
  ('Ibn Battuta Mall Gate 1', 'Sheikh Zayed Road, Jebel Ali', 25.0444, 55.1137, 'Ibn Battuta', TRUE),
  ('Deira City Centre Entrance', 'Garhoud Road, Deira', 25.2524, 55.3290, 'Deira', TRUE);

-- =============================================================
-- ORDERS
-- =============================================================

CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id                  UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_id                    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id                   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_aed                  INTEGER NOT NULL,
  service_fee_aed             INTEGER NOT NULL,
  delivery_fee_aed            INTEGER NOT NULL DEFAULT 0,
  total_aed                   INTEGER NOT NULL,
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_transfer_id          TEXT,
  status                      order_status NOT NULL DEFAULT 'pending_payment',
  delivery_method             delivery_method NOT NULL,
  meetup_point_id             UUID REFERENCES meetup_points(id) ON DELETE SET NULL,
  delivery_confirmed_at       TIMESTAMPTZ,
  payout_released_at          TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_listing_id ON orders(listing_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stripe_pi ON orders(stripe_payment_intent_id);

-- =============================================================
-- OFFERS
-- =============================================================

CREATE TABLE offers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_aed  INTEGER NOT NULL CHECK (amount_aed > 0),
  message     TEXT,
  status      offer_status NOT NULL DEFAULT 'pending',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_offers_listing_id ON offers(listing_id);
CREATE INDEX idx_offers_buyer_id ON offers(buyer_id);

-- =============================================================
-- CONVERSATIONS & MESSAGES
-- =============================================================

CREATE TABLE conversations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id            UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unread_count_buyer    INTEGER NOT NULL DEFAULT 0,
  unread_count_seller   INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT,
  image_url       TEXT,
  type            message_type NOT NULL DEFAULT 'text',
  offer_id        UUID REFERENCES offers(id) ON DELETE SET NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (body IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- =============================================================
-- REVIEWS
-- =============================================================

CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, reviewer_id)
);

CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);

-- =============================================================
-- SAVED ITEMS (WISHLIST)
-- =============================================================

CREATE TABLE saved_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX idx_saved_items_user_id ON saved_items(user_id);

-- =============================================================
-- FOLLOWS
-- =============================================================

CREATE TABLE follows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- =============================================================
-- TRANSACTIONS (IMMUTABLE LEDGER)
-- =============================================================

CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  type              transaction_type NOT NULL,
  amount_aed        INTEGER NOT NULL,
  stripe_reference  TEXT,
  status            transaction_status NOT NULL DEFAULT 'pending',
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_order_id ON transactions(order_id);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;

-- =============================================================
-- PROCESSED STRIPE EVENTS (IDEMPOTENCY)
-- =============================================================

CREATE TABLE processed_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- HELPER FUNCTIONS
-- =============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_listings_updated_at BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recalculate user rating after new review
CREATE OR REPLACE FUNCTION update_user_rating(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET
    rating_avg = (SELECT ROUND(AVG(rating)::NUMERIC, 1) FROM reviews WHERE reviewee_id = user_id),
    rating_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = user_id)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Increment/decrement followers count
CREATE OR REPLACE FUNCTION increment_followers(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET followers_count = followers_count + 1 WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_followers(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Increment unread message count
CREATE OR REPLACE FUNCTION increment_unread(conversation_id UUID, field TEXT)
RETURNS VOID AS $$
BEGIN
  IF field = 'unread_count_buyer' THEN
    UPDATE conversations SET unread_count_buyer = unread_count_buyer + 1 WHERE id = conversation_id;
  ELSIF field = 'unread_count_seller' THEN
    UPDATE conversations SET unread_count_seller = unread_count_seller + 1 WHERE id = conversation_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Auto-confirm delivery after 48 hours (run via pg_cron or external scheduler)
CREATE OR REPLACE FUNCTION auto_confirm_deliveries()
RETURNS VOID AS $$
BEGIN
  UPDATE orders
  SET
    status = 'completed',
    delivery_confirmed_at = NOW()
  WHERE
    status IN ('paid', 'shipped', 'delivered')
    AND created_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users: public read, own write
CREATE POLICY "users_public_read" ON users FOR SELECT USING (TRUE);
CREATE POLICY "users_own_write" ON users FOR UPDATE USING (auth.uid() = id);

-- Listings: public read active listings, seller write own
CREATE POLICY "listings_public_read" ON listings FOR SELECT USING (
  status IN ('active', 'sold') OR seller_id = auth.uid()
);
CREATE POLICY "listings_seller_insert" ON listings FOR INSERT WITH CHECK (seller_id = auth.uid());
CREATE POLICY "listings_seller_update" ON listings FOR UPDATE USING (seller_id = auth.uid());
CREATE POLICY "listings_seller_delete" ON listings FOR DELETE USING (seller_id = auth.uid());

-- Orders: buyer or seller can read their own orders
CREATE POLICY "orders_party_read" ON orders FOR SELECT USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);
CREATE POLICY "orders_buyer_insert" ON orders FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "orders_party_update" ON orders FOR UPDATE USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

-- Offers: buyer or listing owner can read
CREATE POLICY "offers_read" ON offers FOR SELECT USING (
  buyer_id = auth.uid() OR
  EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);
CREATE POLICY "offers_buyer_insert" ON offers FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "offers_seller_update" ON offers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

-- Conversations: participant access
CREATE POLICY "conversations_participant_read" ON conversations FOR SELECT USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);
CREATE POLICY "conversations_buyer_insert" ON conversations FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "conversations_participant_update" ON conversations FOR UPDATE USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

-- Messages: conversation participant access
CREATE POLICY "messages_participant_read" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  )
);
CREATE POLICY "messages_participant_insert" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  )
);

-- Reviews: public read, own insert
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (TRUE);
CREATE POLICY "reviews_own_insert" ON reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());

-- Saved items: own access
CREATE POLICY "saved_items_own" ON saved_items FOR ALL USING (user_id = auth.uid());

-- Follows: public read, own insert/delete
CREATE POLICY "follows_public_read" ON follows FOR SELECT USING (TRUE);
CREATE POLICY "follows_own_insert" ON follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_own_delete" ON follows FOR DELETE USING (follower_id = auth.uid());

-- Transactions: own read only
CREATE POLICY "transactions_own_read" ON transactions FOR SELECT USING (user_id = auth.uid());

-- Notifications: own access
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- Meetup points: public read
ALTER TABLE meetup_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetup_points_public_read" ON meetup_points FOR SELECT USING (TRUE);

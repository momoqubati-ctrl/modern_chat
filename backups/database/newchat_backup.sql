--
-- PostgreSQL database dump
--

\restrict S3d3g3lvjLmERzpkpsj34uefQfqNkf5TCkx6HUCSSShp2eH4d8BbEs14h44e5IH

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP INDEX IF EXISTS public.uniq_users_username;
DROP INDEX IF EXISTS public.uniq_topup_orders_order_no;
DROP INDEX IF EXISTS public.uniq_site_master_wallet_site;
DROP INDEX IF EXISTS public.uniq_room_welcome_visit;
DROP INDEX IF EXISTS public.uniq_followers_pair;
DROP INDEX IF EXISTS public.uniq_agents_username;
DROP INDEX IF EXISTS public.uniq_agents_code;
DROP INDEX IF EXISTS public.uniq_agent_wallets_agent;
DROP INDEX IF EXISTS public.idx_users_uid;
DROP INDEX IF EXISTS public.idx_users_topic;
DROP INDEX IF EXISTS public.idx_users_token;
DROP INDEX IF EXISTS public.idx_users_rep_desc;
DROP INDEX IF EXISTS public.idx_users_lid;
DROP INDEX IF EXISTS public.idx_users_ip;
DROP INDEX IF EXISTS public.idx_users_fp;
DROP INDEX IF EXISTS public.idx_users_eval_desc;
DROP INDEX IF EXISTS public.idx_user_notes_uid;
DROP INDEX IF EXISTS public.idx_user_notes_nid;
DROP INDEX IF EXISTS public.idx_user_notes_created_at;
DROP INDEX IF EXISTS public.idx_tsl_txid;
DROP INDEX IF EXISTS public.idx_tsl_order;
DROP INDEX IF EXISTS public.idx_tsl_created_at;
DROP INDEX IF EXISTS public.idx_tsl_agent;
DROP INDEX IF EXISTS public.idx_topup_orders_user_uid;
DROP INDEX IF EXISTS public.idx_topup_orders_status;
DROP INDEX IF EXISTS public.idx_topup_orders_requested_at;
DROP INDEX IF EXISTS public.idx_topup_orders_agent_id;
DROP INDEX IF EXISTS public.idx_top10wall_uid;
DROP INDEX IF EXISTS public.idx_top10wall_otype;
DROP INDEX IF EXISTS public.idx_toe_order_id;
DROP INDEX IF EXISTS public.idx_toe_created_at;
DROP INDEX IF EXISTS public.idx_sub_timefinish;
DROP INDEX IF EXISTS public.idx_sub_sub;
DROP INDEX IF EXISTS public.idx_sub_iduser;
DROP INDEX IF EXISTS public.idx_story_likes_user;
DROP INDEX IF EXISTS public.idx_story_likes_target;
DROP INDEX IF EXISTS public.idx_story_comments_target;
DROP INDEX IF EXISTS public.idx_story_comments_parent;
DROP INDEX IF EXISTS public.idx_story_comments_cid;
DROP INDEX IF EXISTS public.idx_story_comment_likes_cid_user;
DROP INDEX IF EXISTS public.idx_storieview_sid;
DROP INDEX IF EXISTS public.idx_storieview_idsto;
DROP INDEX IF EXISTS public.idx_storie_sid;
DROP INDEX IF EXISTS public.idx_stats_time;
DROP INDEX IF EXISTS public.idx_stats_room;
DROP INDEX IF EXISTS public.idx_stats_ip;
DROP INDEX IF EXISTS public.idx_smwl_txid;
DROP INDEX IF EXISTS public.idx_smwl_site;
DROP INDEX IF EXISTS public.idx_site_ids;
DROP INDEX IF EXISTS public.idx_site_host;
DROP INDEX IF EXISTS public.idx_rooms_topic;
DROP INDEX IF EXISTS public.idx_rooms_owner;
DROP INDEX IF EXISTS public.idx_rooms_id;
DROP INDEX IF EXISTS public.idx_room_welcome_room;
DROP INDEX IF EXISTS public.idx_profile_visits_visitor;
DROP INDEX IF EXISTS public.idx_profile_visits_owner_seen;
DROP INDEX IF EXISTS public.idx_profile_visits_owner;
DROP INDEX IF EXISTS public.idx_owner_room;
DROP INDEX IF EXISTS public.idx_oat_txid;
DROP INDEX IF EXISTS public.idx_oat_agent;
DROP INDEX IF EXISTS public.idx_notext_type;
DROP INDEX IF EXISTS public.idx_notext_path;
DROP INDEX IF EXISTS public.idx_note_likes_user;
DROP INDEX IF EXISTS public.idx_note_likes_target;
DROP INDEX IF EXISTS public.idx_note_comments_target;
DROP INDEX IF EXISTS public.idx_note_comments_parent;
DROP INDEX IF EXISTS public.idx_note_comments_cid;
DROP INDEX IF EXISTS public.idx_note_comment_likes_cid_user;
DROP INDEX IF EXISTS public.idx_names_ip;
DROP INDEX IF EXISTS public.idx_names_iduser;
DROP INDEX IF EXISTS public.idx_names_fp;
DROP INDEX IF EXISTS public.idx_mail_to_uid;
DROP INDEX IF EXISTS public.idx_mail_from_uid;
DROP INDEX IF EXISTS public.idx_logs_state;
DROP INDEX IF EXISTS public.idx_logs_lookup;
DROP INDEX IF EXISTS public.idx_logs_ip;
DROP INDEX IF EXISTS public.idx_intromsg_category;
DROP INDEX IF EXISTS public.idx_hosts_setting;
DROP INDEX IF EXISTS public.idx_hosts_hostname;
DROP INDEX IF EXISTS public.idx_histletter_topic;
DROP INDEX IF EXISTS public.idx_histletter_ip;
DROP INDEX IF EXISTS public.idx_gift_notif_txid;
DROP INDEX IF EXISTS public.idx_gift_notif_to_uid;
DROP INDEX IF EXISTS public.idx_gift_notif_created_at;
DROP INDEX IF EXISTS public.idx_followers_following;
DROP INDEX IF EXISTS public.idx_followers_follower;
DROP INDEX IF EXISTS public.idx_cuts_text1;
DROP INDEX IF EXISTS public.idx_cp_country;
DROP INDEX IF EXISTS public.idx_cp_active_sort;
DROP INDEX IF EXISTS public.idx_coin_ledger_user_uid;
DROP INDEX IF EXISTS public.idx_coin_ledger_txid;
DROP INDEX IF EXISTS public.idx_coin_ledger_created_at;
DROP INDEX IF EXISTS public.idx_bots_stat;
DROP INDEX IF EXISTS public.idx_bots_room;
DROP INDEX IF EXISTS public.idx_bots_id;
DROP INDEX IF EXISTS public.idx_bars_uid;
DROP INDEX IF EXISTS public.idx_bars_lid_bid;
DROP INDEX IF EXISTS public.idx_bars_lid;
DROP INDEX IF EXISTS public.idx_bars_bid;
DROP INDEX IF EXISTS public.idx_band_name_band;
DROP INDEX IF EXISTS public.idx_band_ip_band;
DROP INDEX IF EXISTS public.idx_band_device_band;
DROP INDEX IF EXISTS public."idx_band_decoderDans";
DROP INDEX IF EXISTS public.idx_band_country_band;
DROP INDEX IF EXISTS public.idx_awl_txid;
DROP INDEX IF EXISTS public.idx_awl_agent;
DROP INDEX IF EXISTS public.idx_apm_agent;
DROP INDEX IF EXISTS public.idx_apm_active;
DROP INDEX IF EXISTS public.idx_agents_status;
DROP INDEX IF EXISTS public.idx_agents_country;
DROP INDEX IF EXISTS public.idx_agent_wallets_status;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.user_notes DROP CONSTRAINT IF EXISTS user_notes_pkey;
ALTER TABLE IF EXISTS ONLY public.topup_settlement_ledger DROP CONSTRAINT IF EXISTS topup_settlement_ledger_pkey;
ALTER TABLE IF EXISTS ONLY public.topup_orders DROP CONSTRAINT IF EXISTS topup_orders_pkey;
ALTER TABLE IF EXISTS ONLY public.topup_order_events DROP CONSTRAINT IF EXISTS topup_order_events_pkey;
ALTER TABLE IF EXISTS ONLY public.top10wall DROP CONSTRAINT IF EXISTS top10wall_pkey;
ALTER TABLE IF EXISTS ONLY public.sub DROP CONSTRAINT IF EXISTS sub_pkey;
ALTER TABLE IF EXISTS ONLY public.story_likes DROP CONSTRAINT IF EXISTS story_likes_pkey;
ALTER TABLE IF EXISTS ONLY public.story_comments DROP CONSTRAINT IF EXISTS story_comments_pkey;
ALTER TABLE IF EXISTS ONLY public.story_comment_likes DROP CONSTRAINT IF EXISTS story_comment_likes_pkey;
ALTER TABLE IF EXISTS ONLY public.storieview DROP CONSTRAINT IF EXISTS storieview_pkey;
ALTER TABLE IF EXISTS ONLY public.storie DROP CONSTRAINT IF EXISTS storie_pkey;
ALTER TABLE IF EXISTS ONLY public.stats DROP CONSTRAINT IF EXISTS stats_pkey;
ALTER TABLE IF EXISTS ONLY public.site DROP CONSTRAINT IF EXISTS site_pkey;
ALTER TABLE IF EXISTS ONLY public.site_master_wallet DROP CONSTRAINT IF EXISTS site_master_wallet_pkey;
ALTER TABLE IF EXISTS ONLY public.site_master_wallet_ledger DROP CONSTRAINT IF EXISTS site_master_wallet_ledger_pkey;
ALTER TABLE IF EXISTS ONLY public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE IF EXISTS ONLY public.rooms DROP CONSTRAINT IF EXISTS rooms_pkey;
ALTER TABLE IF EXISTS ONLY public.room_welcome_visits DROP CONSTRAINT IF EXISTS room_welcome_visits_pkey;
ALTER TABLE IF EXISTS ONLY public.profile_visits DROP CONSTRAINT IF EXISTS profile_visits_pkey;
ALTER TABLE IF EXISTS ONLY public.powers DROP CONSTRAINT IF EXISTS powers_pkey;
ALTER TABLE IF EXISTS ONLY public.owner DROP CONSTRAINT IF EXISTS owner_pkey;
ALTER TABLE IF EXISTS ONLY public.owner_agent_transfers DROP CONSTRAINT IF EXISTS owner_agent_transfers_pkey;
ALTER TABLE IF EXISTS ONLY public.notext DROP CONSTRAINT IF EXISTS notext_pkey;
ALTER TABLE IF EXISTS ONLY public.note_likes DROP CONSTRAINT IF EXISTS note_likes_pkey;
ALTER TABLE IF EXISTS ONLY public.note_comments DROP CONSTRAINT IF EXISTS note_comments_pkey;
ALTER TABLE IF EXISTS ONLY public.note_comment_likes DROP CONSTRAINT IF EXISTS note_comment_likes_pkey;
ALTER TABLE IF EXISTS ONLY public.names DROP CONSTRAINT IF EXISTS names_pkey;
ALTER TABLE IF EXISTS ONLY public.logs DROP CONSTRAINT IF EXISTS logs_pkey;
ALTER TABLE IF EXISTS ONLY public.intromsg DROP CONSTRAINT IF EXISTS intromsg_pkey;
ALTER TABLE IF EXISTS ONLY public.internal_mail DROP CONSTRAINT IF EXISTS internal_mail_pkey;
ALTER TABLE IF EXISTS ONLY public.hosts DROP CONSTRAINT IF EXISTS hosts_pkey;
ALTER TABLE IF EXISTS ONLY public.histletter DROP CONSTRAINT IF EXISTS histletter_pkey;
ALTER TABLE IF EXISTS ONLY public.gift_notifications DROP CONSTRAINT IF EXISTS gift_notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.followers DROP CONSTRAINT IF EXISTS followers_pkey;
ALTER TABLE IF EXISTS ONLY public.cuts DROP CONSTRAINT IF EXISTS cuts_pkey;
ALTER TABLE IF EXISTS ONLY public.coin_packages DROP CONSTRAINT IF EXISTS coin_packages_pkey;
ALTER TABLE IF EXISTS ONLY public.coin_ledger DROP CONSTRAINT IF EXISTS coin_ledger_pkey;
ALTER TABLE IF EXISTS ONLY public.bsb DROP CONSTRAINT IF EXISTS bsb_pkey;
ALTER TABLE IF EXISTS ONLY public.bots DROP CONSTRAINT IF EXISTS bots_pkey;
ALTER TABLE IF EXISTS ONLY public.bars DROP CONSTRAINT IF EXISTS bars_pkey;
ALTER TABLE IF EXISTS ONLY public.band DROP CONSTRAINT IF EXISTS band_pkey;
ALTER TABLE IF EXISTS ONLY public.agents DROP CONSTRAINT IF EXISTS agents_pkey;
ALTER TABLE IF EXISTS ONLY public.agent_wallets DROP CONSTRAINT IF EXISTS agent_wallets_pkey;
ALTER TABLE IF EXISTS ONLY public.agent_wallet_ledger DROP CONSTRAINT IF EXISTS agent_wallet_ledger_pkey;
ALTER TABLE IF EXISTS ONLY public.agent_payment_methods DROP CONSTRAINT IF EXISTS agent_payment_methods_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN idreg DROP DEFAULT;
ALTER TABLE IF EXISTS public.user_notes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.topup_settlement_ledger ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.topup_orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.topup_order_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.top10wall ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.sub ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.story_likes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.story_comments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.story_comment_likes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.storieview ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.storie ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.stats ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.site_master_wallet_ledger ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.site_master_wallet ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.site ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rooms ALTER COLUMN idroom DROP DEFAULT;
ALTER TABLE IF EXISTS public.room_welcome_visits ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.profile_visits ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.powers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.owner_agent_transfers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.owner ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notext ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.note_likes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.note_comments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.note_comment_likes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.names ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.intromsg ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.internal_mail ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.hosts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.histletter ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.gift_notifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.followers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.cuts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.coin_packages ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.coin_ledger ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bsb ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bots ALTER COLUMN idreg DROP DEFAULT;
ALTER TABLE IF EXISTS public.bars ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.band ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.agents ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.agent_wallets ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.agent_wallet_ledger ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.agent_payment_methods ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_idreg_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.user_notes_id_seq;
DROP TABLE IF EXISTS public.user_notes;
DROP SEQUENCE IF EXISTS public.topup_settlement_ledger_id_seq;
DROP TABLE IF EXISTS public.topup_settlement_ledger;
DROP SEQUENCE IF EXISTS public.topup_orders_id_seq;
DROP TABLE IF EXISTS public.topup_orders;
DROP SEQUENCE IF EXISTS public.topup_order_events_id_seq;
DROP TABLE IF EXISTS public.topup_order_events;
DROP SEQUENCE IF EXISTS public.top10wall_id_seq;
DROP TABLE IF EXISTS public.top10wall;
DROP SEQUENCE IF EXISTS public.sub_id_seq;
DROP TABLE IF EXISTS public.sub;
DROP SEQUENCE IF EXISTS public.story_likes_id_seq;
DROP TABLE IF EXISTS public.story_likes;
DROP SEQUENCE IF EXISTS public.story_comments_id_seq;
DROP TABLE IF EXISTS public.story_comments;
DROP SEQUENCE IF EXISTS public.story_comment_likes_id_seq;
DROP TABLE IF EXISTS public.story_comment_likes;
DROP SEQUENCE IF EXISTS public.storieview_id_seq;
DROP TABLE IF EXISTS public.storieview;
DROP SEQUENCE IF EXISTS public.storie_id_seq;
DROP TABLE IF EXISTS public.storie;
DROP SEQUENCE IF EXISTS public.stats_id_seq;
DROP TABLE IF EXISTS public.stats;
DROP SEQUENCE IF EXISTS public.site_master_wallet_ledger_id_seq;
DROP TABLE IF EXISTS public.site_master_wallet_ledger;
DROP SEQUENCE IF EXISTS public.site_master_wallet_id_seq;
DROP TABLE IF EXISTS public.site_master_wallet;
DROP SEQUENCE IF EXISTS public.site_id_seq;
DROP TABLE IF EXISTS public.site;
DROP SEQUENCE IF EXISTS public.settings_id_seq;
DROP TABLE IF EXISTS public.settings;
DROP SEQUENCE IF EXISTS public.rooms_idroom_seq;
DROP TABLE IF EXISTS public.rooms;
DROP SEQUENCE IF EXISTS public.room_welcome_visits_id_seq;
DROP TABLE IF EXISTS public.room_welcome_visits;
DROP SEQUENCE IF EXISTS public.profile_visits_id_seq;
DROP TABLE IF EXISTS public.profile_visits;
DROP SEQUENCE IF EXISTS public.powers_id_seq;
DROP TABLE IF EXISTS public.powers;
DROP SEQUENCE IF EXISTS public.owner_id_seq;
DROP SEQUENCE IF EXISTS public.owner_agent_transfers_id_seq;
DROP TABLE IF EXISTS public.owner_agent_transfers;
DROP TABLE IF EXISTS public.owner;
DROP SEQUENCE IF EXISTS public.notext_id_seq;
DROP TABLE IF EXISTS public.notext;
DROP SEQUENCE IF EXISTS public.note_likes_id_seq;
DROP TABLE IF EXISTS public.note_likes;
DROP SEQUENCE IF EXISTS public.note_comments_id_seq;
DROP TABLE IF EXISTS public.note_comments;
DROP SEQUENCE IF EXISTS public.note_comment_likes_id_seq;
DROP TABLE IF EXISTS public.note_comment_likes;
DROP SEQUENCE IF EXISTS public.names_id_seq;
DROP TABLE IF EXISTS public.names;
DROP SEQUENCE IF EXISTS public.logs_id_seq;
DROP TABLE IF EXISTS public.logs;
DROP SEQUENCE IF EXISTS public.intromsg_id_seq;
DROP TABLE IF EXISTS public.intromsg;
DROP SEQUENCE IF EXISTS public.internal_mail_id_seq;
DROP TABLE IF EXISTS public.internal_mail;
DROP SEQUENCE IF EXISTS public.hosts_id_seq;
DROP TABLE IF EXISTS public.hosts;
DROP SEQUENCE IF EXISTS public.histletter_id_seq;
DROP TABLE IF EXISTS public.histletter;
DROP SEQUENCE IF EXISTS public.gift_notifications_id_seq;
DROP TABLE IF EXISTS public.gift_notifications;
DROP SEQUENCE IF EXISTS public.followers_id_seq;
DROP TABLE IF EXISTS public.followers;
DROP SEQUENCE IF EXISTS public.cuts_id_seq;
DROP TABLE IF EXISTS public.cuts;
DROP SEQUENCE IF EXISTS public.coin_packages_id_seq;
DROP TABLE IF EXISTS public.coin_packages;
DROP SEQUENCE IF EXISTS public.coin_ledger_id_seq;
DROP TABLE IF EXISTS public.coin_ledger;
DROP SEQUENCE IF EXISTS public.bsb_id_seq;
DROP TABLE IF EXISTS public.bsb;
DROP SEQUENCE IF EXISTS public.bots_idreg_seq;
DROP TABLE IF EXISTS public.bots;
DROP SEQUENCE IF EXISTS public.bars_id_seq;
DROP TABLE IF EXISTS public.bars;
DROP SEQUENCE IF EXISTS public.band_id_seq;
DROP TABLE IF EXISTS public.band;
DROP SEQUENCE IF EXISTS public.agents_id_seq;
DROP TABLE IF EXISTS public.agents;
DROP SEQUENCE IF EXISTS public.agent_wallets_id_seq;
DROP TABLE IF EXISTS public.agent_wallets;
DROP SEQUENCE IF EXISTS public.agent_wallet_ledger_id_seq;
DROP TABLE IF EXISTS public.agent_wallet_ledger;
DROP SEQUENCE IF EXISTS public.agent_payment_methods_id_seq;
DROP TABLE IF EXISTS public.agent_payment_methods;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_payment_methods (
    id bigint NOT NULL,
    agent_id bigint NOT NULL,
    method_name character varying(255) NOT NULL,
    account_name character varying(255) DEFAULT ''::character varying,
    account_identifier character varying(255) DEFAULT ''::character varying,
    instructions text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: agent_payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_payment_methods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_payment_methods_id_seq OWNED BY public.agent_payment_methods.id;


--
-- Name: agent_wallet_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_wallet_ledger (
    id bigint NOT NULL,
    txid character varying(128) DEFAULT ''::character varying,
    agent_id bigint NOT NULL,
    event_type character varying(64) NOT NULL,
    amount bigint NOT NULL,
    before_balance bigint NOT NULL,
    after_balance bigint NOT NULL,
    actor_type character varying(64) DEFAULT ''::character varying,
    actor_id character varying(255) DEFAULT ''::character varying,
    counterparty_type character varying(64) DEFAULT ''::character varying,
    counterparty_id character varying(255) DEFAULT ''::character varying,
    note text,
    reference_table character varying(128) DEFAULT ''::character varying,
    reference_id bigint DEFAULT 0,
    created_at bigint NOT NULL
);


--
-- Name: agent_wallet_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_wallet_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_wallet_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_wallet_ledger_id_seq OWNED BY public.agent_wallet_ledger.id;


--
-- Name: agent_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_wallets (
    id bigint NOT NULL,
    agent_id bigint NOT NULL,
    balance_coins bigint DEFAULT 0,
    reserved_coins bigint DEFAULT 0,
    status character varying(32) DEFAULT 'active'::character varying,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: agent_wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_wallets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_wallets_id_seq OWNED BY public.agent_wallets.id;


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id bigint NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    country_code character varying(16) DEFAULT ''::character varying,
    city character varying(255) DEFAULT ''::character varying,
    phone character varying(64) DEFAULT ''::character varying,
    username character varying(64) NOT NULL,
    password_hash text,
    status character varying(32) DEFAULT 'active'::character varying,
    commission_type character varying(32) DEFAULT 'spread'::character varying,
    commission_value numeric(18,4) DEFAULT 0.0000,
    can_receive_orders boolean DEFAULT true,
    notes text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: agents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agents_id_seq OWNED BY public.agents.id;


--
-- Name: band; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.band (
    id integer NOT NULL,
    name_band character varying(255),
    type character varying(255),
    deccode character varying(255),
    "decoderDans" character varying(255),
    device_band character varying(255),
    ip_band character varying(255),
    country_band character varying(2),
    date character varying(255) DEFAULT 'دائم'::character varying
);


--
-- Name: band_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.band_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: band_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.band_id_seq OWNED BY public.band.id;


--
-- Name: bars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bars (
    id integer NOT NULL,
    bcc text,
    likes character varying(2000) DEFAULT '[]'::character varying,
    bg character varying(255),
    bid character varying(255),
    lid character varying(255),
    mcol character varying(255),
    msg text,
    pic character varying(255),
    topic character varying(255),
    ucol character varying(255),
    uid character varying(255)
);


--
-- Name: bars_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bars_id_seq OWNED BY public.bars.id;


--
-- Name: bots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bots (
    idreg integer NOT NULL,
    msg character varying(255) DEFAULT '(عضو جديد)'::character varying,
    pic character varying(255) DEFAULT 'pic.png'::character varying,
    power character varying(255) DEFAULT ''::character varying,
    country character varying(255) DEFAULT ''::character varying,
    room character varying(255) DEFAULT ''::character varying,
    ip character varying(255) DEFAULT ''::character varying,
    id character varying(255) DEFAULT ''::character varying,
    stat integer DEFAULT 0,
    topic character varying(255) DEFAULT ''::character varying
);


--
-- Name: bots_idreg_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bots_idreg_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bots_idreg_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bots_idreg_seq OWNED BY public.bots.idreg;


--
-- Name: bsb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bsb (
    id integer NOT NULL,
    systems character varying(255) DEFAULT ''::character varying,
    browsers character varying(255) DEFAULT ''::character varying
);


--
-- Name: bsb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bsb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bsb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bsb_id_seq OWNED BY public.bsb.id;


--
-- Name: coin_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_ledger (
    id bigint NOT NULL,
    txid character varying(128) DEFAULT ''::character varying,
    event_type character varying(64) NOT NULL,
    actor_uid character varying(255) DEFAULT ''::character varying,
    actor_idreg integer DEFAULT 0,
    user_uid character varying(255) DEFAULT ''::character varying,
    user_idreg integer DEFAULT 0,
    counterparty_uid character varying(255) DEFAULT ''::character varying,
    counterparty_idreg integer DEFAULT 0,
    amount bigint NOT NULL,
    before_balance bigint NOT NULL,
    after_balance bigint NOT NULL,
    gift_file character varying(255) DEFAULT ''::character varying,
    note text,
    ip character varying(255) DEFAULT ''::character varying,
    created_at bigint NOT NULL
);


--
-- Name: coin_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_ledger_id_seq OWNED BY public.coin_ledger.id;


--
-- Name: coin_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_packages (
    id bigint NOT NULL,
    title character varying(255) NOT NULL,
    coins_amount bigint NOT NULL,
    price_local numeric(18,4) DEFAULT 0.0000,
    currency character varying(16) DEFAULT ''::character varying,
    country_code character varying(16) DEFAULT ''::character varying,
    city character varying(255) DEFAULT ''::character varying,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    notes text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: coin_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_packages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_packages_id_seq OWNED BY public.coin_packages.id;


--
-- Name: cuts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuts (
    id integer NOT NULL,
    text1 character varying(255),
    text2 character varying(255)
);


--
-- Name: cuts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuts_id_seq OWNED BY public.cuts.id;


--
-- Name: followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.followers (
    id integer NOT NULL,
    follower_id character varying(255) NOT NULL,
    following_id character varying(255) NOT NULL,
    created_at bigint NOT NULL
);


--
-- Name: followers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.followers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: followers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.followers_id_seq OWNED BY public.followers.id;


--
-- Name: gift_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_notifications (
    id bigint NOT NULL,
    txid character varying(128) DEFAULT ''::character varying,
    to_uid character varying(255) NOT NULL,
    to_idreg integer DEFAULT 0,
    from_uid character varying(255) DEFAULT ''::character varying,
    from_idreg integer DEFAULT 0,
    from_topic character varying(255) DEFAULT ''::character varying,
    gift_file character varying(255) DEFAULT ''::character varying,
    coin bigint DEFAULT 0,
    note text,
    is_read boolean DEFAULT false,
    created_at bigint NOT NULL,
    read_at bigint DEFAULT 0
);


--
-- Name: gift_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gift_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gift_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gift_notifications_id_seq OWNED BY public.gift_notifications.id;


--
-- Name: histletter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.histletter (
    id integer NOT NULL,
    ip character varying(255),
    msg character varying(255),
    topic character varying(255),
    v character varying(255),
    "time" character varying(255),
    target character varying(255),
    source character varying(255),
    path character varying(255)
);


--
-- Name: histletter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.histletter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: histletter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.histletter_id_seq OWNED BY public.histletter.id;


--
-- Name: hosts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hosts (
    id integer NOT NULL,
    hostname character varying(255),
    setting integer
);


--
-- Name: hosts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hosts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hosts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hosts_id_seq OWNED BY public.hosts.id;


--
-- Name: internal_mail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_mail (
    id bigint NOT NULL,
    from_uid character varying(255) NOT NULL,
    from_username character varying(255) DEFAULT ''::character varying,
    from_topic character varying(255) DEFAULT ''::character varying,
    from_pic character varying(255) DEFAULT ''::character varying,
    to_uid character varying(255) NOT NULL,
    to_username character varying(255) DEFAULT ''::character varying,
    to_topic character varying(255) DEFAULT ''::character varying,
    to_pic character varying(255) DEFAULT ''::character varying,
    body text,
    is_read boolean DEFAULT false,
    created_at bigint NOT NULL,
    read_at bigint DEFAULT 0
);


--
-- Name: internal_mail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.internal_mail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: internal_mail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.internal_mail_id_seq OWNED BY public.internal_mail.id;


--
-- Name: intromsg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intromsg (
    id integer NOT NULL,
    category character varying(255),
    adresse character varying(255),
    msg character varying(255)
);


--
-- Name: intromsg_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intromsg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intromsg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intromsg_id_seq OWNED BY public.intromsg.id;


--
-- Name: logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs (
    id integer NOT NULL,
    state character varying(255),
    topic character varying(255),
    username character varying(255),
    ip character varying(255),
    code character varying(255),
    device character varying(255) DEFAULT 'en'::character varying,
    isin character varying(255),
    "time" text
);


--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- Name: names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.names (
    id integer NOT NULL,
    iduser character varying(255),
    fp character varying(255),
    ip character varying(255),
    topic character varying(255),
    username character varying(255)
);


--
-- Name: names_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.names_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: names_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.names_id_seq OWNED BY public.names.id;


--
-- Name: note_comment_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_comment_likes (
    id bigint NOT NULL,
    comment_cid character varying(64) NOT NULL,
    user_uid character varying(255) NOT NULL,
    created_at bigint NOT NULL
);


--
-- Name: note_comment_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.note_comment_likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: note_comment_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.note_comment_likes_id_seq OWNED BY public.note_comment_likes.id;


--
-- Name: note_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_comments (
    id bigint NOT NULL,
    cid character varying(64) NOT NULL,
    note_nid character varying(64) NOT NULL,
    author_uid character varying(255) NOT NULL,
    author_topic character varying(255) DEFAULT ''::character varying,
    author_pic character varying(255) DEFAULT ''::character varying,
    author_ucol character varying(64) DEFAULT ''::character varying,
    author_verified boolean DEFAULT false,
    body text NOT NULL,
    likes_count integer DEFAULT 0,
    created_at bigint NOT NULL,
    parent_cid character varying(64) DEFAULT ''::character varying,
    reply_to_topic character varying(255) DEFAULT ''::character varying
);


--
-- Name: note_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.note_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: note_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.note_comments_id_seq OWNED BY public.note_comments.id;


--
-- Name: note_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_likes (
    id bigint NOT NULL,
    note_nid character varying(64) NOT NULL,
    user_uid character varying(255) NOT NULL,
    topic character varying(255) DEFAULT ''::character varying,
    photo character varying(255) DEFAULT ''::character varying,
    created_at bigint NOT NULL
);


--
-- Name: note_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.note_likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: note_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.note_likes_id_seq OWNED BY public.note_likes.id;


--
-- Name: notext; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notext (
    id integer NOT NULL,
    type character varying(255),
    path character varying(255),
    v character varying(255)
);


--
-- Name: notext_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notext_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notext_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notext_id_seq OWNED BY public.notext.id;


--
-- Name: owner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner (
    id integer NOT NULL,
    bars boolean DEFAULT true,
    "Vpn" boolean DEFAULT false,
    "Gust" text,
    datafinish timestamp without time zone DEFAULT now(),
    "MaxRep" integer DEFAULT 3,
    "Tv" text,
    "Vistor" text,
    room character varying(255),
    isbanner boolean DEFAULT false,
    rc boolean DEFAULT false,
    cooment boolean DEFAULT false,
    offline boolean DEFAULT false
);


--
-- Name: owner_agent_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_agent_transfers (
    id bigint NOT NULL,
    txid character varying(128) DEFAULT ''::character varying,
    agent_id bigint NOT NULL,
    coins_amount bigint NOT NULL,
    settlement_amount_local numeric(18,4) DEFAULT 0.0000,
    currency character varying(16) DEFAULT ''::character varying,
    status character varying(32) DEFAULT 'approved'::character varying,
    note text,
    created_by character varying(255) DEFAULT ''::character varying,
    approved_by character varying(255) DEFAULT ''::character varying,
    created_at bigint NOT NULL,
    approved_at bigint DEFAULT 0
);


--
-- Name: owner_agent_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.owner_agent_transfers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: owner_agent_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.owner_agent_transfers_id_seq OWNED BY public.owner_agent_transfers.id;


--
-- Name: owner_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.owner_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: owner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.owner_id_seq OWNED BY public.owner.id;


--
-- Name: powers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.powers (
    id integer NOT NULL,
    powers text
);


--
-- Name: powers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.powers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: powers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.powers_id_seq OWNED BY public.powers.id;


--
-- Name: profile_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_visits (
    id integer NOT NULL,
    owner_id character varying(255),
    visitor_id character varying(255),
    visitor_name character varying(255),
    visitor_pic character varying(255),
    seen integer DEFAULT 0,
    "time" bigint,
    visitor_type character varying(20) DEFAULT 'عضو'::character varying
);


--
-- Name: profile_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profile_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profile_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profile_visits_id_seq OWNED BY public.profile_visits.id;


--
-- Name: room_welcome_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_welcome_visits (
    id integer NOT NULL,
    room_id character varying(255) NOT NULL,
    identity_key character varying(255) NOT NULL,
    is_guest boolean DEFAULT false,
    first_seen bigint DEFAULT 0,
    last_seen bigint DEFAULT 0,
    visits integer DEFAULT 1
);


--
-- Name: room_welcome_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_welcome_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_welcome_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_welcome_visits_id_seq OWNED BY public.room_welcome_visits.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    idroom integer NOT NULL,
    about character varying(255),
    "user" character varying(255),
    pass character varying(255),
    id character varying(255),
    owner character varying(255),
    topic character varying(255),
    pic character varying(255),
    rmli integer DEFAULT 0,
    mic integer DEFAULT 0,
    welcome character varying(255),
    broadcast boolean DEFAULT false,
    deleted boolean DEFAULT false,
    needpass boolean DEFAULT false,
    color character varying(255) DEFAULT '#000000'::character varying,
    max integer DEFAULT 0,
    stage_count integer DEFAULT 5,
    stage_state text,
    room_owner_meta text,
    message_mode character varying(16) DEFAULT 'real'::character varying
);


--
-- Name: rooms_idroom_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rooms_idroom_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rooms_idroom_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rooms_idroom_seq OWNED BY public.rooms.idroom;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    site text,
    dro3 text,
    them text,
    cover text,
    emo text,
    sico text,
    room_badges text,
    site_badges text,
    gifts_git text,
    gift_categories text
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: site; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site (
    id integer NOT NULL,
    banner character varying(255),
    host character varying(255),
    ids integer,
    logo character varying(255)
);


--
-- Name: site_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_id_seq OWNED BY public.site.id;


--
-- Name: site_master_wallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_master_wallet (
    id bigint NOT NULL,
    site_id integer NOT NULL,
    balance_coins bigint DEFAULT 0,
    reserved_coins bigint DEFAULT 0,
    status character varying(32) DEFAULT 'active'::character varying,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: site_master_wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_master_wallet_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_master_wallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_master_wallet_id_seq OWNED BY public.site_master_wallet.id;


--
-- Name: site_master_wallet_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_master_wallet_ledger (
    id bigint NOT NULL,
    txid character varying(128) DEFAULT ''::character varying,
    site_id integer NOT NULL,
    event_type character varying(64) NOT NULL,
    amount bigint NOT NULL,
    before_balance bigint NOT NULL,
    after_balance bigint NOT NULL,
    actor_type character varying(64) DEFAULT ''::character varying,
    actor_id character varying(255) DEFAULT ''::character varying,
    counterparty_type character varying(64) DEFAULT ''::character varying,
    counterparty_id character varying(255) DEFAULT ''::character varying,
    note text,
    reference_table character varying(128) DEFAULT ''::character varying,
    reference_id bigint DEFAULT 0,
    created_at bigint NOT NULL
);


--
-- Name: site_master_wallet_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_master_wallet_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_master_wallet_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_master_wallet_ledger_id_seq OWNED BY public.site_master_wallet_ledger.id;


--
-- Name: stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats (
    id integer NOT NULL,
    state character varying(255),
    topic character varying(255),
    username character varying(255),
    room character varying(255),
    ip character varying(255),
    "time" character varying(255)
);


--
-- Name: stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stats_id_seq OWNED BY public.stats.id;


--
-- Name: storie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storie (
    id integer NOT NULL,
    sid character varying(255) DEFAULT ''::character varying,
    photo character varying(255) DEFAULT ''::character varying,
    name character varying(255) DEFAULT ''::character varying,
    link character varying(255) DEFAULT ''::character varying,
    "lastUpdated" character varying(255) DEFAULT ''::character varying,
    item text DEFAULT '[]'::character varying,
    seen boolean DEFAULT false,
    "currentPreview" character varying(2000) DEFAULT '[]'::character varying
);


--
-- Name: storie_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.storie_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: storie_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.storie_id_seq OWNED BY public.storie.id;


--
-- Name: storieview; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storieview (
    id integer NOT NULL,
    sid character varying(255) DEFAULT ''::character varying,
    topic character varying(255) DEFAULT ''::character varying,
    photo character varying(255) DEFAULT ''::character varying,
    idsto character varying(255) DEFAULT ''::character varying,
    item integer DEFAULT 0,
    "time" text
);


--
-- Name: storieview_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.storieview_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: storieview_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.storieview_id_seq OWNED BY public.storieview.id;


--
-- Name: story_comment_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_comment_likes (
    id bigint NOT NULL,
    comment_cid character varying(64) NOT NULL,
    user_uid character varying(255) NOT NULL,
    created_at bigint NOT NULL
);


--
-- Name: story_comment_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.story_comment_likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: story_comment_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.story_comment_likes_id_seq OWNED BY public.story_comment_likes.id;


--
-- Name: story_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_comments (
    id bigint NOT NULL,
    cid character varying(64) NOT NULL,
    story_sid character varying(255) NOT NULL,
    item_id character varying(64) NOT NULL,
    parent_cid character varying(64) DEFAULT ''::character varying,
    reply_to_topic character varying(255) DEFAULT ''::character varying,
    author_uid character varying(255) NOT NULL,
    author_topic character varying(255) DEFAULT ''::character varying,
    author_pic character varying(255) DEFAULT ''::character varying,
    author_ucol character varying(64) DEFAULT ''::character varying,
    author_verified boolean DEFAULT false,
    body text NOT NULL,
    likes_count integer DEFAULT 0,
    created_at bigint NOT NULL
);


--
-- Name: story_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.story_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: story_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.story_comments_id_seq OWNED BY public.story_comments.id;


--
-- Name: story_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_likes (
    id bigint NOT NULL,
    story_sid character varying(255) NOT NULL,
    item_id character varying(64) NOT NULL,
    user_uid character varying(255) NOT NULL,
    topic character varying(255) DEFAULT ''::character varying,
    photo character varying(255) DEFAULT ''::character varying,
    created_at bigint NOT NULL
);


--
-- Name: story_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.story_likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: story_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.story_likes_id_seq OWNED BY public.story_likes.id;


--
-- Name: sub; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub (
    id integer NOT NULL,
    iduser character varying(255),
    sub character varying(255),
    topic character varying(255),
    topic1 character varying(255),
    timestart character varying(255),
    timefinish character varying(255),
    timeis character varying(255)
);


--
-- Name: sub_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sub_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sub_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sub_id_seq OWNED BY public.sub.id;


--
-- Name: top10wall; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.top10wall (
    id integer NOT NULL,
    uid character varying(255) DEFAULT ''::character varying,
    otype character varying(255) DEFAULT ''::character varying,
    pic character varying(255) DEFAULT ''::character varying,
    topic character varying(255) DEFAULT ''::character varying
);


--
-- Name: top10wall_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.top10wall_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: top10wall_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.top10wall_id_seq OWNED BY public.top10wall.id;


--
-- Name: topup_order_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topup_order_events (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    order_no character varying(64) DEFAULT ''::character varying,
    event_type character varying(64) NOT NULL,
    old_status character varying(32) DEFAULT ''::character varying,
    new_status character varying(32) DEFAULT ''::character varying,
    actor_type character varying(64) DEFAULT ''::character varying,
    actor_id character varying(255) DEFAULT ''::character varying,
    note text,
    created_at bigint NOT NULL
);


--
-- Name: topup_order_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.topup_order_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: topup_order_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.topup_order_events_id_seq OWNED BY public.topup_order_events.id;


--
-- Name: topup_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topup_orders (
    id bigint NOT NULL,
    order_no character varying(64) NOT NULL,
    user_uid character varying(255) DEFAULT ''::character varying,
    user_idreg integer DEFAULT 0,
    user_topic character varying(255) DEFAULT ''::character varying,
    user_username character varying(64) DEFAULT ''::character varying,
    agent_id bigint NOT NULL,
    agent_code character varying(64) DEFAULT ''::character varying,
    agent_name character varying(255) DEFAULT ''::character varying,
    agent_phone character varying(64) DEFAULT ''::character varying,
    agent_country_code character varying(16) DEFAULT ''::character varying,
    agent_city character varying(255) DEFAULT ''::character varying,
    package_id bigint NOT NULL,
    package_title character varying(255) DEFAULT ''::character varying,
    package_coins bigint NOT NULL,
    package_price_local numeric(18,4) DEFAULT 0.0000,
    customer_price_local numeric(18,4) DEFAULT 0.0000,
    agent_profit_local numeric(18,4) DEFAULT 0.0000,
    agent_commission_type character varying(32) DEFAULT 'spread'::character varying,
    agent_commission_value numeric(18,4) DEFAULT 0.0000,
    currency character varying(16) DEFAULT ''::character varying,
    package_country_code character varying(16) DEFAULT ''::character varying,
    package_city character varying(255) DEFAULT ''::character varying,
    payment_method_id bigint DEFAULT 0,
    payment_method_name character varying(255) DEFAULT ''::character varying,
    payment_method_account_name character varying(255) DEFAULT ''::character varying,
    payment_method_identifier character varying(255) DEFAULT ''::character varying,
    receipt_path character varying(255) DEFAULT ''::character varying,
    receipt_uploaded_at bigint DEFAULT 0,
    payment_reference character varying(255) DEFAULT ''::character varying,
    payment_note text,
    status character varying(32) DEFAULT 'pending'::character varying,
    processed_by character varying(255) DEFAULT ''::character varying,
    processed_note text,
    reject_reason text,
    requested_at bigint NOT NULL,
    processed_at bigint DEFAULT 0,
    source_ip character varying(255) DEFAULT ''::character varying,
    agent_commission_coins bigint DEFAULT 0
);


--
-- Name: topup_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.topup_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: topup_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.topup_orders_id_seq OWNED BY public.topup_orders.id;


--
-- Name: topup_settlement_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topup_settlement_ledger (
    id bigint NOT NULL,
    txid character varying(128) DEFAULT ''::character varying,
    order_id bigint NOT NULL,
    order_no character varying(64) DEFAULT ''::character varying,
    event_type character varying(64) NOT NULL,
    agent_id bigint DEFAULT 0,
    agent_name character varying(255) DEFAULT ''::character varying,
    user_uid character varying(255) DEFAULT ''::character varying,
    user_idreg integer DEFAULT 0,
    package_id bigint DEFAULT 0,
    package_title character varying(255) DEFAULT ''::character varying,
    package_coins bigint DEFAULT 0,
    currency character varying(16) DEFAULT ''::character varying,
    customer_price_local numeric(18,4) DEFAULT 0.0000,
    site_share_local numeric(18,4) DEFAULT 0.0000,
    agent_profit_local numeric(18,4) DEFAULT 0.0000,
    processed_by character varying(255) DEFAULT ''::character varying,
    note text,
    created_at bigint NOT NULL
);


--
-- Name: topup_settlement_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.topup_settlement_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: topup_settlement_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.topup_settlement_ledger_id_seq OWNED BY public.topup_settlement_ledger.id;


--
-- Name: user_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notes (
    id bigint NOT NULL,
    nid character varying(64) NOT NULL,
    uid character varying(255) NOT NULL,
    author_topic character varying(255) DEFAULT ''::character varying,
    author_pic character varying(255) DEFAULT ''::character varying,
    author_ucol character varying(64) DEFAULT ''::character varying,
    author_verified boolean DEFAULT false,
    type character varying(32) DEFAULT 'text'::character varying NOT NULL,
    text text DEFAULT ''::text,
    caption character varying(500) DEFAULT ''::character varying,
    audio_url character varying(500) DEFAULT ''::character varying,
    duration integer DEFAULT 0,
    tag character varying(64) DEFAULT ''::character varying,
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    created_at bigint NOT NULL
);


--
-- Name: user_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_notes_id_seq OWNED BY public.user_notes.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    idreg integer NOT NULL,
    bg character varying(255) DEFAULT '#FFFFFF'::character varying,
    mcol character varying(255) DEFAULT '#000000'::character varying,
    ucol character varying(255) DEFAULT '#000000'::character varying,
    evaluation integer DEFAULT 0,
    ico character varying(255) DEFAULT ''::character varying,
    ip character varying(255) DEFAULT ''::character varying,
    fp character varying(255) DEFAULT ''::character varying,
    id character varying(255),
    lid character varying(255),
    uid character varying(255),
    msg character varying(255) DEFAULT '(عضو جديد)'::character varying,
    pic character varying(255) DEFAULT 'pic.png'::character varying,
    pich character varying(255) DEFAULT 'pich.png'::character varying,
    power character varying(255) DEFAULT ''::character varying,
    rep bigint DEFAULT 0,
    topic character varying(255) NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    youtub character varying(255) DEFAULT ''::character varying,
    them character varying(255) DEFAULT ''::character varying,
    cover character varying(255) DEFAULT ''::character varying,
    "loginG" boolean DEFAULT false,
    muted boolean DEFAULT false,
    documentationc integer DEFAULT 0,
    lastssen text,
    joinuser text,
    site_badge_id character varying(255) DEFAULT ''::character varying,
    site_badge text,
    coins bigint DEFAULT 0,
    gift_ico character varying(255) DEFAULT ''::character varying,
    gcol character varying(255) DEFAULT '#FFFFFF'::character varying,
    last_eval_login_day character varying(20) DEFAULT ''::character varying,
    auto_power character varying(255) DEFAULT ''::character varying,
    wall_post_likes bigint DEFAULT 0,
    gifts_received_count bigint DEFAULT 0,
    eval_awards_json text,
    busy boolean DEFAULT false,
    alerts boolean DEFAULT false,
    nopmcall boolean DEFAULT false,
    nopmvideocall boolean DEFAULT false
);


--
-- Name: users_idreg_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_idreg_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_idreg_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_idreg_seq OWNED BY public.users.idreg;


--
-- Name: agent_payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_payment_methods ALTER COLUMN id SET DEFAULT nextval('public.agent_payment_methods_id_seq'::regclass);


--
-- Name: agent_wallet_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_wallet_ledger ALTER COLUMN id SET DEFAULT nextval('public.agent_wallet_ledger_id_seq'::regclass);


--
-- Name: agent_wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_wallets ALTER COLUMN id SET DEFAULT nextval('public.agent_wallets_id_seq'::regclass);


--
-- Name: agents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents ALTER COLUMN id SET DEFAULT nextval('public.agents_id_seq'::regclass);


--
-- Name: band id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.band ALTER COLUMN id SET DEFAULT nextval('public.band_id_seq'::regclass);


--
-- Name: bars id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bars ALTER COLUMN id SET DEFAULT nextval('public.bars_id_seq'::regclass);


--
-- Name: bots idreg; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bots ALTER COLUMN idreg SET DEFAULT nextval('public.bots_idreg_seq'::regclass);


--
-- Name: bsb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsb ALTER COLUMN id SET DEFAULT nextval('public.bsb_id_seq'::regclass);


--
-- Name: coin_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_ledger ALTER COLUMN id SET DEFAULT nextval('public.coin_ledger_id_seq'::regclass);


--
-- Name: coin_packages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_packages ALTER COLUMN id SET DEFAULT nextval('public.coin_packages_id_seq'::regclass);


--
-- Name: cuts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuts ALTER COLUMN id SET DEFAULT nextval('public.cuts_id_seq'::regclass);


--
-- Name: followers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followers ALTER COLUMN id SET DEFAULT nextval('public.followers_id_seq'::regclass);


--
-- Name: gift_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_notifications ALTER COLUMN id SET DEFAULT nextval('public.gift_notifications_id_seq'::regclass);


--
-- Name: histletter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.histletter ALTER COLUMN id SET DEFAULT nextval('public.histletter_id_seq'::regclass);


--
-- Name: hosts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosts ALTER COLUMN id SET DEFAULT nextval('public.hosts_id_seq'::regclass);


--
-- Name: internal_mail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_mail ALTER COLUMN id SET DEFAULT nextval('public.internal_mail_id_seq'::regclass);


--
-- Name: intromsg id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intromsg ALTER COLUMN id SET DEFAULT nextval('public.intromsg_id_seq'::regclass);


--
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);


--
-- Name: names id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.names ALTER COLUMN id SET DEFAULT nextval('public.names_id_seq'::regclass);


--
-- Name: note_comment_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_comment_likes ALTER COLUMN id SET DEFAULT nextval('public.note_comment_likes_id_seq'::regclass);


--
-- Name: note_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_comments ALTER COLUMN id SET DEFAULT nextval('public.note_comments_id_seq'::regclass);


--
-- Name: note_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_likes ALTER COLUMN id SET DEFAULT nextval('public.note_likes_id_seq'::regclass);


--
-- Name: notext id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notext ALTER COLUMN id SET DEFAULT nextval('public.notext_id_seq'::regclass);


--
-- Name: owner id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner ALTER COLUMN id SET DEFAULT nextval('public.owner_id_seq'::regclass);


--
-- Name: owner_agent_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_agent_transfers ALTER COLUMN id SET DEFAULT nextval('public.owner_agent_transfers_id_seq'::regclass);


--
-- Name: powers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.powers ALTER COLUMN id SET DEFAULT nextval('public.powers_id_seq'::regclass);


--
-- Name: profile_visits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_visits ALTER COLUMN id SET DEFAULT nextval('public.profile_visits_id_seq'::regclass);


--
-- Name: room_welcome_visits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_welcome_visits ALTER COLUMN id SET DEFAULT nextval('public.room_welcome_visits_id_seq'::regclass);


--
-- Name: rooms idroom; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms ALTER COLUMN idroom SET DEFAULT nextval('public.rooms_idroom_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: site id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site ALTER COLUMN id SET DEFAULT nextval('public.site_id_seq'::regclass);


--
-- Name: site_master_wallet id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_master_wallet ALTER COLUMN id SET DEFAULT nextval('public.site_master_wallet_id_seq'::regclass);


--
-- Name: site_master_wallet_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_master_wallet_ledger ALTER COLUMN id SET DEFAULT nextval('public.site_master_wallet_ledger_id_seq'::regclass);


--
-- Name: stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats ALTER COLUMN id SET DEFAULT nextval('public.stats_id_seq'::regclass);


--
-- Name: storie id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storie ALTER COLUMN id SET DEFAULT nextval('public.storie_id_seq'::regclass);


--
-- Name: storieview id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storieview ALTER COLUMN id SET DEFAULT nextval('public.storieview_id_seq'::regclass);


--
-- Name: story_comment_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comment_likes ALTER COLUMN id SET DEFAULT nextval('public.story_comment_likes_id_seq'::regclass);


--
-- Name: story_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comments ALTER COLUMN id SET DEFAULT nextval('public.story_comments_id_seq'::regclass);


--
-- Name: story_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_likes ALTER COLUMN id SET DEFAULT nextval('public.story_likes_id_seq'::regclass);


--
-- Name: sub id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub ALTER COLUMN id SET DEFAULT nextval('public.sub_id_seq'::regclass);


--
-- Name: top10wall id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.top10wall ALTER COLUMN id SET DEFAULT nextval('public.top10wall_id_seq'::regclass);


--
-- Name: topup_order_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_order_events ALTER COLUMN id SET DEFAULT nextval('public.topup_order_events_id_seq'::regclass);


--
-- Name: topup_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_orders ALTER COLUMN id SET DEFAULT nextval('public.topup_orders_id_seq'::regclass);


--
-- Name: topup_settlement_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_settlement_ledger ALTER COLUMN id SET DEFAULT nextval('public.topup_settlement_ledger_id_seq'::regclass);


--
-- Name: user_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes ALTER COLUMN id SET DEFAULT nextval('public.user_notes_id_seq'::regclass);


--
-- Name: users idreg; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN idreg SET DEFAULT nextval('public.users_idreg_seq'::regclass);


--
-- Data for Name: agent_payment_methods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_payment_methods (id, agent_id, method_name, account_name, account_identifier, instructions, is_active, sort_order, created_at, updated_at) FROM stdin;
2	2	محفظة جيب	محمد عبدالعزيز محمد احمد القباطي	780780525	فوري	t	1	1794619200611	1794619200611
\.


--
-- Data for Name: agent_wallet_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_wallet_ledger (id, txid, agent_id, event_type, amount, before_balance, after_balance, actor_type, actor_id, counterparty_type, counterparty_id, note, reference_table, reference_id, created_at) FROM stdin;
3	agent_transfer_1794593186126_617452c3291d	2	owner_transfer_in	500	0	500	owner	#2 safari2023	master_wallet	1		owner_agent_transfers	1	1794593186137
4	agent_topup_1794619374597_30e213199dd6	2	topup_order_sale	-100	500	400	agent	AG2CCF562E6E medos	user	22	order TP1794619303384B93406	topup_orders	4	1794619374614
5	agent_topup_1794619374597_30e213199dd6	2	topup_order_commission	10	400	410	agent	AG2CCF562E6E medos	master_wallet	1	commission for order TP1794619303384B93406	topup_orders	4	1794619374614
6	agent_transfer_1794620069518_dd567ad9acff	2	owner_transfer_in	50000	410	50410	owner	#8 مازن	master_wallet	1		owner_agent_transfers	2	1794620069544
7	agent_transfer_1794620078958_e25b3b0b5f2f	2	owner_transfer_in	500000	50410	550410	owner	#8 مازن	master_wallet	1		owner_agent_transfers	3	1794620078970
8	topup_1794620122027_93e88f76f5c5	2	topup_order_sale	-100000	550410	450410	owner	#8 مازن	user	22	order TP17946200902571A1AE6	topup_orders	5	1794620122040
9	topup_1794620122027_93e88f76f5c5	2	topup_order_commission	10000	450410	460410	owner	#8 مازن	master_wallet	1	commission for order TP17946200902571A1AE6	topup_orders	5	1794620122040
\.


--
-- Data for Name: agent_wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_wallets (id, agent_id, balance_coins, reserved_coins, status, created_at, updated_at) FROM stdin;
2	2	460410	0	active	1794591749353	1794620122040
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agents (id, code, name, country_code, city, phone, username, password_hash, status, commission_type, commission_value, can_receive_orders, notes, created_at, updated_at) FROM stdin;
2	AG2CCF562E6E	Mohammed	SA			medos	$2a$10$KeJLtUsNUDGWJv9HPnFtEe6M0v26L4JWhWO0EKVTxD8lPctaHgqV.	active	percent	10.0000	t		1794591749353	1794591749353
\.


--
-- Data for Name: band; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.band (id, name_band, type, deccode, "decoderDans", device_band, ip_band, country_band, date) FROM stdin;
\.


--
-- Data for Name: bars; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bars (id, bcc, likes, bg, bid, lid, mcol, msg, pic, topic, ucol, uid) FROM stdin;
100	[]	["1db82554e5a9437d67da6e:1","af9114346116b469bcd1deb3:2"]	#FFFFFF	gen5IXfeCCuNwg	ormtckbsh8x0plk7e45tggph562lufc	#000000	 السلام عليكم ورحمة الله وبركاتة  	pic.png	seohost	#000000	tamxbgxn7ds9shhxgzz665
101	[]	["1db82554e5a9437d67da6e:2","af9114346116b469bcd1deb3:1"]	#FFFFFF	AWgBH5mwXNJtLb	ormtckbsh8x0plk7e45tggph562lufc	#000000	كيف الحال	pic.png	seohost	#000000	tamxbgxn7ds9shhxgzz665
104	[{"cid":"fj1R3XfxjR","id":"3lHeem0BqdzvjRlwAAAQ","uid":"1db82554e5a9437d67da6e","topic":"مازن","pic":"/pic/1794440403648_6c221e.jpg","msg":"ياسلام","ucol":"#000000","time":1794440857154}]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	99tv7FPZKrzTfT	867bc01476cd530af6d27b5bad66933	#000000	https://www.youtube.com/watch?v=enFeM1NXonA	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
106	[]	["1db82554e5a9437d67da6e:2"]	#FFFFFF	es3Zo7PBPstSDk	867bc01476cd530af6d27b5bad66933	#000000	&#x3C;div class="ssss">&#x3C;a href="/sendfile/1794442103026_b7f220.mp4" class="uplink">/sendfile/1794442103026_b7f220.mp4&#x3C;/a>&#x3C;/div>	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
110	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	EF4T0TVX4900HL	867bc01476cd530af6d27b5bad66933	#000000	 السلام عليكم ورحمة الله وبركاتة  	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
109	[{"cid":"EEv7RWK9DS","id":"oBf1VU-aYy7SzQ6MAAAF","uid":"tamxbgxn7ds9shhxgzz665","topic":"seohost","pic":"/pic/1794512127060_378568.jpg","msg":"سلام","ucol":"#000000","time":1794514661123}]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	YVeRbrvlkKmkt8	867bc01476cd530af6d27b5bad66933	#000000	سيشسي	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
111	[]	["1db82554e5a9437d67da6e:1","tamxbgxn7ds9shhxgzz665:2"]	#FFFFFF	9vp3FwvbNnyV8G	867bc01476cd530af6d27b5bad66933	#000000	سلام	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
105	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	y4KmczM0QtT5xj	867bc01476cd530af6d27b5bad66933	#000000	&#x3C;div class="ssss">&#x3C;a href="/sendfile/1794442090825_1d5a6a.jpg" class="uplink">/sendfile/1794442090825_1d5a6a.jpg&#x3C;/a>&#x3C;/div>	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
103	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	hD3iH4XUbTaTZk	ormtckbsh8x0plk7e45tggph562lufc	#000000	 السلام عليكم ورحمة الله وبركاتة  	pic.png	seohost	#000000	tamxbgxn7ds9shhxgzz665
123	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	llSfEf44rUyBww	ormtckbsh8x0plk7e45tggph562lufc	#000000	https://www.youtube.com/watch?v=enFeM1NXonA	/pic/1794512127060_378568.jpg	seohostseohost	#ffffff	tamxbgxn7ds9shhxgzz665
116	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	S4vJCKjKPjlnA8	867bc01476cd530af6d27b5bad66933	#00ffff	 كيف الحال 	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
114	[]	["1db82554e5a9437d67da6e:2"]	#FFFFFF	e036VZBJGr4cLT	867bc01476cd530af6d27b5bad66933	#000000	س١	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
113	[]	["1db82554e5a9437d67da6e:2","612f23b9956c63ef868ebc61:1"]	#FFFFFF	4kNdzfjA1Iah3u	867bc01476cd530af6d27b5bad66933	#000000	 السلام عليكم ورحمة الله وبركاتة  	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
117	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	N5R09FPoo1GCMl	867bc01476cd530af6d27b5bad66933	#00ffff	ظءظيظسظي	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
122	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	SB4X3R95HU7UKy	867bc01476cd530af6d27b5bad66933	#000000	 السلام عليكم ورحمة الله وبركاتة  	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
119	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	yQNmQ98M9RCy8o	867bc01476cd530af6d27b5bad66933	#00ffff	ميميمي	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
118	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	MEFhdT4PIaNE7q	867bc01476cd530af6d27b5bad66933	#00ffff	مسميمي	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
115	[{"cid":"24QbBoekho","id":"E0I9wCuWQiBMmGm4AAAt","uid":"612f23b9956c63ef868ebc61","topic":"زهره","pic":"pic.png","msg":"ادازلاداا","ucol":"#000000","time":1794524179657},{"cid":"mL4zbSV2SK","id":"AbhEB8FHOyLzOwBHAAAk","uid":"1db82554e5a9437d67da6e","topic":"مازن","pic":"/pic/1794440403648_6c221e.jpg","msg":"ؤظظيظؤظؤظ","ucol":"#000000","time":1794524188093,"replyToCid":"24QbBoekho"}]	["612f23b9956c63ef868ebc61:2","1db82554e5a9437d67da6e:1"]	#FFFFFF	UbaiGFDgMccDNR	867bc01476cd530af6d27b5bad66933	#000000	 السلام عليكم ورحمة الله وبركاتة  	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
112	[]	["tamxbgxn7ds9shhxgzz665:1","1db82554e5a9437d67da6e:1"]	#FFFFFF	kEdzEOIDprpWpd	867bc01476cd530af6d27b5bad66933	#000000	&#x3C;div class="ssss">&#x3C;a href="/sendfile/1794507433039_904cee.jpg" class="uplink">/sendfile/1794507433039_904cee.jpg&#x3C;/a>&#x3C;/div>	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
107	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	5PHItSkuQLCrFc	867bc01476cd530af6d27b5bad66933	#000000	&#x3C;div class="ssss">&#x3C;a href="https://www.youtube.com/watch?v=enFeM1NXonA" class="uplink">https://www.youtube.com/watch?v=enFeM1NXonA&#x3C;/a>&#x3C;/div>	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
120	[]	["1db82554e5a9437d67da6e:2"]	#FFFFFF	GtQ5XjMKOurHWY	867bc01476cd530af6d27b5bad66933	#00ffff	مسمي	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
121	[]	[]	#FFFFFF	vFnTs0BQFoyvAx	867bc01476cd530af6d27b5bad66933	#00ffff	ننت	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
102	[{"cid":"53cgIvebGQ","id":"3b9iLyf8J1_aG-ZMAAAE","uid":"1db82554e5a9437d67da6e","topic":"مازن","pic":"pic.png","msg":"تنمتنم","ucol":"#000000","time":1794439189028},{"cid":"KPTaVkTELB","id":"3b9iLyf8J1_aG-ZMAAAE","uid":"1db82554e5a9437d67da6e","topic":"مازن","pic":"pic.png","msg":"تناتناتن","ucol":"#000000","time":1794439197145,"replyToCid":"53cgIvebGQ"},{"cid":"BGbtw7eFII","id":"qyW65zqlQJZn4OscAAAD","uid":"1db82554e5a9437d67da6e","topic":"مازن","pic":"/pic/1794440403648_6c221e.jpg","msg":"ارحب","ucol":"#000000","time":1794502099225},{"cid":"EjOTQmlnum","id":"qyW65zqlQJZn4OscAAAD","uid":"1db82554e5a9437d67da6e","topic":"مازن","pic":"/pic/1794440403648_6c221e.jpg","msg":"ظيظيظس","ucol":"#000000","time":1794502104663,"replyToCid":"BGbtw7eFII"}]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	pEYWL6WcGt3Rav	ormtckbsh8x0plk7e45tggph562lufc	#000000	منورين	pic.png	seohost	#000000	tamxbgxn7ds9shhxgzz665
124	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	d4VC4g5jHvEi1p	867bc01476cd530af6d27b5bad66933	#000000	<div class="ssss"><a href="/sendfile/1794687325385_b8d273.jpg" class="uplink">/sendfile/1794687325385_b8d273.jpg</a></div>	/pic/1794440403648_6c221e.jpg	مازن	#000000	1db82554e5a9437d67da6e
125	[]	[]	#FFFFFF	R1KppflOhjx3Df	ormtckbsh8x0plk7e45tggph562lufc	#000000	<div class="ssss"><a href="https://www.youtube.com/watch?v=2SQwm9c9d6s" class="uplink">https://www.youtube.com/watch?v=2SQwm9c9d6s</a><br/>Ramy Gamal - Entahena [Official Lyrics Video] | رامي جمال - ⁠انتهينا</div>	/pic/1794512127060_378568.jpg	seohostseohost	#ffffff	tamxbgxn7ds9shhxgzz665
126	[]	[]	#FFFFFF	IXe6WLuar5l8zS	ormtckbsh8x0plk7e45tggph562lufc	#000000	<div class="ssss"><a href="https://www.youtube.com/watch?v=2SQwm9c9d6s" class="uplink">https://www.youtube.com/watch?v=2SQwm9c9d6s</a><br/>استمعوا</div>	/pic/1794512127060_378568.jpg	seohostseohost	#ffffff	tamxbgxn7ds9shhxgzz665
131	[]	["g_PTEl5J8Tms2q:1","g_6X5oqTsY0lr3:2"]	#ffffff	UdddLGlcloMd9B	ormtckbsh8x0plk7e45tggph562lufc	#0b0a0a	السلام عليكم ورحمة الله وبركاتة  السلام عليكم ورحمة الله وبركاتة  السلام عليكم ورحمة الله وبركاتة	/pic/1794512127060_378568.jpg	seohostseohost	#f0ebeb	tamxbgxn7ds9shhxgzz665
127	[]	["1db82554e5a9437d67da6e:1"]	#FFFFFF	UZyAjtXvlpMZ8a	ormtckbsh8x0plk7e45tggph562lufc	#000000	سيب	/pic/1794512127060_378568.jpg	seohostseohost	#ffffff	tamxbgxn7ds9shhxgzz665
130	[]	["tamxbgxn7ds9shhxgzz665:1","g_PTEl5J8Tms2q:2"]	#FFFFFF	9yQbIZKsoxcwM5	ormtckbsh8x0plk7e45tggph562lufc	#000000	<div class="ssss"><a href="/sendfile/1794698599130_3caefa.webm" class="uplink">/sendfile/1794698599130_3caefa.webm</a><br/>ءلاام</div>	/pic/1794512127060_378568.jpg	seohostseohost	#ffffff	tamxbgxn7ds9shhxgzz665
129	[{"cid":"onB5HKjsO6","id":"iWtY9rOgJ8JGW_nyAAAL","uid":"tamxbgxn7ds9shhxgzz665","topic":"seohostseohost","pic":"/pic/1794512127060_378568.jpg","msg":"يبيبيب","ucol":"#ffffff","time":1794697477250,"documents":true,"documentationc":true},{"cid":"4DUP4vhwjo","id":"Kj9ei7VP_nTBAZnbAAAo","uid":"g_PTEl5J8Tms2q","topic":"سامر","pic":"pic.png","msg":"سيبيسب","ucol":"#996c6c","time":1794700953445,"documents":false,"documentationc":false},{"cid":"cz2ThmFvgC","id":"Kj9ei7VP_nTBAZnbAAAo","uid":"g_PTEl5J8Tms2q","topic":"سامر","pic":"pic.png","msg":"ياسلام عليك","ucol":"#996c6c","time":1794700967877,"documents":false,"documentationc":false,"replyToCid":"onB5HKjsO6"}]	[]	#FFFFFF	L4HmRVnhqFpfKV	ormtckbsh8x0plk7e45tggph562lufc	#000000	<div class="ssss"><a href="/sendfile/1794697439071_bc815c.jpg" class="uplink">/sendfile/1794697439071_bc815c.jpg</a></div>	/pic/1794512127060_378568.jpg	seohostseohost	#ffffff	tamxbgxn7ds9shhxgzz665
\.


--
-- Data for Name: bots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bots (idreg, msg, pic, power, country, room, ip, id, stat, topic) FROM stdin;
1	مرحبا بكم	/pic/1771712864630.jpg	Hide	kw	D8D8A9A9C0	20.214.391.73	8tyv5i71ck7f1y45k9	2	سهم
2	مرحبا بكم	pic.png		kw	D8D8A9A9C0	71.13.120.166	bot-1n06g9vqyr8vmq7vpo	0	صادق 1
3	مرحبا بكم	pic.png		kw	D8D8A9A9C0	47.201.115.106	bot-6kqn026mkytafxi6yu	0	صادق 2
4	مرحبا بكم	pic.png		kw	D8D8A9A9C0	149.171.25.1	bot-nh39yl38n23nci5whf	0	صادق 3
5	مرحبا بكم	pic.png		kw	D8D8A9A9C0	18.154.8.203	bot-8ysgmpd695bq037qr0	0	صادق 4
6	مرحبا بكم	pic.png		kw	D8D8A9A9C0	162.119.117.222	bot-b8svyk19m6qdh4n2i8	0	صادق 5
7	مرحبا بكم	pic.png		kw	D8D8A9A9C0	44.134.228.100	bot-j1ih8xxqsjonyq22eq	0	صادق 6
8	مرحبا بكم	pic.png		kw	D8D8A9A9C0	183.180.175.166	bot-sx6hcea7mf4mx1v5rd	0	صادق 7
9	مرحبا بكم	pic.png		kw	D8D8A9A9C0	30.112.184.188	bot-fmy3g4soimsdq5ujt9	0	صادق 8
10	مرحبا بكم	pic.png		kw	D8D8A9A9C0	112.124.170.212	bot-i7cijaa4siao07ul08	0	صادق 9
11	مرحبا بكم	pic.png		kw	D8D8A9A9C0	16.216.45.7	bot-lwnjt12gnz8y6dhgmt	0	صادق 10
12	مرحبا بكم	pic.png		kw	D8D8A9A9C0	188.41.178.162	bot-7hjcb33bwp6ximfb3r	0	صادق 11
13	مرحبا بكم	pic.png		kw	D8D8A9A9C0	50.225.163.127	bot-od8hnurifmipt8kxnv	0	صادق 12
14	مرحبا بكم	pic.png		kw	D8D8A9A9C0	13.25.146.219	bot-owsqrk3gll7xauv7us	0	صادق 13
15	مرحبا بكم	pic.png		kw	D8D8A9A9C0	184.30.178.37	bot-sbj8au8u3hiyirrwco	0	صادق 14
16	مرحبا بكم	pic.png		kw	D8D8A9A9C0	81.146.10.173	bot-hbfjo2owenfzpio66b	0	صادق 15
17	مرحبا بكم	pic.png		kw	D8D8A9A9C0	95.227.3.232	bot-b69rcaox6ggjv4whhz	0	صادق 16
18	مرحبا بكم	pic.png		kw	D8D8A9A9C0	140.66.9.194	bot-c61xsg3n83p2mrvk4e	0	صادق 17
19	مرحبا بكم	pic.png		kw	D8D8A9A9C0	86.26.14.173	bot-k4e5gkr767yu69yb0u	0	صادق 18
20	مرحبا بكم	pic.png		kw	D8D8A9A9C0	48.35.109.52	bot-efbcor6zsy79ljqg3b	0	صادق 19
21	مرحبا بكم	pic.png		kw	D8D8A9A9C0	156.91.31.230	bot-zsbjyapqukz9dyd9nh	0	صادق 20
22	مرحبا بكم	pic.png		kw	D8D8A9A9C0	165.115.42.137	bot-iudlbjxlcb0xtichkh	0	صادق 21
23	مرحبا بكم	pic.png		kw	D8D8A9A9C0	31.236.236.53	bot-7n7sy4020dsvjg0zsx	0	صادق 22
24	مرحبا بكم	pic.png		kw	D8D8A9A9C0	155.113.137.123	bot-biizuv1t8oloq56u4q	0	صادق 23
25	مرحبا بكم	pic.png		kw	D8D8A9A9C0	119.147.30.145	bot-wk7tuapnl8wjqnyrwc	0	صادق 24
26	مرحبا بكم	pic.png		kw	D8D8A9A9C0	29.240.102.92	bot-slp0411nadz0tbxh8x	0	صادق 25
27	مرحبا بكم	pic.png		kw	D8D8A9A9C0	203.139.115.10	bot-o4ajcfak4zqw9bo2o0	0	صادق 26
28	مرحبا بكم	pic.png		kw	D8D8A9A9C0	187.52.125.162	bot-1tv2djsvcdog70qg69	0	صادق 27
29	مرحبا بكم	pic.png		kw	D8D8A9A9C0	58.159.229.31	bot-a00abnhov7cpb344t6	0	صادق 28
30	مرحبا بكم	pic.png		kw	D8D8A9A9C0	142.209.44.70	bot-bnfmix8v491o6homsg	0	صادق 29
31	مرحبا بكم	pic.png		kw	D8D8A9A9C0	55.3.96.113	bot-zjcy5q28ls8ykk9dru	0	صادق 30
32	مرحبا بكم	pic.png		kw	D8D8A9A9C0	140.242.98.26	bot-qspr56457rour8rnvx	0	صادق 31
33	مرحبا بكم	pic.png		kw	D8D8A9A9C0	83.45.124.167	bot-wj7c4xvd2wc3mh20si	0	صادق 32
34	مرحبا بكم	pic.png		kw	D8D8A9A9C0	125.70.36.128	bot-ydoav8uhu8ft2qz3yg	0	صادق 33
35	مرحبا بكم	pic.png		kw	D8D8A9A9C0	196.144.190.41	bot-xix5yytno0s4iiruxh	0	صادق 34
36	مرحبا بكم	pic.png		kw	D8D8A9A9C0	70.98.135.212	bot-i6nz39344q1ixwdb1e	0	صادق 35
37	مرحبا بكم	pic.png		kw	D8D8A9A9C0	51.98.58.52	bot-ey18x8xlka1qb08pfp	0	صادق 36
38	مرحبا بكم	pic.png		kw	D8D8A9A9C0	207.137.79.166	bot-7elob1uuuj9xv0vd73	0	صادق 37
39	مرحبا بكم	pic.png		kw	D8D8A9A9C0	22.119.93.79	bot-5h7ide1io3ee404khe	0	صادق 38
40	مرحبا بكم	pic.png		kw	D8D8A9A9C0	176.255.122.156	bot-z8cp1697x8aku5zjcg	0	صادق 39
41	مرحبا بكم	pic.png		kw	D8D8A9A9C0	55.50.38.210	bot-78lptmy4qvqfzcx95r	0	صادق 40
42	مرحبا بكم	pic.png		kw	D8D8A9A9C0	123.178.195.76	bot-ppel6x7p6zqtbuphix	0	صادق 41
43	مرحبا بكم	pic.png		kw	D8D8A9A9C0	191.29.124.14	bot-nd5ysrvtfsradaeysn	0	صادق 42
44	مرحبا بكم	pic.png		kw	D8D8A9A9C0	112.75.107.14	bot-9fz73gtj4hyakgrg0y	0	صادق 43
45	مرحبا بكم	pic.png		kw	D8D8A9A9C0	109.199.140.221	bot-uj7homflmw4r814tsv	0	صادق 44
46	مرحبا بكم	pic.png		kw	D8D8A9A9C0	217.3.147.6	bot-sn8gkart8f5nrmwi7t	0	صادق 45
47	مرحبا بكم	pic.png		kw	D8D8A9A9C0	147.46.49.4	bot-otup60thdded32seet	0	صادق 46
48	مرحبا بكم	pic.png		kw	D8D8A9A9C0	91.4.148.223	bot-urcl810ncwd4fc07oe	0	صادق 47
49	مرحبا بكم	pic.png		kw	D8D8A9A9C0	130.245.146.62	bot-mzyp7aoxcjligx6cha	0	صادق 48
50	مرحبا بكم	pic.png		kw	D8D8A9A9C0	17.13.148.173	bot-212opbsuhhgw8ngack	0	صادق 49
51	مرحبا بكم	pic.png		kw	D8D8A9A9C0	217.85.216.5	bot-xl8bw6qjy6kctpthdi	0	صادق 50
52	مرحبا بكم	pic.png		kw	D8D8A9A9C0	28.94.65.62	bot-28m0xspubag1ksnnb3	0	صادق 51
53	مرحبا بكم	pic.png		kw	D8D8A9A9C0	75.142.125.240	bot-2aosur93x5ip2yiopn	0	صادق 52
54	مرحبا بكم	pic.png		kw	D8D8A9A9C0	42.38.185.76	bot-2jerw35xrhc6gs4bg7	0	صادق 53
55	مرحبا بكم	pic.png		kw	D8D8A9A9C0	30.56.180.134	bot-jcj5ewb56oarwvswpc	0	صادق 54
56	مرحبا بكم	pic.png		kw	D8D8A9A9C0	214.224.49.123	bot-xuzfie7v0r4fpu8i5z	0	صادق 55
57	مرحبا بكم	pic.png		kw	D8D8A9A9C0	189.54.215.208	bot-4m2pzyb5gfhxqor64j	0	صادق 56
58	مرحبا بكم	pic.png		kw	D8D8A9A9C0	124.22.107.70	bot-vn0bac6bctd6f7wxds	0	صادق 57
59	مرحبا بكم	pic.png		kw	D8D8A9A9C0	23.21.162.189	bot-awh0mh16ijv5oldqly	0	صادق 58
60	مرحبا بكم	pic.png		kw	D8D8A9A9C0	79.47.237.107	bot-a0l9rq4w7g3d9tjm1n	0	صادق 59
61	مرحبا بكم	pic.png		kw	D8D8A9A9C0	125.215.156.188	bot-a7v5gm15ugwr4b9qut	0	صادق 60
62	مرحبا بكم	pic.png		kw	D8D8A9A9C0	24.74.176.75	bot-6612shgejm4erai6qj	0	صادق 61
63	مرحبا بكم	pic.png		kw	D8D8A9A9C0	70.210.95.47	bot-9zg4qwfdebctuoq028	0	صادق 62
64	مرحبا بكم	pic.png		kw	D8D8A9A9C0	25.46.129.194	bot-ekdut5jjsv935fia1d	0	صادق 63
65	مرحبا بكم	pic.png		kw	D8D8A9A9C0	51.214.132.143	bot-hkklkoj9duy3kwzeqz	0	صادق 64
66	مرحبا بكم	pic.png		kw	D8D8A9A9C0	193.49.7.132	bot-n8gbmyqp9kwjxs9q2c	0	صادق 65
67	مرحبا بكم	pic.png		kw	D8D8A9A9C0	162.139.236.59	bot-0to12nti54e0r4f80v	0	صادق 66
68	مرحبا بكم	pic.png		kw	D8D8A9A9C0	88.168.204.70	bot-8nukieho139xxocdrj	0	صادق 67
69	مرحبا بكم	pic.png		kw	D8D8A9A9C0	190.211.89.99	bot-hpje4cvdly6hfvpmle	0	صادق 68
70	مرحبا بكم	pic.png		kw	D8D8A9A9C0	141.60.164.169	bot-jv3ziregdia3xxhslc	0	صادق 69
71	مرحبا بكم	pic.png		kw	D8D8A9A9C0	194.80.235.126	bot-6fxvw3ebsdlouhwpl7	0	صادق 70
72	مرحبا بكم	pic.png		kw	D8D8A9A9C0	117.35.83.125	bot-2n5iwa6gnv9uzya331	0	صادق 71
73	مرحبا بكم	pic.png		kw	D8D8A9A9C0	17.134.221.248	bot-2kmbhxw7pgc9ytvu7e	0	صادق 72
74	مرحبا بكم	pic.png		kw	D8D8A9A9C0	38.232.238.147	bot-jj53x2d6wsg7x6mv8z	0	صادق 73
75	مرحبا بكم	pic.png		kw	D8D8A9A9C0	87.4.115.187	bot-9kwfrtf1ucl2h2xoeo	0	صادق 74
76	مرحبا بكم	pic.png		kw	D8D8A9A9C0	88.40.210.61	bot-8elr23hxm5pvsmys7d	0	صادق 75
77	مرحبا بكم	pic.png		kw	D8D8A9A9C0	169.24.202.55	bot-yzc2sllsi6wmgdjibs	0	صادق 76
78	مرحبا بكم	pic.png		kw	D8D8A9A9C0	173.151.228.36	bot-ewvmhbzbf23ek0sjc3	0	صادق 77
79	مرحبا بكم	pic.png		kw	D8D8A9A9C0	125.34.223.7	bot-054b3e9mosqeu3msum	0	صادق 78
80	مرحبا بكم	pic.png		kw	D8D8A9A9C0	203.44.230.33	bot-tektl06kw804zjnyh7	0	صادق 79
81	مرحبا بكم	pic.png		kw	D8D8A9A9C0	104.213.155.180	bot-ygxrsv7dn5en6cwfz3	0	صادق 80
82	مرحبا بكم	pic.png		kw	D8D8A9A9C0	103.9.48.233	bot-zgyfj08wr8xe6lrfvy	0	صادق 81
83	مرحبا بكم	pic.png		kw	D8D8A9A9C0	96.166.18.44	bot-s3lovnr2jatn8yovfz	0	صادق 82
84	مرحبا بكم	pic.png		kw	D8D8A9A9C0	141.120.241.134	bot-a54bzcvu8e0w14m61y	0	صادق 83
85	مرحبا بكم	pic.png		kw	D8D8A9A9C0	219.23.254.146	bot-lew4t3vl5s8ep4wg2a	0	صادق 84
86	مرحبا بكم	pic.png		kw	D8D8A9A9C0	118.140.100.237	bot-iotf38yainq8r2t87c	0	صادق 85
87	مرحبا بكم	pic.png		kw	D8D8A9A9C0	48.231.227.171	bot-u0632ixhapbsgjlvn8	0	صادق 86
88	مرحبا بكم	pic.png		kw	D8D8A9A9C0	157.81.143.77	bot-1nblpzbtlc1q2iel4q	0	صادق 87
89	مرحبا بكم	pic.png		kw	D8D8A9A9C0	41.27.247.182	bot-uelfzxqwt60k5pkbi3	0	صادق 88
90	مرحبا بكم	pic.png		kw	D8D8A9A9C0	136.191.232.221	bot-s96spt2p4zqi8n6hsy	0	صادق 89
91	مرحبا بكم	pic.png		kw	D8D8A9A9C0	149.129.138.85	bot-weu9rjwvs1dbazy89v	0	صادق 90
92	مرحبا بكم	pic.png		kw	D8D8A9A9C0	21.106.16.171	bot-d0q6bfpszlafnh38cp	0	صادق 91
93	مرحبا بكم	pic.png		kw	D8D8A9A9C0	50.92.251.183	bot-axw9svblsqn0oiv999	0	صادق 92
94	مرحبا بكم	pic.png		kw	D8D8A9A9C0	206.252.159.234	bot-t4z8heexf74740nqpo	0	صادق 93
95	مرحبا بكم	pic.png		kw	D8D8A9A9C0	52.118.225.67	bot-cq47149hngk1bdld1q	0	صادق 94
96	مرحبا بكم	pic.png		kw	D8D8A9A9C0	71.178.127.58	bot-teylqio0ooidcmask0	0	صادق 95
97	مرحبا بكم	pic.png		kw	D8D8A9A9C0	105.118.53.227	bot-shvf6kpuo0bxq49kiv	0	صادق 96
98	مرحبا بكم	pic.png		kw	D8D8A9A9C0	90.176.199.72	bot-aj19fu4qgm3zrturpu	0	صادق 97
99	مرحبا بكم	pic.png		kw	D8D8A9A9C0	131.45.49.251	bot-ugqe8v8ax2owl1raep	0	صادق 98
100	مرحبا بكم	pic.png		kw	D8D8A9A9C0	185.255.92.105	bot-wjadepk58dxbuqxzju	0	صادق 99
101	مرحبا بكم	pic.png		kw	D8D8A9A9C0	48.55.89.214	bot-ozbvuribazhlvwmf9k	0	صادق 100
102	مرحبا بكم	pic.png		kw	D8D8A9A9C0	130.253.169.50	bot-r7uv5g0hikaox3zdpl	0	صادق 101
103	مرحبا بكم	pic.png		kw	D8D8A9A9C0	75.38.26.73	bot-yah1y3qc94y4j87qbh	0	صادق 102
104	مرحبا بكم	pic.png		kw	D8D8A9A9C0	154.59.93.15	bot-gp11742odyxomxs7r3	0	صادق 103
105	مرحبا بكم	pic.png		kw	D8D8A9A9C0	34.212.47.42	bot-0r1p3kndhotc7qykl8	0	صادق 104
106	مرحبا بكم	pic.png		kw	D8D8A9A9C0	77.154.255.226	bot-p36qp7xdpi6xvarl91	0	صادق 105
107	مرحبا بكم	pic.png		kw	D8D8A9A9C0	43.81.108.82	bot-58hjf1jaipavuj73ag	0	صادق 106
108	مرحبا بكم	pic.png		kw	D8D8A9A9C0	27.246.126.7	bot-apt91f2l9hg1xawo12	0	صادق 107
109	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.28.10.98	bot-mhuvmmi2cmxxdjvi1i	0	صادق 108
110	مرحبا بكم	pic.png		kw	D8D8A9A9C0	216.149.156.33	bot-4vsb4pk5ql9mv00mbv	0	صادق 109
111	مرحبا بكم	pic.png		kw	D8D8A9A9C0	139.134.253.98	bot-xe2jl73crqhu7sff7k	0	صادق 110
112	مرحبا بكم	pic.png		kw	D8D8A9A9C0	95.68.5.95	bot-aykpkrpxoo94g3ublz	0	صادق 111
113	مرحبا بكم	pic.png		kw	D8D8A9A9C0	220.65.78.134	bot-yrgxxsy7r2f50ac3vn	0	صادق 112
114	مرحبا بكم	pic.png		kw	D8D8A9A9C0	155.102.16.227	bot-xq6axqo9fsmkqapad8	0	صادق 113
115	مرحبا بكم	pic.png		kw	D8D8A9A9C0	39.233.199.80	bot-ujksjwc68xyx9rsjaa	0	صادق 114
116	مرحبا بكم	pic.png		kw	D8D8A9A9C0	101.67.126.185	bot-79j3m5ny07lyy5rode	0	صادق 115
117	مرحبا بكم	pic.png		kw	D8D8A9A9C0	62.117.47.163	bot-nmk10bzjx7exhtg57q	0	صادق 116
118	مرحبا بكم	pic.png		kw	D8D8A9A9C0	28.120.55.149	bot-okhsmj980djkps3r68	0	صادق 117
119	مرحبا بكم	pic.png		kw	D8D8A9A9C0	109.162.117.101	bot-9b70bxuf50sltzeclo	0	صادق 118
120	مرحبا بكم	pic.png		kw	D8D8A9A9C0	66.10.113.110	bot-a1pqp87x83mxd2ba2l	0	صادق 119
121	مرحبا بكم	pic.png		kw	D8D8A9A9C0	62.68.4.22	bot-8lnt8qn31d0d19z3ns	0	صادق 120
122	مرحبا بكم	pic.png		kw	D8D8A9A9C0	15.224.81.106	bot-o6t4s0e74j2blkezjz	0	صادق 121
123	مرحبا بكم	pic.png		kw	D8D8A9A9C0	222.99.118.72	bot-fl12fyrp27fde942pv	0	صادق 122
124	مرحبا بكم	pic.png		kw	D8D8A9A9C0	170.39.21.88	bot-sso05lcxvq8ehuqzef	0	صادق 123
125	مرحبا بكم	pic.png		kw	D8D8A9A9C0	208.110.109.182	bot-xb7p7vaaho6hybb0p0	0	صادق 124
126	مرحبا بكم	pic.png		kw	D8D8A9A9C0	13.83.18.110	bot-kinusbli7o74gln1yy	0	صادق 125
127	مرحبا بكم	pic.png		kw	D8D8A9A9C0	156.216.62.59	bot-oubvjbjiqx882u9iyd	0	صادق 126
128	مرحبا بكم	pic.png		kw	D8D8A9A9C0	45.240.117.238	bot-t4bc3kxc3doirhajq8	0	صادق 127
129	مرحبا بكم	pic.png		kw	D8D8A9A9C0	192.242.149.231	bot-ypsbp7th0u4ug3srfh	0	صادق 128
130	مرحبا بكم	pic.png		kw	D8D8A9A9C0	199.98.142.21	bot-8wcdqb5547lca92ryh	0	صادق 129
131	مرحبا بكم	pic.png		kw	D8D8A9A9C0	64.83.216.3	bot-u45wzbzf01h9kmn6sq	0	صادق 130
132	مرحبا بكم	pic.png		kw	D8D8A9A9C0	27.128.78.249	bot-l8340k9iq9bx2un3ag	0	صادق 131
133	مرحبا بكم	pic.png		kw	D8D8A9A9C0	37.221.13.150	bot-tu89uch36rjbkdvtcw	0	صادق 132
134	مرحبا بكم	pic.png		kw	D8D8A9A9C0	121.50.205.226	bot-5amy1zpwxq12hoxz7t	0	صادق 133
135	مرحبا بكم	pic.png		kw	D8D8A9A9C0	172.156.149.156	bot-jbz7tcojl6qtrss3d9	0	صادق 134
136	مرحبا بكم	pic.png		kw	D8D8A9A9C0	81.55.242.90	bot-2p0hohptyibi2xf7n0	0	صادق 135
137	مرحبا بكم	pic.png		kw	D8D8A9A9C0	132.201.240.139	bot-2bbxc6ww6ma24g5h76	0	صادق 136
138	مرحبا بكم	pic.png		kw	D8D8A9A9C0	160.133.193.199	bot-3bujhitk0kpwzsgf9k	0	صادق 137
139	مرحبا بكم	pic.png		kw	D8D8A9A9C0	64.112.87.3	bot-lhf4wcyp9ah6f19qo8	0	صادق 138
140	مرحبا بكم	pic.png		kw	D8D8A9A9C0	55.252.191.199	bot-nw8a1jz3of894ph6g7	0	صادق 139
141	مرحبا بكم	pic.png		kw	D8D8A9A9C0	38.41.73.195	bot-jov6x3gs51ergqp1wc	0	صادق 140
142	مرحبا بكم	pic.png		kw	D8D8A9A9C0	15.156.24.151	bot-5m0esx84jt84781mca	0	صادق 141
143	مرحبا بكم	pic.png		kw	D8D8A9A9C0	204.106.227.115	bot-wc80riokxhz0r8gn5z	0	صادق 142
144	مرحبا بكم	pic.png		kw	D8D8A9A9C0	24.253.208.152	bot-hvlfpryxtd8gqq6jah	0	صادق 143
145	مرحبا بكم	pic.png		kw	D8D8A9A9C0	40.104.98.82	bot-ptjlt92mvfbf615bm7	0	صادق 144
146	مرحبا بكم	pic.png		kw	D8D8A9A9C0	155.110.125.63	bot-45m3ekjdsziw4rqgm3	0	صادق 145
147	مرحبا بكم	pic.png		kw	D8D8A9A9C0	81.85.86.3	bot-ipxzsr4rddq7oulqjw	0	صادق 146
148	مرحبا بكم	pic.png		kw	D8D8A9A9C0	200.159.226.40	bot-wkimp5jrn6nzhtl9a5	0	صادق 147
149	مرحبا بكم	pic.png		kw	D8D8A9A9C0	40.189.124.182	bot-ijm3vlhxi72qxefu58	0	صادق 148
150	مرحبا بكم	pic.png		kw	D8D8A9A9C0	138.28.155.31	bot-jnlruxbwhpvc9sn2o0	0	صادق 149
151	مرحبا بكم	pic.png		kw	D8D8A9A9C0	129.250.239.197	bot-ee5f86a0s0pphy3fgw	0	صادق 150
152	مرحبا بكم	pic.png		kw	D8D8A9A9C0	134.194.217.126	bot-3d7xhr50tnlbk0tv9s	0	صادق 151
153	مرحبا بكم	pic.png		kw	D8D8A9A9C0	32.159.227.146	bot-ru81a0w93cdex870c4	0	صادق 152
154	مرحبا بكم	pic.png		kw	D8D8A9A9C0	214.57.114.71	bot-boj5slkhs6zmatixrx	0	صادق 153
155	مرحبا بكم	pic.png		kw	D8D8A9A9C0	186.83.232.179	bot-wo2axt80ne8o8kdtud	0	صادق 154
156	مرحبا بكم	pic.png		kw	D8D8A9A9C0	211.162.70.113	bot-t07a9gbizitqhefifh	0	صادق 155
157	مرحبا بكم	pic.png		kw	D8D8A9A9C0	132.203.46.44	bot-z1ly0glvbua9p8jbu7	0	صادق 156
158	مرحبا بكم	pic.png		kw	D8D8A9A9C0	134.59.19.190	bot-g8wx7dgykid7pzvniw	0	صادق 157
159	مرحبا بكم	pic.png		kw	D8D8A9A9C0	129.162.207.107	bot-0mvcjkuba4vlvrz00n	0	صادق 158
160	مرحبا بكم	pic.png		kw	D8D8A9A9C0	43.99.102.118	bot-v57af3i6grk8p4o64p	0	صادق 159
161	مرحبا بكم	pic.png		kw	D8D8A9A9C0	26.200.116.166	bot-zbtcclor1mjtcct9cq	0	صادق 160
162	مرحبا بكم	pic.png		kw	D8D8A9A9C0	121.215.53.192	bot-naot7fh9sx8tv7ua5n	0	صادق 161
163	مرحبا بكم	pic.png		kw	D8D8A9A9C0	199.66.186.40	bot-23gtjpr16bejulfq3r	0	صادق 162
164	مرحبا بكم	pic.png		kw	D8D8A9A9C0	17.4.77.112	bot-77k3dyy0eecp65ktls	0	صادق 163
165	مرحبا بكم	pic.png		kw	D8D8A9A9C0	213.26.160.155	bot-q0dhlxtqigs2oa87fx	0	صادق 164
166	مرحبا بكم	pic.png		kw	D8D8A9A9C0	219.96.251.245	bot-i0drerpjxp9zugf9e8	0	صادق 165
167	مرحبا بكم	pic.png		kw	D8D8A9A9C0	14.16.238.249	bot-q2h0d75a7vk1rio39o	0	صادق 166
168	مرحبا بكم	pic.png		kw	D8D8A9A9C0	217.195.37.234	bot-mv5o8n27kfoim254xw	0	صادق 167
169	مرحبا بكم	pic.png		kw	D8D8A9A9C0	219.103.93.221	bot-gr618nxw9j8zjcuhht	0	صادق 168
170	مرحبا بكم	pic.png		kw	D8D8A9A9C0	50.8.173.253	bot-y1026zfhdgtadv9iro	0	صادق 169
171	مرحبا بكم	pic.png		kw	D8D8A9A9C0	32.184.135.52	bot-lqme32udu4uukjy35h	0	صادق 170
172	مرحبا بكم	pic.png		kw	D8D8A9A9C0	110.144.198.189	bot-pybev6wm2pp70hstcj	0	صادق 171
173	مرحبا بكم	pic.png		kw	D8D8A9A9C0	211.240.242.119	bot-hsy0awg6urq4z8xkr6	0	صادق 172
174	مرحبا بكم	pic.png		kw	D8D8A9A9C0	195.27.77.61	bot-yoeeyc6vj4wyx8c0hn	0	صادق 173
175	مرحبا بكم	pic.png		kw	D8D8A9A9C0	72.24.12.151	bot-kwksabhkutterf7hof	0	صادق 174
176	مرحبا بكم	pic.png		kw	D8D8A9A9C0	16.16.156.87	bot-1ydaqlrk04qgt8ka8t	0	صادق 175
177	مرحبا بكم	pic.png		kw	D8D8A9A9C0	207.113.20.199	bot-8h0g000j6k824qq184	0	صادق 176
178	مرحبا بكم	pic.png		kw	D8D8A9A9C0	106.142.182.155	bot-du2xfqcy3xb9mh60pw	0	صادق 177
179	مرحبا بكم	pic.png		kw	D8D8A9A9C0	89.228.232.217	bot-a9xdpjnkve4j9e5avp	0	صادق 178
180	مرحبا بكم	pic.png		kw	D8D8A9A9C0	167.82.150.95	bot-mezz1td47h1d5g7m4t	0	صادق 179
181	مرحبا بكم	pic.png		kw	D8D8A9A9C0	92.147.64.155	bot-wjhndfi657ttdqp4bm	0	صادق 180
182	مرحبا بكم	pic.png		kw	D8D8A9A9C0	137.210.186.132	bot-qn75o06blg8xyg9ost	0	صادق 181
183	مرحبا بكم	pic.png		kw	D8D8A9A9C0	54.95.49.153	bot-qhsa9m76ftlx9jo6i5	0	صادق 182
184	مرحبا بكم	pic.png		kw	D8D8A9A9C0	95.144.109.104	bot-f3n630wlrwgq56yd93	0	صادق 183
185	مرحبا بكم	pic.png		kw	D8D8A9A9C0	205.217.238.113	bot-05ss4rfxazpwqw1mzd	0	صادق 184
186	مرحبا بكم	pic.png		kw	D8D8A9A9C0	68.215.248.219	bot-ed70ea3l5m66wti2ve	0	صادق 185
187	مرحبا بكم	pic.png		kw	D8D8A9A9C0	123.159.67.8	bot-j3qe8ue2vsx7t9zpbp	0	صادق 186
188	مرحبا بكم	pic.png		kw	D8D8A9A9C0	199.76.224.11	bot-ziwvbd50qxywpa4iap	0	صادق 187
189	مرحبا بكم	pic.png		kw	D8D8A9A9C0	41.187.122.217	bot-p57te3u94vj6b8yhv8	0	صادق 188
190	مرحبا بكم	pic.png		kw	D8D8A9A9C0	136.27.54.145	bot-7mb1p8m699o1hik5xg	0	صادق 189
191	مرحبا بكم	pic.png		kw	D8D8A9A9C0	56.198.44.71	bot-ork7prqo5iyeb22sze	0	صادق 190
192	مرحبا بكم	pic.png		kw	D8D8A9A9C0	87.12.111.243	bot-833f5z1bepn25iutss	0	صادق 191
193	مرحبا بكم	pic.png		kw	D8D8A9A9C0	99.240.134.200	bot-qj9ypz94f6w7yd96m6	0	صادق 192
194	مرحبا بكم	pic.png		kw	D8D8A9A9C0	179.72.208.68	bot-hwvxx7ug33rrtmhnv6	0	صادق 193
195	مرحبا بكم	pic.png		kw	D8D8A9A9C0	34.27.56.204	bot-4wa025winf8y15wov1	0	صادق 194
196	مرحبا بكم	pic.png		kw	D8D8A9A9C0	169.45.98.130	bot-m673ozd2jlj03sysjn	0	صادق 195
197	مرحبا بكم	pic.png		kw	D8D8A9A9C0	77.235.120.132	bot-8ikvuitwnz1in85nkt	0	صادق 196
198	مرحبا بكم	pic.png		kw	D8D8A9A9C0	112.227.97.219	bot-9a6a6x7si2b35gnume	0	صادق 197
199	مرحبا بكم	pic.png		kw	D8D8A9A9C0	137.46.2.30	bot-pi6quqeb26aomqfzbi	0	صادق 198
200	مرحبا بكم	pic.png		kw	D8D8A9A9C0	14.24.73.173	bot-08vzgbr0b4thogi230	0	صادق 199
201	مرحبا بكم	pic.png		kw	D8D8A9A9C0	120.18.218.104	bot-hfcaemdnp87vf3zg15	0	صادق 200
202	مرحبا بكم	pic.png		kw	D8D8A9A9C0	206.5.161.110	bot-hy9zbhgkkw7930pvv9	0	صادق 201
203	مرحبا بكم	pic.png		kw	D8D8A9A9C0	197.237.37.188	bot-zb00posqustc38i3cd	0	صادق 202
204	مرحبا بكم	pic.png		kw	D8D8A9A9C0	55.41.65.26	bot-jxow727w5xuzw1oqk2	0	صادق 203
205	مرحبا بكم	pic.png		kw	D8D8A9A9C0	116.115.28.208	bot-zgyhx9xdk7fqrtuh07	0	صادق 204
206	مرحبا بكم	pic.png		kw	D8D8A9A9C0	25.212.208.90	bot-6ra3e8d9inz9jky3af	0	صادق 205
207	مرحبا بكم	pic.png		kw	D8D8A9A9C0	207.144.231.108	bot-y98g5laxvfnzsytsou	0	صادق 206
208	مرحبا بكم	pic.png		kw	D8D8A9A9C0	150.104.123.14	bot-0h4ril9d625cj0oeoq	0	صادق 207
209	مرحبا بكم	pic.png		kw	D8D8A9A9C0	16.175.233.75	bot-qbl2s5f9slvul22oci	0	صادق 208
210	مرحبا بكم	pic.png		kw	D8D8A9A9C0	158.22.192.52	bot-m048ceu18lx2v60p4m	0	صادق 209
211	مرحبا بكم	pic.png		kw	D8D8A9A9C0	162.120.229.32	bot-hy1v5vvdlf7a3izva9	0	صادق 210
212	مرحبا بكم	pic.png		kw	D8D8A9A9C0	103.228.14.63	bot-cv27ma5v7iw9whqk3k	0	صادق 211
213	مرحبا بكم	pic.png		kw	D8D8A9A9C0	208.126.191.133	bot-5yc80hy7nzckxpb12a	0	صادق 212
214	مرحبا بكم	pic.png		kw	D8D8A9A9C0	108.45.111.132	bot-hi5bord8hnpb2zd2hy	0	صادق 213
215	مرحبا بكم	pic.png		kw	D8D8A9A9C0	105.129.170.78	bot-jrk81cmrkodm0s5nbm	0	صادق 214
216	مرحبا بكم	pic.png		kw	D8D8A9A9C0	202.7.165.182	bot-lqk1tm0eqtl6gi5h0j	0	صادق 215
217	مرحبا بكم	pic.png		kw	D8D8A9A9C0	63.225.103.188	bot-6g86i06my9mm04crpy	0	صادق 216
218	مرحبا بكم	pic.png		kw	D8D8A9A9C0	60.236.106.227	bot-i4hf7u2k39nwwlfdeu	0	صادق 217
219	مرحبا بكم	pic.png		kw	D8D8A9A9C0	147.105.127.253	bot-nbv1mlcjr5i03oh223	0	صادق 218
220	مرحبا بكم	pic.png		kw	D8D8A9A9C0	80.187.195.43	bot-dbaepa4ntgv6y2p8b0	0	صادق 219
221	مرحبا بكم	pic.png		kw	D8D8A9A9C0	204.171.121.132	bot-azgir1azqqxbtqnfp5	0	صادق 220
222	مرحبا بكم	pic.png		kw	D8D8A9A9C0	27.129.248.47	bot-b654pfmq8idadw3fmq	0	صادق 221
223	مرحبا بكم	pic.png		kw	D8D8A9A9C0	221.53.81.237	bot-se0bia10vcmsx6h3w1	0	صادق 222
224	مرحبا بكم	pic.png		kw	D8D8A9A9C0	124.103.163.200	bot-epj1t9a0nfkucbrjil	0	صادق 223
225	مرحبا بكم	pic.png		kw	D8D8A9A9C0	183.149.110.9	bot-kyilmb54a3nrs7xvbu	0	صادق 224
226	مرحبا بكم	pic.png		kw	D8D8A9A9C0	202.180.122.107	bot-vmrqiqy5zau756wbse	0	صادق 225
227	مرحبا بكم	pic.png		kw	D8D8A9A9C0	176.20.104.236	bot-3mxzqukfg93n3uaomo	0	صادق 226
228	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.80.108.188	bot-2vnrwqywx4syz5x12f	0	صادق 227
229	مرحبا بكم	pic.png		kw	D8D8A9A9C0	170.92.90.177	bot-scxe3t5cfff52gfter	0	صادق 228
230	مرحبا بكم	pic.png		kw	D8D8A9A9C0	222.52.37.39	bot-6mfg6gnlgm5a8ln65b	0	صادق 229
231	مرحبا بكم	pic.png		kw	D8D8A9A9C0	63.36.208.127	bot-lz2xs7wwm3r6a9m3dq	0	صادق 230
232	مرحبا بكم	pic.png		kw	D8D8A9A9C0	34.188.203.113	bot-b2qgw2bxjayz4buq6m	0	صادق 231
233	مرحبا بكم	pic.png		kw	D8D8A9A9C0	199.201.66.51	bot-op0tbxjlwsjkqospth	0	صادق 232
234	مرحبا بكم	pic.png		kw	D8D8A9A9C0	17.153.199.19	bot-pyavqn85gbud5n9s47	0	صادق 233
235	مرحبا بكم	pic.png		kw	D8D8A9A9C0	61.98.185.153	bot-8wgtw114oycsv7kens	0	صادق 234
236	مرحبا بكم	pic.png		kw	D8D8A9A9C0	122.225.19.112	bot-eqnl8yz24av5r022r0	0	صادق 235
237	مرحبا بكم	pic.png		kw	D8D8A9A9C0	220.20.60.56	bot-mxew9l1pixfo415wpa	0	صادق 236
238	مرحبا بكم	pic.png		kw	D8D8A9A9C0	203.117.165.184	bot-t7vnwodc2jic3ht40t	0	صادق 237
239	مرحبا بكم	pic.png		kw	D8D8A9A9C0	137.38.151.51	bot-ygza9ffe928num6hnp	0	صادق 238
240	مرحبا بكم	pic.png		kw	D8D8A9A9C0	108.46.176.171	bot-l77ztpdkimd420ex4h	0	صادق 239
241	مرحبا بكم	pic.png		kw	D8D8A9A9C0	213.15.147.221	bot-z8v913ihiqef5sfpre	0	صادق 240
242	مرحبا بكم	pic.png		kw	D8D8A9A9C0	12.178.251.176	bot-jtj375ixm5jvh26lhb	0	صادق 241
243	مرحبا بكم	pic.png		kw	D8D8A9A9C0	168.118.58.156	bot-j54uk57eodn2esl37w	0	صادق 242
244	مرحبا بكم	pic.png		kw	D8D8A9A9C0	37.53.213.161	bot-jvnkha8j01yhmomro8	0	صادق 243
245	مرحبا بكم	pic.png		kw	D8D8A9A9C0	186.251.234.86	bot-97qsey0d2j05weuqo6	0	صادق 244
246	مرحبا بكم	pic.png		kw	D8D8A9A9C0	104.222.181.114	bot-ye1pwop15zbsrbuqq7	0	صادق 245
247	مرحبا بكم	pic.png		kw	D8D8A9A9C0	30.180.215.60	bot-rwvlep9eiqe1hgzrng	0	صادق 246
248	مرحبا بكم	pic.png		kw	D8D8A9A9C0	218.106.164.193	bot-s0831dqwgx2zpm2w3y	0	صادق 247
249	مرحبا بكم	pic.png		kw	D8D8A9A9C0	223.30.35.148	bot-1vb8v6gky5mc9p6wd5	0	صادق 248
250	مرحبا بكم	pic.png		kw	D8D8A9A9C0	66.196.177.66	bot-idc4tat1kjkygliowe	0	صادق 249
251	مرحبا بكم	pic.png		kw	D8D8A9A9C0	142.72.150.104	bot-e2fi79o96bl27tn9i6	0	صادق 250
252	مرحبا بكم	pic.png		kw	D8D8A9A9C0	79.75.31.136	bot-jey1b6v6whcqkkm7hr	0	صادق 251
253	مرحبا بكم	pic.png		kw	D8D8A9A9C0	212.245.47.32	bot-gjj9o7lp4zm3mtp5sr	0	صادق 252
254	مرحبا بكم	pic.png		kw	D8D8A9A9C0	167.107.117.217	bot-f775mqf4tb81ugjta3	0	صادق 253
255	مرحبا بكم	pic.png		kw	D8D8A9A9C0	11.252.141.20	bot-v5z9e66d6ik9q7z2wq	0	صادق 254
256	مرحبا بكم	pic.png		kw	D8D8A9A9C0	220.226.104.25	bot-vtnqvawby66fbesvvd	0	صادق 255
257	مرحبا بكم	pic.png		kw	D8D8A9A9C0	26.63.161.58	bot-96s8w8is9eddy827mg	0	صادق 256
258	مرحبا بكم	pic.png		kw	D8D8A9A9C0	28.150.69.223	bot-kzj74aznk59u1n7hwg	0	صادق 257
259	مرحبا بكم	pic.png		kw	D8D8A9A9C0	217.186.53.152	bot-6e4xlj881mltwfkzob	0	صادق 258
260	مرحبا بكم	pic.png		kw	D8D8A9A9C0	14.78.226.246	bot-kghj8j7tcnbidrf3pc	0	صادق 259
261	مرحبا بكم	pic.png		kw	D8D8A9A9C0	169.210.40.129	bot-ux71ty2a9pe1dh9vdz	0	صادق 260
262	مرحبا بكم	pic.png		kw	D8D8A9A9C0	178.172.52.227	bot-pfj1wbd6qezxk6cxgy	0	صادق 261
263	مرحبا بكم	pic.png		kw	D8D8A9A9C0	20.33.235.154	bot-6irgx9cc9z6hmyi4g0	0	صادق 262
264	مرحبا بكم	pic.png		kw	D8D8A9A9C0	206.14.226.178	bot-le19ga1nglox39m302	0	صادق 263
265	مرحبا بكم	pic.png		kw	D8D8A9A9C0	78.239.251.163	bot-9r7ich6f8zgpnm1j7t	0	صادق 264
266	مرحبا بكم	pic.png		kw	D8D8A9A9C0	17.163.175.143	bot-6cjuppjrey0eyp42iv	0	صادق 265
267	مرحبا بكم	pic.png		kw	D8D8A9A9C0	219.3.140.28	bot-8hzka65jlelk2zb2r1	0	صادق 266
268	مرحبا بكم	pic.png		kw	D8D8A9A9C0	89.25.19.111	bot-3g681juer7m76wqyul	0	صادق 267
269	مرحبا بكم	pic.png		kw	D8D8A9A9C0	193.228.219.174	bot-5zwo2c5bdv76mfdt57	0	صادق 268
270	مرحبا بكم	pic.png		kw	D8D8A9A9C0	123.142.34.229	bot-a4p57zhig5ormd5e4g	0	صادق 269
271	مرحبا بكم	pic.png		kw	D8D8A9A9C0	193.160.242.200	bot-ffnmbs57y3tnv1mh6y	0	صادق 270
272	مرحبا بكم	pic.png		kw	D8D8A9A9C0	126.122.88.223	bot-rhkiggraob67uw24fj	0	صادق 271
273	مرحبا بكم	pic.png		kw	D8D8A9A9C0	61.193.182.27	bot-1dgqxuig023g4dvin8	0	صادق 272
274	مرحبا بكم	pic.png		kw	D8D8A9A9C0	17.186.0.139	bot-otktr4yhdemz3pocz4	0	صادق 273
275	مرحبا بكم	pic.png		kw	D8D8A9A9C0	116.106.76.21	bot-2tfycdxjftgw1xjip5	0	صادق 274
276	مرحبا بكم	pic.png		kw	D8D8A9A9C0	170.24.189.34	bot-0neyqf1u9fnzyjmsob	0	صادق 275
277	مرحبا بكم	pic.png		kw	D8D8A9A9C0	34.219.150.92	bot-ygyk0eobynzblxiu1o	0	صادق 276
278	مرحبا بكم	pic.png		kw	D8D8A9A9C0	110.228.26.88	bot-vlfb2h4etgaw984iue	0	صادق 277
279	مرحبا بكم	pic.png		kw	D8D8A9A9C0	37.73.18.182	bot-ka9b4u2j35wef9pcxr	0	صادق 278
280	مرحبا بكم	pic.png		kw	D8D8A9A9C0	48.204.252.214	bot-ovg8wcipaeh8193b47	0	صادق 279
281	مرحبا بكم	pic.png		kw	D8D8A9A9C0	126.6.219.149	bot-8q6rc2ci5wpe54z7mi	0	صادق 280
282	مرحبا بكم	pic.png		kw	D8D8A9A9C0	194.45.217.185	bot-f2rf13rzipyq21lhm3	0	صادق 281
283	مرحبا بكم	pic.png		kw	D8D8A9A9C0	30.42.134.127	bot-orisf9qubto23t2rtw	0	صادق 282
284	مرحبا بكم	pic.png		kw	D8D8A9A9C0	206.63.106.179	bot-3rl5fv4cysvkz2aj96	0	صادق 283
285	مرحبا بكم	pic.png		kw	D8D8A9A9C0	89.100.245.50	bot-6azz5ht9cvd9zfq5zk	0	صادق 284
286	مرحبا بكم	pic.png		kw	D8D8A9A9C0	128.120.183.174	bot-72tk3idcjhcajn0pko	0	صادق 285
287	مرحبا بكم	pic.png		kw	D8D8A9A9C0	142.182.47.45	bot-sqq82ddqc27jkcbx8z	0	صادق 286
288	مرحبا بكم	pic.png		kw	D8D8A9A9C0	93.240.239.55	bot-7h1048valmarko3bjy	0	صادق 287
289	مرحبا بكم	pic.png		kw	D8D8A9A9C0	62.56.65.113	bot-lpfjddke3b6dgf9hjl	0	صادق 288
290	مرحبا بكم	pic.png		kw	D8D8A9A9C0	108.104.155.93	bot-ly32ij3cxeolu3hjzp	0	صادق 289
291	مرحبا بكم	pic.png		kw	D8D8A9A9C0	25.211.14.60	bot-vfq21o6vyliuf8tnij	0	صادق 290
292	مرحبا بكم	pic.png		kw	D8D8A9A9C0	210.181.226.183	bot-fqg2j7tyj09cet6an6	0	صادق 291
293	مرحبا بكم	pic.png		kw	D8D8A9A9C0	44.131.247.118	bot-hir2fj3hsp8xort2gf	0	صادق 292
294	مرحبا بكم	pic.png		kw	D8D8A9A9C0	104.210.32.14	bot-k3r79f28p06aq5lyvf	0	صادق 293
295	مرحبا بكم	pic.png		kw	D8D8A9A9C0	132.202.151.227	bot-byxi3ivqk3mg3xesxh	0	صادق 294
296	مرحبا بكم	pic.png		kw	D8D8A9A9C0	124.131.155.5	bot-6acsb21gceibq4dw75	0	صادق 295
297	مرحبا بكم	pic.png		kw	D8D8A9A9C0	222.133.170.136	bot-rtp09reiz2yp8xa634	0	صادق 296
298	مرحبا بكم	pic.png		kw	D8D8A9A9C0	218.202.183.217	bot-s6ik1lb5wik1u4csto	0	صادق 297
299	مرحبا بكم	pic.png		kw	D8D8A9A9C0	69.156.198.158	bot-4lfak7rwwrzqabx15j	0	صادق 298
300	مرحبا بكم	pic.png		kw	D8D8A9A9C0	191.44.185.151	bot-jwup8uee7von3fvyn0	0	صادق 299
301	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.62.193.139	bot-1jzkeecbahsnb5jibl	0	صادق 300
302	مرحبا بكم	pic.png		kw	D8D8A9A9C0	110.108.137.77	bot-ibv9qlehou779n5ks0	0	صادق 301
303	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.238.59.171	bot-w4scu1ye8l9flohi4o	0	صادق 302
304	مرحبا بكم	pic.png		kw	D8D8A9A9C0	206.42.140.131	bot-xqssx6nmw3vg944p29	0	صادق 303
305	مرحبا بكم	pic.png		kw	D8D8A9A9C0	50.76.116.48	bot-ce2ow8pc2itjmltjcp	0	صادق 304
306	مرحبا بكم	pic.png		kw	D8D8A9A9C0	220.144.136.10	bot-a24615jwdrlhbnszdv	0	صادق 305
307	مرحبا بكم	pic.png		kw	D8D8A9A9C0	199.68.251.198	bot-szz4q40vqbqb6anmwk	0	صادق 306
308	مرحبا بكم	pic.png		kw	D8D8A9A9C0	71.173.119.183	bot-qrwgpkhuqtr5qy5mzm	0	صادق 307
309	مرحبا بكم	pic.png		kw	D8D8A9A9C0	148.27.206.228	bot-d2fizcxd967c06az8g	0	صادق 308
310	مرحبا بكم	pic.png		kw	D8D8A9A9C0	67.26.94.142	bot-3ogar7329fu66ale16	0	صادق 309
311	مرحبا بكم	pic.png		kw	D8D8A9A9C0	183.104.70.204	bot-3b2kbzis3elwzyt2jt	0	صادق 310
312	مرحبا بكم	pic.png		kw	D8D8A9A9C0	26.200.90.136	bot-7tpgqt47urplx3qur1	0	صادق 311
313	مرحبا بكم	pic.png		kw	D8D8A9A9C0	91.226.239.57	bot-1dwn94444ck3h6ds8o	0	صادق 312
314	مرحبا بكم	pic.png		kw	D8D8A9A9C0	29.167.57.173	bot-384j240wwij25g14tr	0	صادق 313
315	مرحبا بكم	pic.png		kw	D8D8A9A9C0	186.50.135.247	bot-td53vw5kefu4rbihrf	0	صادق 314
316	مرحبا بكم	pic.png		kw	D8D8A9A9C0	119.71.192.241	bot-ak9r23dlozco8ld3ht	0	صادق 315
317	مرحبا بكم	pic.png		kw	D8D8A9A9C0	166.71.240.61	bot-hdx48mmvmbtoa697lf	0	صادق 316
318	مرحبا بكم	pic.png		kw	D8D8A9A9C0	16.121.121.234	bot-47rrwb6vcn9i1x480q	0	صادق 317
319	مرحبا بكم	pic.png		kw	D8D8A9A9C0	61.80.69.78	bot-lifizfre5fkcx631zd	0	صادق 318
320	مرحبا بكم	pic.png		kw	D8D8A9A9C0	161.179.243.85	bot-j0hga558iv7mzwrqlf	0	صادق 319
321	مرحبا بكم	pic.png		kw	D8D8A9A9C0	13.118.9.191	bot-n346gs4e3h8zghiq4h	0	صادق 320
322	مرحبا بكم	pic.png		kw	D8D8A9A9C0	194.16.17.191	bot-8kqpy5u8qow995vgm9	0	صادق 321
323	مرحبا بكم	pic.png		kw	D8D8A9A9C0	211.11.26.220	bot-alholun7y1ed24pcwx	0	صادق 322
324	مرحبا بكم	pic.png		kw	D8D8A9A9C0	111.247.149.95	bot-c42oxao1dtre2bar97	0	صادق 323
325	مرحبا بكم	pic.png		kw	D8D8A9A9C0	210.58.35.131	bot-2ggab9b934v1jsg42w	0	صادق 324
326	مرحبا بكم	pic.png		kw	D8D8A9A9C0	100.70.4.181	bot-4e8ev33h44l17myd4c	0	صادق 325
327	مرحبا بكم	pic.png		kw	D8D8A9A9C0	214.26.126.142	bot-d7g4izfi5r113co99z	0	صادق 326
328	مرحبا بكم	pic.png		kw	D8D8A9A9C0	46.174.77.8	bot-bzytsegy433r5z0izh	0	صادق 327
329	مرحبا بكم	pic.png		kw	D8D8A9A9C0	64.52.232.132	bot-qejayqffp7puevdwv6	0	صادق 328
330	مرحبا بكم	pic.png		kw	D8D8A9A9C0	86.47.200.95	bot-239nifadg0vydlz9tf	0	صادق 329
331	مرحبا بكم	pic.png		kw	D8D8A9A9C0	193.7.194.226	bot-3d0qvxhexnpqufw0km	0	صادق 330
332	مرحبا بكم	pic.png		kw	D8D8A9A9C0	63.205.66.104	bot-reiu9c9jb9k4cz3go5	0	صادق 331
333	مرحبا بكم	pic.png		kw	D8D8A9A9C0	93.199.215.92	bot-nb5ld0vqeld59drqfv	0	صادق 332
334	مرحبا بكم	pic.png		kw	D8D8A9A9C0	76.238.139.23	bot-awr31wg1usbfkb3e23	0	صادق 333
335	مرحبا بكم	pic.png		kw	D8D8A9A9C0	135.218.37.113	bot-yrsv21fl17ryihqtbg	0	صادق 334
336	مرحبا بكم	pic.png		kw	D8D8A9A9C0	163.21.239.119	bot-ntp1ld9z3wagcxt36w	0	صادق 335
337	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.16.182.104	bot-gkxd8z1k2yrg0usbcl	0	صادق 336
338	مرحبا بكم	pic.png		kw	D8D8A9A9C0	217.40.194.110	bot-tvfpyit31wi0eluv81	0	صادق 337
339	مرحبا بكم	pic.png		kw	D8D8A9A9C0	168.65.209.76	bot-lautr9vuosp6a8kbjm	0	صادق 338
340	مرحبا بكم	pic.png		kw	D8D8A9A9C0	67.210.213.53	bot-91g33zz7lw7un8d95t	0	صادق 339
341	مرحبا بكم	pic.png		kw	D8D8A9A9C0	88.63.183.189	bot-updxbo9spiph0lwjta	0	صادق 340
342	مرحبا بكم	pic.png		kw	D8D8A9A9C0	170.126.30.191	bot-xnftksjuz2rugv80rz	0	صادق 341
343	مرحبا بكم	pic.png		kw	D8D8A9A9C0	211.125.129.209	bot-m8x2svm4cogxjtrgod	0	صادق 342
344	مرحبا بكم	pic.png		kw	D8D8A9A9C0	220.121.161.35	bot-r9z1b4hgz6ekyanflh	0	صادق 343
345	مرحبا بكم	pic.png		kw	D8D8A9A9C0	220.57.99.213	bot-tn9yt4qlog5y58mfej	0	صادق 344
346	مرحبا بكم	pic.png		kw	D8D8A9A9C0	188.91.130.57	bot-cfxdmdjky2z8nn865k	0	صادق 345
347	مرحبا بكم	pic.png		kw	D8D8A9A9C0	111.252.143.187	bot-jx8l6s9yaisispqswj	0	صادق 346
348	مرحبا بكم	pic.png		kw	D8D8A9A9C0	47.236.246.90	bot-eqa0rf0lrt0ptihg7i	0	صادق 347
349	مرحبا بكم	pic.png		kw	D8D8A9A9C0	107.26.179.198	bot-jyyvb86ankphonspk3	0	صادق 348
350	مرحبا بكم	pic.png		kw	D8D8A9A9C0	13.42.136.65	bot-u3hw546u2w2wc22s6i	0	صادق 349
351	مرحبا بكم	pic.png		kw	D8D8A9A9C0	24.250.109.33	bot-h5ror6k7x3rnj3kryo	0	صادق 350
352	مرحبا بكم	pic.png		kw	D8D8A9A9C0	67.189.173.189	bot-5lg2cq85pex8177nnz	0	صادق 351
353	مرحبا بكم	pic.png		kw	D8D8A9A9C0	120.16.61.184	bot-wt3t7qblsi83sq1aj6	0	صادق 352
354	مرحبا بكم	pic.png		kw	D8D8A9A9C0	131.85.212.107	bot-vbqjwsbwvqeazj1f5h	0	صادق 353
355	مرحبا بكم	pic.png		kw	D8D8A9A9C0	115.3.60.128	bot-vf27keyb5fkd0m6m2m	0	صادق 354
356	مرحبا بكم	pic.png		kw	D8D8A9A9C0	130.104.104.114	bot-gf816katzrss1e3mci	0	صادق 355
357	مرحبا بكم	pic.png		kw	D8D8A9A9C0	92.238.142.161	bot-tqb2ez4evkqr5y0opf	0	صادق 356
358	مرحبا بكم	pic.png		kw	D8D8A9A9C0	145.22.87.98	bot-zxd6rlxf45po1ju2jn	0	صادق 357
359	مرحبا بكم	pic.png		kw	D8D8A9A9C0	98.229.66.150	bot-grkl9cnufmocgyb7cg	0	صادق 358
360	مرحبا بكم	pic.png		kw	D8D8A9A9C0	101.78.36.149	bot-zc5afmmc52woy47z5z	0	صادق 359
361	مرحبا بكم	pic.png		kw	D8D8A9A9C0	94.209.165.238	bot-z5pe9vx7fuf1keuuk6	0	صادق 360
362	مرحبا بكم	pic.png		kw	D8D8A9A9C0	169.82.80.146	bot-135m2ls5lc3kafp4d8	0	صادق 361
363	مرحبا بكم	pic.png		kw	D8D8A9A9C0	187.78.24.122	bot-fxfv455ubilv1mm5ab	0	صادق 362
364	مرحبا بكم	pic.png		kw	D8D8A9A9C0	20.13.66.229	bot-h7jlzv2v66j56c5256	0	صادق 363
365	مرحبا بكم	pic.png		kw	D8D8A9A9C0	78.48.103.6	bot-lgdw9zrj8cc3meaa45	0	صادق 364
366	مرحبا بكم	pic.png		kw	D8D8A9A9C0	200.233.234.173	bot-4cxr7o7d7k86eyxi1o	0	صادق 365
367	مرحبا بكم	pic.png		kw	D8D8A9A9C0	81.219.247.211	bot-ac7w6mt62fkfyl1ult	0	صادق 366
368	مرحبا بكم	pic.png		kw	D8D8A9A9C0	123.115.86.211	bot-djrvodhnumvlh9v94p	0	صادق 367
369	مرحبا بكم	pic.png		kw	D8D8A9A9C0	200.176.114.252	bot-2zoc7lu1fryx2aslxe	0	صادق 368
370	مرحبا بكم	pic.png		kw	D8D8A9A9C0	47.158.186.34	bot-hmyv38xkeap8p12g8m	0	صادق 369
371	مرحبا بكم	pic.png		kw	D8D8A9A9C0	199.35.171.195	bot-pt8o62ka3djnhhnxqs	0	صادق 370
372	مرحبا بكم	pic.png		kw	D8D8A9A9C0	52.19.187.74	bot-ttii0mragmwxipekbu	0	صادق 371
373	مرحبا بكم	pic.png		kw	D8D8A9A9C0	46.248.80.75	bot-n9tc0ntn5pyfkfqjl5	0	صادق 372
374	مرحبا بكم	pic.png		kw	D8D8A9A9C0	67.220.129.135	bot-vf8xkf3ekcxkfyr6kz	0	صادق 373
375	مرحبا بكم	pic.png		kw	D8D8A9A9C0	155.155.44.191	bot-w7k22mqbhou70l2w21	0	صادق 374
376	مرحبا بكم	pic.png		kw	D8D8A9A9C0	221.184.11.158	bot-y3hkrtojf43lxj0rsv	0	صادق 375
377	مرحبا بكم	pic.png		kw	D8D8A9A9C0	113.99.211.217	bot-5s8687hsfmxpu46h4w	0	صادق 376
378	مرحبا بكم	pic.png		kw	D8D8A9A9C0	36.59.245.171	bot-zoegiopuakbdo8zuao	0	صادق 377
379	مرحبا بكم	pic.png		kw	D8D8A9A9C0	72.57.15.137	bot-p52axck48wranyo344	0	صادق 378
380	مرحبا بكم	pic.png		kw	D8D8A9A9C0	194.149.219.225	bot-ceowsk68l8nwq7qkep	0	صادق 379
381	مرحبا بكم	pic.png		kw	D8D8A9A9C0	61.123.128.37	bot-fifk6xs9qc0mue0rob	0	صادق 380
382	مرحبا بكم	pic.png		kw	D8D8A9A9C0	207.206.248.158	bot-xzy86i9iomf4xcqwfw	0	صادق 381
383	مرحبا بكم	pic.png		kw	D8D8A9A9C0	63.58.190.96	bot-yygnj5ua6n4qw0ncmp	0	صادق 382
384	مرحبا بكم	pic.png		kw	D8D8A9A9C0	42.170.1.175	bot-el22sjeu9u2d9u3v4x	0	صادق 383
385	مرحبا بكم	pic.png		kw	D8D8A9A9C0	21.156.83.124	bot-y6bclc83fha45tadwo	0	صادق 384
386	مرحبا بكم	pic.png		kw	D8D8A9A9C0	85.123.109.182	bot-ej8pfgp7ejzjolmm1v	0	صادق 385
387	مرحبا بكم	pic.png		kw	D8D8A9A9C0	165.215.188.40	bot-urznlqj7rx7qvvbqkj	0	صادق 386
388	مرحبا بكم	pic.png		kw	D8D8A9A9C0	119.236.90.108	bot-jjesx6ncuf9lveunt9	0	صادق 387
389	مرحبا بكم	pic.png		kw	D8D8A9A9C0	178.0.243.133	bot-w2cpcp62lkkes4jxrl	0	صادق 388
390	مرحبا بكم	pic.png		kw	D8D8A9A9C0	25.222.76.8	bot-udsd2ig8yecv61ut2z	0	صادق 389
391	مرحبا بكم	pic.png		kw	D8D8A9A9C0	175.155.107.146	bot-fqkj2s0olo4a780n4l	0	صادق 390
392	مرحبا بكم	pic.png		kw	D8D8A9A9C0	216.195.82.173	bot-y18yr0zcr8jp8qmhnz	0	صادق 391
393	مرحبا بكم	pic.png		kw	D8D8A9A9C0	183.198.43.137	bot-hkobqxj24o6jdlqvs6	0	صادق 392
394	مرحبا بكم	pic.png		kw	D8D8A9A9C0	93.117.129.127	bot-k55io0wsyc0wtwsmfb	0	صادق 393
395	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.153.240.236	bot-r37y8960oq0esqlxod	0	صادق 394
396	مرحبا بكم	pic.png		kw	D8D8A9A9C0	198.44.163.98	bot-8j5j6axsnkejcvll7m	0	صادق 395
397	مرحبا بكم	pic.png		kw	D8D8A9A9C0	99.135.228.99	bot-6lrvn2paeqewdb12u9	0	صادق 396
398	مرحبا بكم	pic.png		kw	D8D8A9A9C0	153.129.92.161	bot-7uph2hhppwhipq5e17	0	صادق 397
399	مرحبا بكم	pic.png		kw	D8D8A9A9C0	147.217.125.206	bot-no2x2vgaputulrvfb3	0	صادق 398
400	مرحبا بكم	pic.png		kw	D8D8A9A9C0	214.148.143.204	bot-20tetfc66r8x9ul34g	0	صادق 399
401	مرحبا بكم	pic.png		kw	D8D8A9A9C0	210.217.38.44	bot-fbsvvfuwhflktqqehy	0	صادق 400
402	مرحبا بكم	pic.png		kw	D8D8A9A9C0	115.132.67.146	bot-8bjp4zcnxbfdhfz2xs	0	صادق 401
403	مرحبا بكم	pic.png		kw	D8D8A9A9C0	197.47.198.100	bot-nzdpplmosgr5d4umzs	0	صادق 402
404	مرحبا بكم	pic.png		kw	D8D8A9A9C0	61.3.37.128	bot-c03hv1b4u1biks5tgo	0	صادق 403
405	مرحبا بكم	pic.png		kw	D8D8A9A9C0	112.37.129.143	bot-y3prxwn6c97ufkhydb	0	صادق 404
406	مرحبا بكم	pic.png		kw	D8D8A9A9C0	176.248.195.168	bot-6ujj1hjemyb6r8u1d8	0	صادق 405
407	مرحبا بكم	pic.png		kw	D8D8A9A9C0	154.221.41.96	bot-kdlk1f50kffpbljizk	0	صادق 406
408	مرحبا بكم	pic.png		kw	D8D8A9A9C0	72.225.224.132	bot-vqj6daw8ysfxgcotm3	0	صادق 407
409	مرحبا بكم	pic.png		kw	D8D8A9A9C0	18.7.196.85	bot-75covme18w7buhhjqp	0	صادق 408
410	مرحبا بكم	pic.png		kw	D8D8A9A9C0	207.129.49.93	bot-q5kbwnall694nnznic	0	صادق 409
411	مرحبا بكم	pic.png		kw	D8D8A9A9C0	64.244.202.7	bot-2i0qme581edhfq5gim	0	صادق 410
412	مرحبا بكم	pic.png		kw	D8D8A9A9C0	179.176.157.232	bot-8jpy0qhj17jo8x6r3e	0	صادق 411
413	مرحبا بكم	pic.png		kw	D8D8A9A9C0	134.201.145.174	bot-n14ixq3r9mcq9w14f9	0	صادق 412
414	مرحبا بكم	pic.png		kw	D8D8A9A9C0	127.69.29.226	bot-kqc9qcwygfkiku863v	0	صادق 413
415	مرحبا بكم	pic.png		kw	D8D8A9A9C0	44.225.73.214	bot-nnx957v3rvwkp4pxh7	0	صادق 414
416	مرحبا بكم	pic.png		kw	D8D8A9A9C0	144.235.36.15	bot-g3bufmcxijnny13zy0	0	صادق 415
417	مرحبا بكم	pic.png		kw	D8D8A9A9C0	142.250.134.189	bot-vy4lfg39irp4o0xv7e	0	صادق 416
418	مرحبا بكم	pic.png		kw	D8D8A9A9C0	154.210.20.239	bot-ztbg15gi9vjyiqa7xd	0	صادق 417
419	مرحبا بكم	pic.png		kw	D8D8A9A9C0	75.245.59.96	bot-wpymy0cf5v98jvo5qw	0	صادق 418
420	مرحبا بكم	pic.png		kw	D8D8A9A9C0	92.242.105.25	bot-vdx24yavxoyh95oywl	0	صادق 419
421	مرحبا بكم	pic.png		kw	D8D8A9A9C0	173.9.248.32	bot-ed37iuzcno86n6oef4	0	صادق 420
422	مرحبا بكم	pic.png		kw	D8D8A9A9C0	87.88.163.149	bot-run8beppud6hkai6bj	0	صادق 421
423	مرحبا بكم	pic.png		kw	D8D8A9A9C0	179.37.113.224	bot-qe12vrfejuig3uk16c	0	صادق 422
424	مرحبا بكم	pic.png		kw	D8D8A9A9C0	212.236.194.26	bot-bop3hjswq9otsd3nmk	0	صادق 423
425	مرحبا بكم	pic.png		kw	D8D8A9A9C0	64.66.229.29	bot-mji1z2rkmm9a7snaty	0	صادق 424
426	مرحبا بكم	pic.png		kw	D8D8A9A9C0	67.69.186.135	bot-92r76zjusor2cd1e8s	0	صادق 425
427	مرحبا بكم	pic.png		kw	D8D8A9A9C0	151.43.84.69	bot-64xn2n1w9dx8cvi4hb	0	صادق 426
428	مرحبا بكم	pic.png		kw	D8D8A9A9C0	154.27.8.122	bot-vp6nyalqgcjzw04uyj	0	صادق 427
429	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.118.145.195	bot-bgom2j3hm6wjjhzctp	0	صادق 428
430	مرحبا بكم	pic.png		kw	D8D8A9A9C0	178.180.50.32	bot-x4a337se147k0jx83l	0	صادق 429
431	مرحبا بكم	pic.png		kw	D8D8A9A9C0	110.197.204.10	bot-zgboqpwxt4z1kens4s	0	صادق 430
432	مرحبا بكم	pic.png		kw	D8D8A9A9C0	26.4.120.76	bot-5zlvy96s1yurkfstfx	0	صادق 431
433	مرحبا بكم	pic.png		kw	D8D8A9A9C0	47.39.243.95	bot-z7kil87ih8nkhj2jv7	0	صادق 432
434	مرحبا بكم	pic.png		kw	D8D8A9A9C0	41.19.199.1	bot-0yzpb3os8sn90dbrj4	0	صادق 433
435	مرحبا بكم	pic.png		kw	D8D8A9A9C0	136.176.65.83	bot-hi9zdqh2utmj7foqi5	0	صادق 434
436	مرحبا بكم	pic.png		kw	D8D8A9A9C0	143.204.67.122	bot-61rnxsk82e9newuozi	0	صادق 435
437	مرحبا بكم	pic.png		kw	D8D8A9A9C0	196.144.122.245	bot-bjv5rqakff7768s8ky	0	صادق 436
438	مرحبا بكم	pic.png		kw	D8D8A9A9C0	195.222.183.33	bot-dqgay8n3fsvgdhw4by	0	صادق 437
439	مرحبا بكم	pic.png		kw	D8D8A9A9C0	192.123.218.20	bot-liupio6z0l0r1vpjfz	0	صادق 438
440	مرحبا بكم	pic.png		kw	D8D8A9A9C0	179.82.65.164	bot-cl8fywglxfknegrn8a	0	صادق 439
441	مرحبا بكم	pic.png		kw	D8D8A9A9C0	161.37.34.208	bot-ohdzaywxf7vxppllgq	0	صادق 440
442	مرحبا بكم	pic.png		kw	D8D8A9A9C0	130.208.32.6	bot-ou8hvb5md396mgjlqq	0	صادق 441
443	مرحبا بكم	pic.png		kw	D8D8A9A9C0	72.56.67.200	bot-4j7cknrc0mjcx2gs6h	0	صادق 442
444	مرحبا بكم	pic.png		kw	D8D8A9A9C0	215.17.65.160	bot-1zdm5c17h2s065sp1z	0	صادق 443
445	مرحبا بكم	pic.png		kw	D8D8A9A9C0	21.75.130.83	bot-oopqecz66crr8aavkn	0	صادق 444
446	مرحبا بكم	pic.png		kw	D8D8A9A9C0	104.205.255.205	bot-mwlnd023bozrlm4ujw	0	صادق 445
447	مرحبا بكم	pic.png		kw	D8D8A9A9C0	121.15.165.60	bot-i72qm7qon8afidjbfy	0	صادق 446
448	مرحبا بكم	pic.png		kw	D8D8A9A9C0	24.179.117.54	bot-vn5u1k18ecggbqacgu	0	صادق 447
449	مرحبا بكم	pic.png		kw	D8D8A9A9C0	120.34.169.71	bot-zerzv5ywkrbgmt4pl9	0	صادق 448
450	مرحبا بكم	pic.png		kw	D8D8A9A9C0	112.54.152.109	bot-st0gy62d7wzebtt7cu	0	صادق 449
451	مرحبا بكم	pic.png		kw	D8D8A9A9C0	49.115.11.224	bot-4fdv077nfze0ldiuw9	0	صادق 450
452	مرحبا بكم	pic.png		kw	D8D8A9A9C0	24.255.251.78	bot-7jz9zlwvmmqk76nnab	0	صادق 451
453	مرحبا بكم	pic.png		kw	D8D8A9A9C0	182.71.179.227	bot-56izeyqi906pky4cb9	0	صادق 452
454	مرحبا بكم	pic.png		kw	D8D8A9A9C0	138.89.153.232	bot-4t0hmv1xxir6r08w93	0	صادق 453
455	مرحبا بكم	pic.png		kw	D8D8A9A9C0	171.115.178.26	bot-z6dushmdmvlyrmf1do	0	صادق 454
456	مرحبا بكم	pic.png		kw	D8D8A9A9C0	20.50.155.157	bot-sq5crla6bmetw9h26r	0	صادق 455
457	مرحبا بكم	pic.png		kw	D8D8A9A9C0	49.63.236.252	bot-iopqg7n5l4gbk3tgu7	0	صادق 456
458	مرحبا بكم	pic.png		kw	D8D8A9A9C0	157.99.148.95	bot-8yqu71dvjl6722148f	0	صادق 457
459	مرحبا بكم	pic.png		kw	D8D8A9A9C0	198.199.36.65	bot-mnjs9i9lqpvnjqn2f5	0	صادق 458
460	مرحبا بكم	pic.png		kw	D8D8A9A9C0	73.73.196.176	bot-63riy2jqzlh8kttj86	0	صادق 459
461	مرحبا بكم	pic.png		kw	D8D8A9A9C0	206.247.251.147	bot-148yfjzppimlnkuq2o	0	صادق 460
462	مرحبا بكم	pic.png		kw	D8D8A9A9C0	158.73.129.132	bot-3pds7vma6ag1p4yn2u	0	صادق 461
463	مرحبا بكم	pic.png		kw	D8D8A9A9C0	189.58.161.128	bot-5uzidhceko7fwexgis	0	صادق 462
464	مرحبا بكم	pic.png		kw	D8D8A9A9C0	94.95.249.247	bot-gz1gedbkojzixzngq7	0	صادق 463
465	مرحبا بكم	pic.png		kw	D8D8A9A9C0	104.188.115.233	bot-x71hze61pxs6j28fs1	0	صادق 464
466	مرحبا بكم	pic.png		kw	D8D8A9A9C0	223.161.167.167	bot-95wxo4zig6frb378i5	0	صادق 465
467	مرحبا بكم	pic.png		kw	D8D8A9A9C0	53.42.89.143	bot-qyocqz5p0pu4yk6s5v	0	صادق 466
468	مرحبا بكم	pic.png		kw	D8D8A9A9C0	200.43.191.26	bot-4uwqoyzmq3hupn5sgg	0	صادق 467
469	مرحبا بكم	pic.png		kw	D8D8A9A9C0	20.172.221.46	bot-1asoftb451oh855cij	0	صادق 468
470	مرحبا بكم	pic.png		kw	D8D8A9A9C0	212.148.67.102	bot-tdv2ic66q295i8c7oi	0	صادق 469
471	مرحبا بكم	pic.png		kw	D8D8A9A9C0	216.244.223.56	bot-7og9w4zuqw59jlh5kg	0	صادق 470
472	مرحبا بكم	pic.png		kw	D8D8A9A9C0	128.144.113.137	bot-m10j1apfxy254uwbmv	0	صادق 471
473	مرحبا بكم	pic.png		kw	D8D8A9A9C0	74.238.250.25	bot-kwe6rbs376iv925zfo	0	صادق 472
474	مرحبا بكم	pic.png		kw	D8D8A9A9C0	70.191.61.74	bot-svalmbi7und8nmijjc	0	صادق 473
475	مرحبا بكم	pic.png		kw	D8D8A9A9C0	37.213.203.107	bot-tz9edor3815ux83vcu	0	صادق 474
476	مرحبا بكم	pic.png		kw	D8D8A9A9C0	76.65.60.176	bot-lt48ag998w092bavo8	0	صادق 475
477	مرحبا بكم	pic.png		kw	D8D8A9A9C0	150.11.143.80	bot-01bh5pzapgof5eu7f1	0	صادق 476
478	مرحبا بكم	pic.png		kw	D8D8A9A9C0	174.202.165.56	bot-zhap8eyivdo2uslppr	0	صادق 477
479	مرحبا بكم	pic.png		kw	D8D8A9A9C0	202.236.219.230	bot-yc2b7j3gaq1u6jwjul	0	صادق 478
480	مرحبا بكم	pic.png		kw	D8D8A9A9C0	203.156.28.226	bot-7ypg2gks2xug4rtuvb	0	صادق 479
481	مرحبا بكم	pic.png		kw	D8D8A9A9C0	184.214.231.36	bot-9qwmo8pvc9jpqfpww7	0	صادق 480
482	مرحبا بكم	pic.png		kw	D8D8A9A9C0	121.112.93.72	bot-1s0o62obm13y9qq4ua	0	صادق 481
483	مرحبا بكم	pic.png		kw	D8D8A9A9C0	217.45.175.89	bot-0wdjedcn69yz9a5k5q	0	صادق 482
484	مرحبا بكم	pic.png		kw	D8D8A9A9C0	15.97.205.181	bot-8ou5n125otajk0k5t0	0	صادق 483
485	مرحبا بكم	pic.png		kw	D8D8A9A9C0	54.181.194.175	bot-w1mft63cui6tjwjl79	0	صادق 484
486	مرحبا بكم	pic.png		kw	D8D8A9A9C0	184.103.236.117	bot-meyzonezfdxnlso55r	0	صادق 485
487	مرحبا بكم	pic.png		kw	D8D8A9A9C0	21.73.104.177	bot-7dqzfg3536bfetd9wu	0	صادق 486
488	مرحبا بكم	pic.png		kw	D8D8A9A9C0	184.178.135.27	bot-7duhxuudwljp04wk25	0	صادق 487
489	مرحبا بكم	pic.png		kw	D8D8A9A9C0	101.91.186.111	bot-4md1t91fsvam5qgxb3	0	صادق 488
490	مرحبا بكم	pic.png		kw	D8D8A9A9C0	172.73.189.116	bot-uf09r0gonftiqmrtnt	0	صادق 489
491	مرحبا بكم	pic.png		kw	D8D8A9A9C0	18.58.66.149	bot-auu9fkhwcgzsgur3tj	0	صادق 490
492	مرحبا بكم	pic.png		kw	D8D8A9A9C0	60.78.27.243	bot-op3pq18fq9lqiy0nv0	0	صادق 491
493	مرحبا بكم	pic.png		kw	D8D8A9A9C0	52.44.36.150	bot-1kjq8pyui0706br8os	0	صادق 492
494	مرحبا بكم	pic.png		kw	D8D8A9A9C0	221.222.233.146	bot-z2bkoffx06iqp05m25	0	صادق 493
495	مرحبا بكم	pic.png		kw	D8D8A9A9C0	35.128.165.187	bot-hy1upmuis3tb6ahg0u	0	صادق 494
496	مرحبا بكم	pic.png		kw	D8D8A9A9C0	66.134.210.138	bot-yokzsdzmup8lazu3jh	0	صادق 495
497	مرحبا بكم	pic.png		kw	D8D8A9A9C0	30.129.74.177	bot-kr126kzq7hcx1glc3n	0	صادق 496
498	مرحبا بكم	pic.png		kw	D8D8A9A9C0	48.159.105.244	bot-hwjnb17r3lzp3aol9y	0	صادق 497
499	مرحبا بكم	pic.png		kw	D8D8A9A9C0	221.71.233.159	bot-atfhp3boi33bbbdk6n	0	صادق 498
500	مرحبا بكم	pic.png		kw	D8D8A9A9C0	85.99.118.253	bot-6w72iioqcarxh6aq16	0	صادق 499
501	مرحبا بكم	pic.png		kw	D8D8A9A9C0	159.117.73.229	bot-agmkke2l3kzdaoznra	0	صادق 500
\.


--
-- Data for Name: bsb; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bsb (id, systems, browsers) FROM stdin;
1	{"system1":false,"system2":false,"system3":false,"system4":false,"system5":false,"system6":false,"system7":true}	{"browser1":false,"browser2":false,"browser3":false,"browser4":false,"browser5":false,"browser6":false,"browser7":false,"browser8":false,"browser9":true}
\.


--
-- Data for Name: coin_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coin_ledger (id, txid, event_type, actor_uid, actor_idreg, user_uid, user_idreg, counterparty_uid, counterparty_idreg, amount, before_balance, after_balance, gift_file, note, ip, created_at) FROM stdin;
1	gift_1772404406944_026e23f5919c	gift_send	5i8j4dzvrmg6w7l3nw4rvy	3	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	-5	20	15	1772325311284.jpg	gift to #5 rid=g1772404406942_w4dji4	89.187.162.182	1772404406956
2	gift_1772404406944_026e23f5919c	gift_receive	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	5	40	45	1772325311284.jpg	gift from #3 rid=g1772404406942_w4dji4	89.187.162.182	1772404406956
3	gift_1772404408591_72b26f51ed05	gift_send	5i8j4dzvrmg6w7l3nw4rvy	3	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	-5	15	10	1772325311284.jpg	gift to #5 rid=g1772404408590_2xzqe2	89.187.162.182	1772404408594
4	gift_1772404408591_72b26f51ed05	gift_receive	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	5	45	50	1772325311284.jpg	gift from #3 rid=g1772404408590_2xzqe2	89.187.162.182	1772404408594
5	gift_1772404411735_b7a2a0d9730c	gift_send	5i8j4dzvrmg6w7l3nw4rvy	3	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	-5	10	5	1772325311284.jpg	gift to #5 rid=g1772404411734_5641yf	89.187.162.182	1772404411746
6	gift_1772404411735_b7a2a0d9730c	gift_receive	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	5	50	55	1772325311284.jpg	gift from #3 rid=g1772404411734_5641yf	89.187.162.182	1772404411746
7	gift_1772404411887_db900ab426e8	gift_send	5i8j4dzvrmg6w7l3nw4rvy	3	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	-5	5	0	1772325311284.jpg	gift to #5 rid=g1772404411886_5pxtii	89.187.162.182	1772404411890
8	gift_1772404411887_db900ab426e8	gift_receive	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	5	55	60	1772325311284.jpg	gift from #3 rid=g1772404411886_5pxtii	89.187.162.182	1772404411890
9	gift_1773957547186_5bc5afb96d6f	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	-2	60	58	1773956614581.jpg	gift to #5 rid=g1773957547182_mltr0k	89.187.162.182	1773957547233
10	gift_1773957547186_5bc5afb96d6f	gift_receive	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	2	60	62	1773956614581.jpg	gift from #5 rid=g1773957547182_mltr0k	89.187.162.182	1773957547233
11	gift_1776378647095_432d18ca9fdc	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	-5	62	57	1772325311284.jpg	gift to #5 qty=1 rid=g1776378647087_rr2p7t	::1	1776378647098
12	gift_1776378647095_432d18ca9fdc	gift_receive	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	3	62	65	1772325311284.jpg	gift from #5 qty=1 recv=3 fee=2 rid=g1776378647087_rr2p7t	::1	1776378647098
13	gift_1776451524750_168da96a4339	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	-1	65	64	1776445025983.jpg	gift to #3 qty=1 rid=g1776451524732_45uht9	::1	1776451524755
14	gift_1776451524750_168da96a4339	gift_receive	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	1	0	1	1776445025983.jpg	gift from #5 qty=1 recv=1 fee=0 rid=g1776451524732_45uht9	::1	1776451524755
15	gift_1776451821524_58a71232c03e	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	-1	64	63	1776445025983.jpg	gift to #3 qty=1 rid=g1776451821506_hp9812	::1	1776451821530
16	gift_1776451821524_58a71232c03e	gift_receive	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	1	1	2	1776445025983.jpg	gift from #5 qty=1 recv=1 fee=0 rid=g1776451821506_hp9812	::1	1776451821530
17	gift_1776452122893_49fe8c7c9c52	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	-1	63	62	1776445025983.jpg	gift to #3 qty=1 rid=g1776452122878_bijuug	::1	1776452122895
18	gift_1776452122893_49fe8c7c9c52	gift_receive	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	1	2	3	1776445025983.jpg	gift from #5 qty=1 recv=1 fee=0 rid=g1776452122878_bijuug	::1	1776452122895
19	gift_1776452235362_8a4467afaf7b	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	-1	62	61	1776445025983.jpg	gift to #3 qty=1 rid=g1776452235356_qmnumh	::1	1776452235375
20	gift_1776452235362_8a4467afaf7b	gift_receive	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	1	3	4	1776445025983.jpg	gift from #5 qty=1 recv=1 fee=0 rid=g1776452235356_qmnumh	::1	1776452235375
21	gift_1776452254033_c5d6d2232997	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	-1	61	60	1776445025983.jpg	gift to #3 qty=1 rid=g1776452254030_yiqrmf	::1	1776452254036
22	gift_1776452254033_c5d6d2232997	gift_receive	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	1	4	5	1776445025983.jpg	gift from #5 qty=1 recv=1 fee=0 rid=g1776452254030_yiqrmf	::1	1776452254036
23	gift_1776452298966_233d017dc176	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	-1	60	59	1776445025983.jpg	gift to #3 qty=1 rid=g1776452298962_3v9xrq	::1	1776452298968
24	gift_1776452298966_233d017dc176	gift_receive	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	1	5	6	1776445025983.jpg	gift from #5 qty=1 recv=1 fee=0 rid=g1776452298962_3v9xrq	::1	1776452298968
25	gift_1776452316714_0148df25e9db	gift_send	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	-1	59	58	1776445025983.jpg	gift to #3 qty=1 rid=g1776452316713_3nuv4m	::1	1776452316720
26	gift_1776452316714_0148df25e9db	gift_receive	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	1	6	7	1776445025983.jpg	gift from #5 qty=1 recv=1 fee=0 rid=g1776452316713_3nuv4m	::1	1776452316720
30	agent_topup_1794619374597_30e213199dd6	topup_order_receive		0	af9114346116b469bcd1deb3	22		0	100	0	100		topup order TP1794619303384B93406 via agent #2		1794619374614
31	gift_1794619587959_f8ztuc	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	100	99	1776445025983.jpg		127.0.0.1	1794619587959
32	gift_1794619587959_f8ztuc	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	0	1	1776445025983.jpg		127.0.0.1	1794619587959
33	gift_1794619595697_ss84na	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	99	98	1776445025983.jpg		127.0.0.1	1794619595697
34	gift_1794619595697_ss84na	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	1	2	1776445025983.jpg		127.0.0.1	1794619595697
35	gift_1794619608189_0euh14	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	98	97	1776445025983.jpg		127.0.0.1	1794619608189
36	gift_1794619608189_0euh14	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	2	3	1776445025983.jpg		127.0.0.1	1794619608189
37	gift_1794619628944_j6ph5y	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	97	96	1776445025983.jpg		127.0.0.1	1794619628944
38	gift_1794619628944_j6ph5y	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	3	4	1776445025983.jpg		127.0.0.1	1794619628944
39	gift_1794619658972_221nwx	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	96	95	1776445025983.jpg		127.0.0.1	1794619658972
40	gift_1794619658972_221nwx	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	4	5	1776445025983.jpg		127.0.0.1	1794619658972
41	gift_1794619688413_08xuqy	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	95	94	1776445025983.jpg		127.0.0.1	1794619688413
42	gift_1794619688413_08xuqy	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	5	6	1776445025983.jpg		127.0.0.1	1794619688413
43	gift_1794619761426_ayuzka	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	94	93	1776445025983.jpg		127.0.0.1	1794619761426
44	gift_1794619761426_ayuzka	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	6	7	1776445025983.jpg		127.0.0.1	1794619761426
45	topup_1794620122027_93e88f76f5c5	topup_order_receive		0	af9114346116b469bcd1deb3	22		0	100000	93	100093		topup order TP17946200902571A1AE6 via agent #2	127.0.0.1	1794620122040
46	gift_1794620160319_ez9h6j	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1000	100093	99093	1776444994729.jpg		127.0.0.1	1794620160319
47	gift_1794620160319_ez9h6j	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	600	7	607	1776444994729.jpg		127.0.0.1	1794620160319
48	gift_1794620226043_aaqeuh	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1300	99093	97793	1776441783301.jpg		127.0.0.1	1794620226043
49	gift_1794620226043_aaqeuh	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	780	607	1387	1776441783301.jpg		127.0.0.1	1794620226043
50	gift_1794620251962_8u8hjt	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1000	97793	96793	1776445012406.jpg		127.0.0.1	1794620251962
51	gift_1794620251962_8u8hjt	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	600	1387	1987	1776445012406.jpg		127.0.0.1	1794620251962
52	gift_1794620287500_xpsu1v	gift_send	af9114346116b469bcd1deb3	22	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	-1	96793	96792	1776445025983.jpg		127.0.0.1	1794620287500
53	gift_1794620287500_xpsu1v	gift_receive	af9114346116b469bcd1deb3	22	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	1	1987	1988	1776445025983.jpg		127.0.0.1	1794620287500
54	gift_1794685135916_2ualwj	gift_send	1db82554e5a9437d67da6e	8	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	-1	1988	1987	1776445025983.jpg		127.0.0.1	1794685135916
55	gift_1794685135916_2ualwj	gift_receive	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	1	0	1	1776445025983.jpg		127.0.0.1	1794685135916
56	gift_1794685476479_rvr23w	gift_send	1db82554e5a9437d67da6e	8	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	-1	1987	1986	1776445025983.jpg		127.0.0.1	1794685476479
57	gift_1794685476479_rvr23w	gift_receive	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	1	1	2	1776445025983.jpg		127.0.0.1	1794685476479
58	gift_1794687601222_57zbxt	gift_send	1db82554e5a9437d67da6e	8	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	-1	1986	1985	1776445025983.jpg		127.0.0.1	1794687601222
59	gift_1794687601222_57zbxt	gift_receive	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	1	2	3	1776445025983.jpg		127.0.0.1	1794687601222
60	gift_1794687614624_xti6qp	gift_send	1db82554e5a9437d67da6e	8	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	-1	1985	1984	1776445025983.jpg		127.0.0.1	1794687614624
61	gift_1794687614624_xti6qp	gift_receive	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	1	3	4	1776445025983.jpg		127.0.0.1	1794687614624
62	gift_1794687658399_utwqqy	gift_send	1db82554e5a9437d67da6e	8	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	-1	1984	1983	1776445025983.jpg		127.0.0.1	1794687658399
63	gift_1794687658399_utwqqy	gift_receive	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	1	4	5	1776445025983.jpg		127.0.0.1	1794687658399
64	gift_1794687669419_0r6zrl	gift_send	1db82554e5a9437d67da6e	8	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	-1	1983	1982	1776445025983.jpg		127.0.0.1	1794687669419
65	gift_1794687669419_0r6zrl	gift_receive	1db82554e5a9437d67da6e	8	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	1	5	6	1776445025983.jpg		127.0.0.1	1794687669419
\.


--
-- Data for Name: coin_packages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coin_packages (id, title, coins_amount, price_local, currency, country_code, city, is_active, sort_order, notes, created_at, updated_at) FROM stdin;
2	باقة البدايه	100	10.0000	USD	SA		t	0		1794591787765	1794591787765
3	باقه عرض	100000	20.0000	SAR	SA		t	0		1794619963734	1794619963734
\.


--
-- Data for Name: cuts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cuts (id, text1, text2) FROM stdin;
1	س1	السلام عليكم ورحمة الله وبركاتة 
2	ك1	كيف الحال
\.


--
-- Data for Name: followers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.followers (id, follower_id, following_id, created_at) FROM stdin;
1	pj1l22e51ih51bilghkyp0	lHG9suO5PZ9pEswkAAAR	1777061386486
10	4yw6hre4qx9xj6hnwdrsz8	pj1l22e51ih51bilghkyp0	1777691941085
13	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	1794440306890
15	tamxbgxn7ds9shhxgzz665	1e28ae10-4bf0-4413-9388-16d10428abf1	1794518789185
16	1db82554e5a9437d67da6e	612f23b9956c63ef868ebc61	1794522936170
18	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	1794522945244
20	1db82554e5a9437d67da6e	5i8j4dzvrmg6w7l3nw4rvy	1794592261356
24	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	1794687871387
\.


--
-- Data for Name: gift_notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.gift_notifications (id, txid, to_uid, to_idreg, from_uid, from_idreg, from_topic, gift_file, coin, note, is_read, created_at, read_at) FROM stdin;
1	gift_1772404406944_026e23f5919c	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	admin	1772325311284.jpg	5		t	1772404406956	1772404643444
2	gift_1772404408591_72b26f51ed05	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	admin	1772325311284.jpg	5		t	1772404408594	1772404643444
3	gift_1772404411735_b7a2a0d9730c	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	admin	1772325311284.jpg	5		t	1772404411746	1772404643444
4	gift_1772404411887_db900ab426e8	pj1l22e51ih51bilghkyp0	5	5i8j4dzvrmg6w7l3nw4rvy	3	admin	1772325311284.jpg	5		t	1772404411890	1772404643444
5	gift_1773957547186_5bc5afb96d6f	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	medo	1773956614581.jpg	2		t	1773957547233	1775168936241
6	gift_1776378647095_432d18ca9fdc	pj1l22e51ih51bilghkyp0	5	pj1l22e51ih51bilghkyp0	5	medo	1772325311284.jpg	3		t	1776378647098	1776379001512
7	gift_1776451524750_168da96a4339	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	medo	1776445025983.jpg	1		t	1776451524755	1776451668650
8	gift_1776451821524_58a71232c03e	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	medo	1776445025983.jpg	1		t	1776451821530	1776452003578
9	gift_1776452122893_49fe8c7c9c52	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	medo	1776445025983.jpg	1		t	1776452122895	1776452217143
10	gift_1776452235362_8a4467afaf7b	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	medo	1776445025983.jpg	1		t	1776452235375	1776462802590
11	gift_1776452254033_c5d6d2232997	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	medo	1776445025983.jpg	1		t	1776452254036	1776462802590
12	gift_1776452298966_233d017dc176	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	medo	1776445025983.jpg	1		t	1776452298968	1776462802590
13	gift_1776452316714_0148df25e9db	5i8j4dzvrmg6w7l3nw4rvy	3	pj1l22e51ih51bilghkyp0	5	medo	1776445025983.jpg	1		t	1776452316720	1776462802590
15	gift_1794619587959_f8ztuc	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794619587959	1794619587959
16	gift_1794619595697_ss84na	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794619595697	1794619595697
17	gift_1794619608189_0euh14	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794619608189	1794619608189
18	gift_1794619628944_j6ph5y	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794619628944	1794619628944
19	gift_1794619658972_221nwx	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794619658972	1794619658972
20	gift_1794619688413_08xuqy	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794619688413	1794619688413
21	gift_1794619761426_ayuzka	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794619761426	1794619761426
22	gift_1794620160319_ez9h6j	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776444994729.jpg	600		t	1794620160319	1794620160319
23	gift_1794620226043_aaqeuh	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776441783301.jpg	780		t	1794620226043	1794620226043
24	gift_1794620251962_8u8hjt	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445012406.jpg	600		t	1794620251962	1794620251962
25	gift_1794620287500_xpsu1v	1db82554e5a9437d67da6e	8	af9114346116b469bcd1deb3	22	علي	1776445025983.jpg	1		t	1794620287500	1794620287500
26	gift_1794685135916_2ualwj	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	مازن	1776445025983.jpg	1		t	1794685135916	1794685135916
27	gift_1794685476479_rvr23w	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	مازن	1776445025983.jpg	1		t	1794685476479	1794685476479
28	gift_1794687601222_57zbxt	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	مازن	1776445025983.jpg	1		t	1794687601222	1794687601222
29	gift_1794687614624_xti6qp	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	مازن	1776445025983.jpg	1		t	1794687614624	1794687614624
30	gift_1794687658399_utwqqy	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	مازن	1776445025983.jpg	1		t	1794687658399	1794687658399
31	gift_1794687669419_0r6zrl	tamxbgxn7ds9shhxgzz665	2	1db82554e5a9437d67da6e	8	مازن	1776445025983.jpg	1		t	1794687669419	1794687669419
\.


--
-- Data for Name: histletter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.histletter (id, ip, msg, topic, v, "time", target, source, path) FROM stdin;
3	89.187.162.182	صورة 	admin	صورة	\N	\N	\N	\N
4	89.187.162.182	صورة 	admin	صورة	\N	\N	\N	\N
5	89.187.162.182	صورة 	admin	صورة	\N	\N	\N	\N
6	89.187.162.182	صورة 	admin	صورة	\N	\N	\N	\N
7	89.187.162.182	صورة 	admin	صورة	\N	\N	\N	\N
8	127.0.0.1	صورة	مازن	صورة	1794441833581	الغرفة العامة	room:D8D8A9A9C0	bmsgs
\.


--
-- Data for Name: hosts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hosts (id, hostname, setting) FROM stdin;
1	localhost	1
\.


--
-- Data for Name: internal_mail; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.internal_mail (id, from_uid, from_username, from_topic, from_pic, to_uid, to_username, to_topic, to_pic, body, is_read, created_at, read_at) FROM stdin;
1	pj1l22e51ih51bilghkyp0	medo	medo	/pic/1773376784089.jpg	ox462ainhew5o88e83elq5	medo2	medo2	/pic/1776894770113.jpg	كيف حالك	f	1777831421592	0
3	1db82554e5a9437d67da6e	مازن	مازن	pic.png	pj1l22e51ih51bilghkyp0	medo	medo	/pic/1773376784089.jpg	k jkljl	f	1794439454628	0
4	1db82554e5a9437d67da6e	مازن	مازن	pic.png	tamxbgxn7ds9shhxgzz665	safari2023	seohost	pic.png	sghl	t	1794440216691	1794440224957
5	tamxbgxn7ds9shhxgzz665	safari2023	seohost	pic.png	1db82554e5a9437d67da6e	مازن	مازن	pic.png	pdh;	t	1794440231152	1794440238444
6	1db82554e5a9437d67da6e	مازن	مازن	/pic/1794440403648_6c221e.jpg	tamxbgxn7ds9shhxgzz665	safari2023	seohost	/pic/1794512127060_378568.jpg	تسلم	t	1794519315944	1794520730607
7	1db82554e5a9437d67da6e	مازن	مازن	/pic/1794440403648_6c221e.jpg	612f23b9956c63ef868ebc61	زهره	زهره	pic.png	كيفك	f	1794523408651	0
8	1db82554e5a9437d67da6e	مازن	مازن	/pic/1794440403648_6c221e.jpg	tamxbgxn7ds9shhxgzz665	safari2023	seohostseohost	/pic/1794512127060_378568.jpg	سلام	t	1794687125785	1794691729123
\.


--
-- Data for Name: intromsg; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.intromsg (id, category, adresse, msg) FROM stdin;
1	w	مرحباً بكم 	مرحباً بكم في شات توك مي
2	d	براءه ذمه	انتبه الى ماتقول
\.


--
-- Data for Name: logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.logs (id, state, topic, username, ip, code, device, isin, "time") FROM stdin;
33	عضو	safari2023	seohost	::1		Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	*	1794415708470
34	زائر	زائر_اختبار_آلي	زائر_اختبار_آلي	127.0.0.1	SA	Win32	web	1794416963500
35	زائر	ميدو	ميدو	127.0.0.1	SA	Win32	web	1794422529141
36	عضو	مازن	مازن	127.0.0.1	SA	Win32	web	1794422626893
37	زائر	نمتنمت	نمتنمت	127.0.0.1	SA	Win32	web	1794422999422
38	زائر	نمنم	نمنم	127.0.0.1	SA	Win32	web	1794423194967
39	عضو	مازن	مازن	127.0.0.1	SA	Win32	web	1794425137077
40	زائر	نيمار	نيمار	127.0.0.1	SA	Win32	web	1794425301141
41	عضو	نيمار	نيمار	127.0.0.1	SA	Win32	web	1794425338223
42	عضو	نيمار	نيمار	127.0.0.1	SA	Win32	web	1794427734177
43	عضو	مازن	مازن	127.0.0.1	SA	Win32	web	1794427734669
44	زائر	aaa	aaa	127.0.0.1	SA	Win32	web	1794427963416
45	عضو	مازن	مازن	127.0.0.1	SA	Win32	web	1794428056593
46	عضو	safari2023	seohost	127.0.0.1	SA	Win32	web	1794428699938
47	زائر	ةةةةة	ةةةةة	127.0.0.1	SA	Win32	web	1794429717799
48	زائر	هلوز	هلوز	127.0.0.1	SA	Win32	web	1794429894049
49	زائر	هلوز	هلوز	127.0.0.1	SA	Win32	web	1794431099439
50	دخول	خلزظ	خلزظ	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432313421
51	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794432331202
52	دخول	777856160	777856160	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432404275
53	دخول	سشسش	سشسش	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432434467
54	دخول	زائر_اختبار_آلي	زائر_اختبار_آلي	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432590720
55	دخول	زائر_اختبار_فحص	زائر_اختبار_فحص	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432643271
56	دخول	شس	شس	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432734247
57	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794432817417
58	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794432835372
59	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794432855095
60	دخول	زائر_اختبار_آلي	زائر_اختبار_آلي	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432856236
61	دخول	سشسش	سشسش	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794432903328
62	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794433280503
63	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794433984093
64	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794434007518
65	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794434088906
73	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794437550433
74	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794437734834
75	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794437824632
76	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794437967737
77	دخول	فارس التجربة	فارس التجربة	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794438657251
78	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794439588231
79	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794440016955
80	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794441429347
81	دخول	مازن	مازن	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794442692372
82	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794442974636
83	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794501263260
84	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794501588123
85	دخول	مستخدم_اول	مستخدم_اول	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794502640893
86	دخول	مستخدم_ثاني	مستخدم_ثاني	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794502660946
90	دخول	اختبار الاستيج	qa_stage_bot	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794506011986
91	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794506292599
92	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794507091235
93	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794507458509
94	دخول	ؤظميس	ؤظميس	127.0.0.1	--	android.2.0.0.modern.chrome.SA	زائر	1794507684071
95	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794507712993
96	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794508691581
98	تسجيل|عضوية	مختبر_الصوت	qa_voice_owner_1794508901557	127.0.0.1	--	web-v2	*	1794508901794
99	دخول عضو	مختبر_الصوت	qa_voice_owner_1794508901557	127.0.0.1	--	web-v2	cp	1794508902013
100	دخول	اختبار_مايك_مرسل	اختبار_مايك_مرسل	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794508902153
101	دخول	اختبار_مايك_مستمع	اختبار_مايك_مستمع	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	زائر	1794508902161
102	تسجيل|عضوية	مختبر_مرسل	qa_spk_1794508983807	127.0.0.1	--	web-v2	*	1794508984255
103	تسجيل|عضوية	مختبر_مستمع	qa_lst_1794508983807	127.0.0.1	--	web-v2	*	1794508984434
104	دخول عضو	مختبر_مرسل	qa_spk_1794508983807	127.0.0.1	--	web-v2	cp	1794508984601
105	دخول	مختبر_مستمع	qa_lst_1794508983807	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794508984864
106	دخول	مختبر_مرسل	qa_spk_1794508983807	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794508985111
107	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794509126975
108	تسجيل|عضوية	مختبر الصوت	qa_e2e_voice	127.0.0.1	--	qa-e2e-fp	*	1794509213260
109	دخول	مختبر الصوت	qa_e2e_voice	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794509771593
110	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794509925151
111	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794511003410
112	تسجيل	أمير القصص	storytester	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794520286622
113	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794521677027
114	تسجيل	زهره	زهره	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794522409590
115	دخول	زهره	زهره	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794523446438
116	دخول	أمير القصص	storytester	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794526520301
117	دخول	مازن	مازن	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794526601600
118	دخول	زهرة	زهرة	127.0.0.1	--	android.2.0.0.modern.chrome.SA	زائر	1794526670646
119	دخول	زهره	زهره	127.0.0.1	--	android.2.0.0.modern.chrome.SA	عضو	1794526810501
120	دخول	seohost	safari2023	127.0.0.1	--	windows.2.0.0.modern.chrome.SA	عضو	1794588736785
121	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794595205233
122	دخول	فاحص_الأعلام	فاحص_الأعلام	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	زائر	1794595784076
123	تسجيل	علي	علي	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794603250211
124	دخول	زهرة الشوق	زهرة الشوق	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	زائر	1794613517786
125	دخول	زهره	زهره	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	زائر	1794615094583
126	دخول	زهره	زهره	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794615246584
127	دخول	زهره	زهره	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794615288957
128	دخول	علي	علي	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794616774349
97	محاوله تخمين رقم سري	chatmaster11	chatmaster11	127.0.0.1	--	sec-test	cp	1794682094977
129	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794682112177
130	تسجيل|عضوية	sectest0d17e5	sectest0d17e5	127.0.0.1	--	sec-test	*	1794682126415
131	تسجيل|عضوية	sectestb048fb	sectestb048fb	127.0.0.1	--	sec-test	*	1794682137909
132	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794682149471
133	تسجيل|عضوية	sectest21c63b	sectest21c63b	127.0.0.1	--	sec-test	*	1794682170748
134	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794682453991
135	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794683220386
136	دخول	فهد_التجربة	فهد_التجربة	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	زائر	1794683494590
137	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794684708065
138	دخول	مازن	مازن	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794684986852
139	دخول	مازن	مازن	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794686766733
140	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794692518095
141	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794692900303
142	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794692972859
143	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794693547182
144	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794693633137
145	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794693835942
146	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794693865084
147	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794694280060
148	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794694625721
149	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794695225796
150	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794695803754
151	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794696409155
152	دخول	مازن	مازن	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794696526471
153	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794697260706
154	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794697303038
155	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794697391900
156	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794697431984
157	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794698026884
158	دخول	مازن	مازن	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794698765668
159	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794698904479
160	دخول	مازن	مازن	127.0.0.1	YE	android.2.0.0.modern.chrome.SA	عضو	1794698914527
161	دخول	مازن	مازن	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794699915960
162	دخول	سامر	سامر	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	زائر	1794699974711
163	محظور	سامر	سامر	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	زائر	1794700319349
164	محظور	مازن	مازن	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794700328934
165	محظور	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794700365159
166	دخول عضو	seohostseohost	safari2023	127.0.0.1	--	web-v2	cp	1794700381145
167	دخول	سامر	سامر	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	زائر	1794700408995
168	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794769105989
169	دخول	مازن	مازن	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794769759490
170	دخول	safari2023	safari2023	127.0.0.1	YE	ios.2.0.0.modern.safari.SA	زائر	1794771009333
171	دخول	seohostseohost	safari2023	127.0.0.1	YE	windows.2.0.0.modern.chrome.SA	عضو	1794777006602
\.


--
-- Data for Name: names; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.names (id, iduser, fp, ip, topic, username) FROM stdin;
22	3	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	89.187.162.182	admin	chatmaster11
23	5	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	89.187.162.182	medo	medo
24	3	Android.13.ot6.esb.agd.Chrome.yl3.4yc.wvn	89.187.162.182	admin	chatmaster11
25	341	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	89.187.162.182	ffff	ffff
26	452	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	89.187.162.182	ffff2	ffff2
27	454	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	89.187.162.182	ffff22	ffff22
28	647	Android.13.ot6.esb.agd.Chrome.yl3.4yc.wvn	89.187.162.182	ffff2	ffff2
29	3	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	::1	admin	chatmaster11
30	5	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	::1	medo	medo
31	5	Windows.10.t7a.gvg.por.Chrome.e4r.pf2.l4x	::1	medo	medo
32	5	Android.13.t7a.gvg.por.Chrome.e4r.pf2.l4x	::1	medo	medo
33	3	Windows.10.t7a.gvg.por.Chrome.e4r.pf2.l4x	::1	admin	chatmaster11
34	3	Android.13.t7a.gvg.por.Chrome.e4r.pf2.l4x	::1	admin	chatmaster11
35	3	Android.8.0.0.t7a.gvg.por.Chrome.e4r.pf2.l4x	::1	admin	chatmaster11
36	5	Windows.10.ica.5ww.um8.Chrome.9d2.qak.fqz	::1	medo	medo
37	5	Windows.10.yr8.ama.aby.Chrome.3cm.l1e.den	::1	medo	medo
38	5	Windows.10.otr.i4u.xfu.Chrome.cmq.xqh.gd8	::1	medo	medo
39	5	Windows.10.4u0.iyp.ptr.Chrome.wl2.5j6.51p	::1	medo	medo
40	6	Windows.10.4u0.iyp.ptr.Chrome.wl2.5j6.51p	::1	medo2	medo2
41	6	Android.8.0.0.4u0.iyp.ptr.Chrome.wl2.5j6.51p	::1	medo2	medo2
42	5	Android.8.0.0.4u0.iyp.ptr.Chrome.wl2.5j6.51p	::1	medo	medo
43	5	Windows.10.qvc.nzs.swu.Chrome.eyv.0y1.em3	::1	medo	medo
44	862	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	::1	ffff2	ffff2
45	644	Windows.10.r9g.wbl.mrh.Chrome.6ht.gnp.9rv	::1	SD	SD
46	787	Windows.10.xyl.3yo.t3s.Chrome.0qp.qkl.8fq	::1	Guest123	Guest123
47	5	Windows.10.xyl.3yo.t3s.Chrome.0qp.qkl.8fq	::1	medo	medo
48	872	Windows.10.xyl.3yo.t3s.Chrome.0qp.qkl.8fq	::1	Gues2t123	Gues2t123
49	438	Android.6.0.xyl.3yo.t3s.Chrome.0qp.qkl.8fq	::1	Gues2t123	Gues2t123
50	5	Android.8.0.0.ot6.esb.agd.Chrome.yl3.4yc.wvn	::1	medo	medo
51	7	Windows.10.ehs.sxr.uhu.Chrome.izu.1nj.92e	::1	صالح	صالح
52	7	Android.8.0.0.ehs.sxr.uhu.Chrome.izu.1nj.92e	::1	صالح	صالح
53	2	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	::1	seohost	safari2023
54		windows.2.0.0.modern.chrome.SA	127.0.0.1	خلزظ	خلزظ
55	1db82554e5a9437d67da6e	Win32	127.0.0.1	مازن	مازن
56		windows.2.0.0.modern.chrome.SA	127.0.0.1	777856160	777856160
57		windows.2.0.0.modern.chrome.SA	127.0.0.1	سشسش	سشسش
58		windows.2.0.0.modern.chrome.SA	127.0.0.1	زائر_اختبار_آلي	زائر_اختبار_آلي
59		windows.2.0.0.modern.chrome.SA	127.0.0.1	زائر_اختبار_فحص	زائر_اختبار_فحص
60		windows.2.0.0.modern.chrome.SA	127.0.0.1	شس	شس
61	1db82554e5a9437d67da6e	Win32	127.0.0.1	مازن	مازن
62	1db82554e5a9437d67da6e	Win32	127.0.0.1	مازن	مازن
63	1db82554e5a9437d67da6e	Win32	127.0.0.1	مازن	مازن
64		windows.2.0.0.modern.chrome.SA	127.0.0.1	زائر_اختبار_آلي	زائر_اختبار_آلي
65		windows.2.0.0.modern.chrome.SA	127.0.0.1	سشسش	سشسش
66	1db82554e5a9437d67da6e	Win32	127.0.0.1	مازن	مازن
67	tamxbgxn7ds9shhxgzz665	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	127.0.0.1	seohost	safari2023
68	1db82554e5a9437d67da6e	Win32	127.0.0.1	مازن	مازن
69	1db82554e5a9437d67da6e	Win32	127.0.0.1	مازن	مازن
74	1db82554e5a9437d67da6e	e6f918f32b93487682f287ed4bc985da	127.0.0.1	مازن	مازن
75	1db82554e5a9437d67da6e	e6f918f32b93487682f287ed4bc985da	127.0.0.1	مازن	مازن
76	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohost	safari2023
77	1db82554e5a9437d67da6e	e6f918f32b93487682f287ed4bc985da	127.0.0.1	مازن	مازن
78		e522fd3d14bb4692959e5fca24f4b349	127.0.0.1	فارس التجربة	فارس التجربة
79	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohost	safari2023
80	1db82554e5a9437d67da6e	97e31aea4a80497db71de91482817c95	127.0.0.1	مازن	مازن
81	1db82554e5a9437d67da6e	97e31aea4a80497db71de91482817c95	127.0.0.1	مازن	مازن
82	1db82554e5a9437d67da6e	97e31aea4a80497db71de91482817c95	127.0.0.1	مازن	مازن
83	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohost	safari2023
84	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohost	safari2023
85	1db82554e5a9437d67da6e	fp_mwdrwuov_jyezt1wfru	127.0.0.1	مازن	مازن
86		58b7e411d06d454987291cff11887902	127.0.0.1	مستخدم_اول	مستخدم_اول
87		719d532bf376435891849795805a8b84	127.0.0.1	مستخدم_ثاني	مستخدم_ثاني
88	858cf050854687cd4697e666	58b7e411d06d454987291cff11887902	127.0.0.1	qa_sanaa_1	qa_sanaa_1
89	b36afd63c0f2444554741ec7	719d532bf376435891849795805a8b84	127.0.0.1	qa_sanaa_2	qa_sanaa_2
90	1df05ea402cb47ffaf759734	58b7e411d06d454987291cff11887902	127.0.0.1	qa_sanaa_1	qa_sanaa_1
91	1e28ae10-4bf0-4413-9388-16d10428abf1	58b7e411d06d454987291cff11887902	127.0.0.1	اختبار الاستيج	qa_stage_bot
92	1db82554e5a9437d67da6e	fp_mwdrwuov_jyezt1wfru	127.0.0.1	مازن	مازن
93	tamxbgxn7ds9shhxgzz665	97e31aea4a80497db71de91482817c95	127.0.0.1	seohost	safari2023
94	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohost	safari2023
95		fp_mwdrwuov_jyezt1wfru	127.0.0.1	ؤظميس	ؤظميس
96	1db82554e5a9437d67da6e	fp_mwdrwuov_jyezt1wfru	127.0.0.1	مازن	مازن
97	1db82554e5a9437d67da6e	fp_mwdrwuov_jyezt1wfru	127.0.0.1	مازن	مازن
98	16	web-v2	127.0.0.1	مختبر_الصوت	qa_voice_owner_1794508901557
99		fp_windows	127.0.0.1	اختبار_مايك_مرسل	اختبار_مايك_مرسل
100		fp_windows	127.0.0.1	اختبار_مايك_مستمع	اختبار_مايك_مستمع
101	17	web-v2	127.0.0.1	مختبر_مرسل	qa_spk_1794508983807
102	b0228e946a337dbd06e0ae	fp_windows	127.0.0.1	مختبر_مستمع	qa_lst_1794508983807
103	db89e32c11d184f8ad801e	fp_windows	127.0.0.1	مختبر_مرسل	qa_spk_1794508983807
104	1db82554e5a9437d67da6e	fp_mwdweftk_s9dp0kvwhl	127.0.0.1	مازن	مازن
105	61630118e5fab56cd39ea5	58b7e411d06d454987291cff11887902	127.0.0.1	مختبر الصوت	qa_e2e_voice
106	1db82554e5a9437d67da6e	fp_mwdweftk_s9dp0kvwhl	127.0.0.1	مازن	مازن
107	1db82554e5a9437d67da6e	0db46f33614143a68f5eaa7e0e1054bf	127.0.0.1	مازن	مازن
108	1db82554e5a9437d67da6e	fp_mwdrwuov_jyezt1wfru	127.0.0.1	مازن	مازن
109	612f23b9956c63ef868ebc61	fp_mwe4b5eu_h9yverc1gx	127.0.0.1	زهره	زهره
110	1fed12b52786838144d1533f	735bf07caf904c96a641dcde10db9cd2	127.0.0.1	أمير القصص	storytester
111	1db82554e5a9437d67da6e	37345bd6f5be4ec1a91225f92b4358d3	127.0.0.1	مازن	مازن
112		298f979c63944e029ad50c05f36651bc	127.0.0.1	زهرة	زهرة
113	612f23b9956c63ef868ebc61	298f979c63944e029ad50c05f36651bc	127.0.0.1	زهره	زهره
114	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohost	safari2023
115	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
116		58b7e411d06d454987291cff11887902	127.0.0.1	فاحص_الأعلام	فاحص_الأعلام
117		fp_mwe4b5eu_h9yverc1gx	127.0.0.1	زهرة الشوق	زهرة الشوق
118		fp_mwe4b5eu_h9yverc1gx	127.0.0.1	زهره	زهره
119	612f23b9956c63ef868ebc61	fp_mwe4b5eu_h9yverc1gx	127.0.0.1	زهره	زهره
120	612f23b9956c63ef868ebc61	298f979c63944e029ad50c05f36651bc	127.0.0.1	زهره	زهره
121	af9114346116b469bcd1deb3	6e139e2f0a554fd492ba2f8de28d5235	127.0.0.1	علي	علي
122	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
123	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
124	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
125	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
126		58b7e411d06d454987291cff11887902	127.0.0.1	فهد_التجربة	فهد_التجربة
127	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
128	1db82554e5a9437d67da6e	37345bd6f5be4ec1a91225f92b4358d3	127.0.0.1	مازن	مازن
129	1db82554e5a9437d67da6e	37345bd6f5be4ec1a91225f92b4358d3	127.0.0.1	مازن	مازن
130	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
131	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
132	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
133	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
134	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
135	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
136	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
137	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
138	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
139	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
140	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
141	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
142	1db82554e5a9437d67da6e	37345bd6f5be4ec1a91225f92b4358d3	127.0.0.1	مازن	مازن
143	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
144	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
145	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
146	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
147	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
148	1db82554e5a9437d67da6e	37345bd6f5be4ec1a91225f92b4358d3	127.0.0.1	مازن	مازن
149	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
150	1db82554e5a9437d67da6e	37345bd6f5be4ec1a91225f92b4358d3	127.0.0.1	مازن	مازن
151	1db82554e5a9437d67da6e	9904e4d66ec744bba66eae78a039424a	127.0.0.1	مازن	مازن
152		9904e4d66ec744bba66eae78a039424a	127.0.0.1	سامر	سامر
153	2	web-v2	127.0.0.1	seohostseohost	safari2023
154		9904e4d66ec744bba66eae78a039424a	127.0.0.1	سامر	سامر
155	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
156	1db82554e5a9437d67da6e	24f7999a7dd1496d8e4b8a70e36cdbb3	127.0.0.1	مازن	مازن
157		e6f918f32b93487682f287ed4bc985da	127.0.0.1	safari2023	safari2023
158	tamxbgxn7ds9shhxgzz665	e6f918f32b93487682f287ed4bc985da	127.0.0.1	seohostseohost	safari2023
\.


--
-- Data for Name: note_comment_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.note_comment_likes (id, comment_cid, user_uid, created_at) FROM stdin;
1	nc_nYmAAzsCxBO3	tamxbgxn7ds9shhxgzz665	1794695336543
2	nc_clV36wO8pjPr	tamxbgxn7ds9shhxgzz665	1794695368303
3	nc_Sk471DtnIAq6	tamxbgxn7ds9shhxgzz665	1794695640247
4	nc_jJ0PeNpP07DX	tamxbgxn7ds9shhxgzz665	1794699484867
\.


--
-- Data for Name: note_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.note_comments (id, cid, note_nid, author_uid, author_topic, author_pic, author_ucol, author_verified, body, likes_count, created_at, parent_cid, reply_to_topic) FROM stdin;
4	nc_d2zhlODz5WAC	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#ffffff	t	🔥	0	1794695563543		
5	nc_dHTORRIs1hc0	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#ffffff	t	👏	0	1794695568278		
6	nc_nE6pV73t9VGy	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#ffffff	t	سيب	0	1794695573695	nc_d2zhlODz5WAC	seohostseohost
7	nc_PKLPRCB5Gx4N	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#ffffff	t	سيب	0	1794695576263		
1	nc_Sk471DtnIAq6	note_4tRepmhLXVom	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	قوة	1	1794685404101		
8	nc_jJ0PeNpP07DX	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#ffffff	t	😍	1	1794699481262		
9	nc_cGqP79iPrv6D	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#ffffff	t	👏😢😍😮😂	0	1794699490334	nc_jJ0PeNpP07DX	seohostseohost
\.


--
-- Data for Name: note_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.note_likes (id, note_nid, user_uid, topic, photo, created_at) FROM stdin;
1	note_4tRepmhLXVom	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794685398116
6	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1794695558876
7	note_4tRepmhLXVom	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1794695646279
\.


--
-- Data for Name: notext; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notext (id, type, path, v) FROM stdin;
1	إضافة كلمة ممنوعه الى الفلتر	bmsgs	صورة
2	إضافة كلمة ممنوعه الى الفلتر	bmsgs	بب
3	إضافة كلمة مراقبه الى الفلتر	wmsgs	بببب
4	إضافة كلمة ممنوعه الى الفلتر	bmsgs	للل
5	إضافة كلمة ممنوعه الى الفلتر	bmsgs	ببب
6	إضافة كلمة ممنوعه الى الفلتر	bmsgs	زب
7	إضافة كلمة مراقبه الى الفلتر	wmsgs	زب
\.


--
-- Data for Name: owner; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.owner (id, bars, "Vpn", "Gust", datafinish, "MaxRep", "Tv", "Vistor", room, isbanner, rc, cooment, offline) FROM stdin;
1	t	f	["windows.2.0.0.modern.chrome.SA","e522fd3d14bb4692959e5fca24f4b349","58b7e411d06d454987291cff11887902","719d532bf376435891849795805a8b84","fp_mwdrwuov_jyezt1wfru","fp_windows","298f979c63944e029ad50c05f36651bc","fp_mwe4b5eu_h9yverc1gx","9904e4d66ec744bba66eae78a039424a","e6f918f32b93487682f287ed4bc985da"]	2026-02-21 00:40:24	3		[]	2566st17zd	t	t	f	f
\.


--
-- Data for Name: owner_agent_transfers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.owner_agent_transfers (id, txid, agent_id, coins_amount, settlement_amount_local, currency, status, note, created_by, approved_by, created_at, approved_at) FROM stdin;
1	agent_transfer_1794593186126_617452c3291d	2	500	0.0000	USD	approved		#2 safari2023	#2 safari2023	1794593186137	1794593186137
2	agent_transfer_1794620069518_dd567ad9acff	2	50000	0.0000	SAR	approved		#8 مازن	#8 مازن	1794620069544	1794620069544
3	agent_transfer_1794620078958_e25b3b0b5f2f	2	500000	0.0000	SAR	approved		#8 مازن	#8 مازن	1794620078970	1794620078970
\.


--
-- Data for Name: powers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.powers (id, powers) FROM stdin;
1	[{"rank":100000,"name":"ispower","ico":"","kick":1000,"delbc":1,"alert":1,"mynick":1,"unick":1,"ban":1,"publicmsg":1000,"publicmsghide":1000,"forcepm":1,"roomowner":1,"createroom":1,"can_create_voice_room":0,"rooms":1000,"edituser":1,"setpower":1,"upgrades":1000,"history":1,"cp":1,"stealth":1,"owner":1,"meiut":1,"loveu":1,"ulike":1,"flter":1,"subs":1,"shrt":1,"msgs":1,"bootedit":1,"brbbot":0,"micprovideredit":0,"hostcleanup":0,"hostcontrols":0,"hostsettings":0,"hostdomains":0,"grupes":1,"delmsg":1,"delpic":1,"evaluationpoints":0,"auto_enabled":0,"auto_promote":0,"auto_points":0},{"rank":5000,"name":"ispower2","ico":"1771635980871.jpg","kick":1000,"delbc":1,"alert":1,"mynick":1,"unick":1,"ban":1,"publicmsg":1000,"publicmsghide":0,"forcepm":1,"roomowner":1,"createroom":1,"can_create_voice_room":0,"rooms":1000,"edituser":1,"setpower":1,"upgrades":1000,"history":1,"cp":1,"stealth":1,"owner":1,"meiut":1,"loveu":1,"ulike":1,"flter":1,"subs":1,"shrt":1,"msgs":1,"bootedit":1,"brbbot":0,"micprovideredit":0,"hostcleanup":0,"hostcontrols":0,"hostsettings":0,"hostdomains":0,"grupes":1,"delmsg":1,"delpic":1,"evaluationpoints":0,"auto_enabled":0,"auto_promote":0,"auto_points":0},{"rank":9999,"name":"chatmaster","ico":"","kick":1000,"delbc":1,"alert":1,"mynick":1,"unick":1,"ban":1,"publicmsg":1000,"publicmsghide":0,"forcepm":1,"roomowner":1,"createroom":1,"can_create_voice_room":0,"rooms":1000,"edituser":1,"setpower":1,"upgrades":1000,"history":1,"cp":1,"stealth":1,"owner":1,"meiut":1,"loveu":1,"ulike":1,"flter":1,"subs":1,"shrt":1,"msgs":1,"bootedit":1,"brbbot":1,"micprovideredit":1,"hostcleanup":1,"hostcontrols":1,"hostsettings":1,"hostdomains":1,"grupes":1,"delmsg":1,"delpic":1,"evaluationpoints":0,"auto_enabled":0,"auto_promote":0,"auto_points":0,"uploadgif":true,"gradientname":true,"custombg":true,"chattem":true,"frame":true,"banner":true,"gifticon":true,"profile_viewers":true},{"rank":5000,"name":"ترقية ذهبية","ico":"1771635980871.jpg","kick":1000,"delbc":1,"alert":1,"mynick":1,"unick":1,"ban":1,"publicmsg":1000,"publicmsghide":0,"forcepm":1,"roomowner":1,"createroom":1,"can_create_voice_room":0,"rooms":1000,"edituser":1,"setpower":1,"upgrades":1000,"history":1,"cp":1,"stealth":1,"owner":1,"meiut":1,"loveu":1,"ulike":1,"flter":1,"subs":1,"shrt":1,"msgs":1,"bootedit":1,"brbbot":0,"micprovideredit":0,"hostcleanup":0,"hostcontrols":0,"hostsettings":0,"hostdomains":0,"grupes":1,"delmsg":1,"delpic":1,"evaluationpoints":0,"auto_enabled":1,"auto_promote":1,"auto_points":20,"uploadgif":false,"gradientname":false,"custombg":false,"chattem":false,"frame":false,"banner":false,"gifticon":false,"profile_viewers":false},{"rank":9000,"name":"admin","ico":"","kick":1000,"delbc":1,"alert":1,"mynick":1,"unick":1,"ban":1,"publicmsg":1000,"publicmsghide":0,"forcepm":1,"roomowner":1,"createroom":1,"can_create_voice_room":0,"rooms":1000,"edituser":1,"setpower":1,"upgrades":1000,"history":1,"cp":1,"stealth":1,"owner":1,"meiut":1,"loveu":1,"ulike":1,"flter":1,"subs":1,"shrt":1,"msgs":1,"bootedit":1,"brbbot":1,"micprovideredit":1,"hostcleanup":1,"hostcontrols":1,"hostsettings":1,"hostdomains":1,"grupes":1,"delmsg":1,"delpic":1,"evaluationpoints":0,"auto_enabled":0,"auto_promote":0,"auto_points":0,"uploadgif":true,"gradientname":true,"custombg":true,"chattem":true,"frame":true,"banner":true,"gifticon":true,"profile_viewers":true},{"rank":10000,"name":"Hide","ico":"1794604974277_2af407.gif","kick":1000,"delbc":1,"alert":1,"mynick":1,"unick":1,"ban":1,"publicmsg":1000,"publicmsghide":1000,"forcepm":1,"roomowner":1,"createroom":1,"can_create_voice_room":1,"rooms":1000,"edituser":1,"setpower":1,"upgrades":1000,"history":1,"cp":1,"stealth":1,"owner":1,"meiut":1,"loveu":1,"ulike":1,"flter":1,"subs":1,"shrt":1,"msgs":1,"bootedit":1,"brbbot":1,"micprovideredit":1,"hostcleanup":1,"hostcontrols":1,"hostsettings":1,"hostdomains":1,"grupes":1,"delmsg":1,"delpic":1,"evaluationpoints":1,"auto_enabled":0,"auto_promote":0,"auto_points":0,"gifticon":1,"banner":1,"custombg":1,"frame":1,"chattem":1}]
\.


--
-- Data for Name: profile_visits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_visits (id, owner_id, visitor_id, visitor_name, visitor_pic, seen, "time", visitor_type) FROM stdin;
100	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794597762530	عضو
102	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794599251986	عضو
104	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794599772405	عضو
106	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794599784590	عضو
107	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794599831157	عضو
108	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794599935119	عضو
110	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794602434580	عضو
112	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794603633549	عضو
114	tamxbgxn7ds9shhxgzz665	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	0	1794604868532	عضو
121	db89e32c11d184f8ad801e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794608393734	عضو
122	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794608398384	عضو
123	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794608401704	عضو
124	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794608403249	عضو
126	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794609275448	عضو
130	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794609318041	عضو
132	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610284572	عضو
133	3cd5e9ef9799c8883d8b9b	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610288845	عضو
43	pj1l22e51ih51bilghkyp0	1db82554e5a9437d67da6e	مازن	pic.png	0	1794438365392	عضو
44	8d79228f9d305c993f5cf2	1db82554e5a9437d67da6e	مازن	pic.png	0	1794438646140	عضو
45	4yw6hre4qx9xj6hnwdrsz8	1db82554e5a9437d67da6e	مازن	pic.png	0	1794439260203	عضو
46	ox462ainhew5o88e83elq5	1db82554e5a9437d67da6e	مازن	pic.png	0	1794439265975	عضو
137	3cd5e9ef9799c8883d8b9b	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610356875	عضو
141	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610571621	عضو
143	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610581892	عضو
65	5i8j4dzvrmg6w7l3nw4rvy	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794501874261	عضو
66	pj1l22e51ih51bilghkyp0	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794501885932	عضو
68	ox462ainhew5o88e83elq5	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794501896432	عضو
48	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794440304662	عضو
49	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794440318378	عضو
50	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794440335336	عضو
51	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794440460599	عضو
53	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794441109230	عضو
56	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794441299599	عضو
57	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794441359214	عضو
58	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794441411317	عضو
60	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794441473003	عضو
62	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1	1794441649523	عضو
70	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	pic.png	0	1794509004920	عضو
71	61630118e5fab56cd39ea5	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794510154566	عضو
72	1e28ae10-4bf0-4413-9388-16d10428abf1	tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	0	1794518783039	عضو
73	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	0	1794519170166	عضو
74	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794522916529	عضو
75	1db82554e5a9437d67da6e	612f23b9956c63ef868ebc61	زهره	pic.png	0	1794522921263	عضو
76	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794523010853	عضو
80	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794523124979	عضو
81	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794523243218	عضو
82	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794526825666	عضو
83	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794526899638	عضو
84	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794526922099	عضو
47	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	pic.png	1	1794440090003	عضو
52	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794440566752	عضو
54	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794441214773	عضو
55	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794441240519	عضو
59	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794441434210	عضو
61	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794441498508	عضو
63	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794442422459	عضو
86	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794590930723	عضو
101	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794597762539	عضو
88	5i8j4dzvrmg6w7l3nw4rvy	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794592239143	عضو
89	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794592487262	عضو
103	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794599251987	عضو
91	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794594708803	عضو
92	61630118e5fab56cd39ea5	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794594713566	عضو
93	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794595237557	عضو
105	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794599775574	عضو
109	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794601295271	عضو
96	db89e32c11d184f8ad801e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794595868233	عضو
97	1db82554e5a9437d67da6e	g_JkbnaSqbHiB8	فاحص_الأعلام	pic.png	0	1794595939769	زائر
98	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794596977525	عضو
99	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794596977527	عضو
64	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794442488578	عضو
67	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794501888746	عضو
69	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794502264512	عضو
77	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794523069468	عضو
78	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794523114884	عضو
79	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794523117567	عضو
85	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794588080158	عضو
87	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794591118304	عضو
90	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794592794576	عضو
94	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794595557284	عضو
95	tamxbgxn7ds9shhxgzz665	g_JkbnaSqbHiB8	فاحص_الأعلام	pic.png	1	1794595816866	زائر
113	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794603633549	عضو
115	db89e32c11d184f8ad801e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794605999850	عضو
117	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794606009277	عضو
125	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794608435529	عضو
127	db89e32c11d184f8ad801e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794609296761	عضو
128	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794609303985	عضو
129	db89e32c11d184f8ad801e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794609307311	عضو
131	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610277726	عضو
134	1fed12b52786838144d1533f	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610344919	عضو
135	3cd5e9ef9799c8883d8b9b	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610351781	عضو
136	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610353680	عضو
138	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610359777	عضو
140	3cd5e9ef9799c8883d8b9b	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610569204	عضو
144	3cd5e9ef9799c8883d8b9b	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794610586093	عضو
145	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794611328474	عضو
146	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794611747806	عضو
147	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794611799939	عضو
148	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794612631199	عضو
149	8d79228f9d305c993f5cf2	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794612635689	عضو
150	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794612639239	عضو
151	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794612906645	عضو
152	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614308117	عضو
153	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614308135	عضو
154	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614489057	عضو
155	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614493419	عضو
111	af9114346116b469bcd1deb3	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794603327121	عضو
156	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614500569	عضو
157	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614710589	عضو
158	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614729669	عضو
159	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614753361	عضو
160	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614758860	عضو
161	db89e32c11d184f8ad801e	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614948683	عضو
162	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614968516	عضو
163	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794614980582	عضو
164	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615005976	عضو
165	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615027728	عضو
166	8d79228f9d305c993f5cf2	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615228231	عضو
167	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615281399	عضو
168	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615297156	عضو
169	1db82554e5a9437d67da6e	612f23b9956c63ef868ebc61	زهره	pic.png	0	1794615310110	عضو
170	1db82554e5a9437d67da6e	612f23b9956c63ef868ebc61	زهره	pic.png	0	1794615418400	عضو
171	1db82554e5a9437d67da6e	612f23b9956c63ef868ebc61	زهره	pic.png	0	1794615425779	عضو
172	1db82554e5a9437d67da6e	612f23b9956c63ef868ebc61	زهره	pic.png	0	1794615431151	عضو
173	1db82554e5a9437d67da6e	612f23b9956c63ef868ebc61	زهره	pic.png	0	1794615448235	عضو
174	3cd5e9ef9799c8883d8b9b	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615616100	عضو
175	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615643033	عضو
176	612f23b9956c63ef868ebc61	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794615654304	عضو
180	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794617594805	عضو
181	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794617635860	عضو
183	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794618804068	عضو
184	1db82554e5a9437d67da6e	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	0	1794619834166	عضو
116	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1	1794606003069	عضو
142	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1	1794610573892	عضو
118	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1	1794606017136	عضو
119	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1	1794606028187	عضو
120	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1	1794606086792	عضو
139	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1	1794610364837	عضو
177	af9114346116b469bcd1deb3	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794617346995	عضو
178	af9114346116b469bcd1deb3	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794617346999	عضو
179	af9114346116b469bcd1deb3	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794617591528	عضو
182	af9114346116b469bcd1deb3	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1	1794617643961	عضو
185	1db82554e5a9437d67da6e	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	0	1794620148329	عضو
186	0ioWaRYmZZLIRW2nAAA3	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	0	1794620266671	عضو
187	1db82554e5a9437d67da6e	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	0	1794620282263	عضو
188	1db82554e5a9437d67da6e	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	0	1794620905948	عضو
189	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794676684857	عضو
190	612f23b9956c63ef868ebc61	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794678930905	عضو
191	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794678932398	عضو
192	612f23b9956c63ef868ebc61	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794678934009	عضو
193	af9114346116b469bcd1deb3	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794680340061	عضو
194	tamxbgxn7ds9shhxgzz665	g_xuBtIPpXV2UF	فهد_التجربة	pic.png	0	1794683660683	زائر
195	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794685058539	عضو
196	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794685233415	عضو
197	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794685233418	عضو
199	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794685253998	عضو
198	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794685253997	عضو
200	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794686854355	عضو
201	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794686870373	عضو
202	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687079314	عضو
203	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687113883	عضو
204	8tyv5i71ck7f1y45k9	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687833834	عضو
205	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687837024	عضو
206	bot-1n06g9vqyr8vmq7vpo	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687842837	عضو
207	bot-lwnjt12gnz8y6dhgmt	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687847166	عضو
208	bot-1n06g9vqyr8vmq7vpo	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687852502	عضو
209	bot-1n06g9vqyr8vmq7vpo	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687855975	عضو
210	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794687866117	عضو
211	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794688132141	عضو
212	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794688152535	عضو
213	8tyv5i71ck7f1y45k9	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794691909924	عضو
214	bot-1n06g9vqyr8vmq7vpo	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794692097571	عضو
215	1db82554e5a9437d67da6e	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	0	1794694329023	عضو
216	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794698805791	عضو
217	tamxbgxn7ds9shhxgzz665	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	0	1794698815001	عضو
218	tamxbgxn7ds9shhxgzz665	g_agZjBFBamH8m	سامر	pic.png	0	1794700028576	زائر
219	tamxbgxn7ds9shhxgzz665	g_PTEl5J8Tms2q	سامر	pic.png	0	1794700444729	زائر
220	tamxbgxn7ds9shhxgzz665	g_PTEl5J8Tms2q	سامر	pic.png	0	1794700484444	زائر
221	tamxbgxn7ds9shhxgzz665	g_PTEl5J8Tms2q	سامر	pic.png	0	1794700497623	زائر
222	tamxbgxn7ds9shhxgzz665	g_PTEl5J8Tms2q	سامر	pic.png	0	1794700519287	زائر
223	tamxbgxn7ds9shhxgzz665	g_PTEl5J8Tms2q	سامر	pic.png	0	1794701277583	زائر
224	1db82554e5a9437d67da6e	g_6X5oqTsY0lr3	safari2023	pic.png	0	1794771045243	زائر
225	8tyv5i71ck7f1y45k9	g_6X5oqTsY0lr3	safari2023	pic.png	0	1794771052432	زائر
226	bot-lqme32udu4uukjy35h	g_6X5oqTsY0lr3	safari2023	pic.png	0	1794771552938	زائر
227	tamxbgxn7ds9shhxgzz665	g_6X5oqTsY0lr3	safari2023	pic.png	0	1794771981596	زائر
228	1db82554e5a9437d67da6e	g_6X5oqTsY0lr3	safari2023	pic.png	0	1794771988622	زائر
\.


--
-- Data for Name: room_welcome_visits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.room_welcome_visits (id, room_id, identity_key, is_guest, first_seen, last_seen, visits) FROM stdin;
1	D8D8A9A9C0	idreg:3	f	1773539051754	1777587051339	302
2	D8D8A9A9C0	idreg:5	f	1773956739732	1777833684470	251
3	2566st17zd	idreg:3	f	1774042883110	1777587056343	9
4	D8D8A9A9C0	fp:Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	t	1774122594615	1777829578129	27
5	2566st17zd	fp:Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	t	1774128557354	1774128735713	3
6	D8D8A9A9C0	fp:Android.13.ot6.esb.agd.Chrome.yl3.4yc.wvn	t	1774129165803	1774129750044	2
7	2566st17zd	idreg:5	f	1775169446612	1777831401696	9
8	D8D8A9A9C0	idreg:6	f	1776894733144	1776895565129	7
9	D8D8A9A9C0	fp:Windows.10.r9g.wbl.mrh.Chrome.6ht.gnp.9rv	t	1777496744627	1777501925253	4
10	D8D8A9A9C0	fp:Windows.10.xyl.3yo.t3s.Chrome.0qp.qkl.8fq	t	1777503460298	1777505865897	12
11	D8D8A9A9C0	fp:Android.6.0.xyl.3yo.t3s.Chrome.0qp.qkl.8fq	t	1777505916376	1777505916376	1
12	D8D8A9A9C0	idreg:7	f	1777688954110	1777691932402	3
13	D8D8A9A9C0	idreg:2	f	1777834575106	1794415708686	8
14	2566st17zd	idreg:2	f	1794346306613	1794346306613	1
36	2566st17zd	1e28ae10-4bf0-4413-9388-16d10428abf1	f	1794506175279	1794506175279	1
16	D8D8A9A9C0	g_ikHFwYf4TuS9	t	1794432856262	1794432856262	1
17	D8D8A9A9C0	g_jxJJ7VQ8TpPw	t	1794432903558	1794432903558	1
35	D8D8A9A9C0	1e28ae10-4bf0-4413-9388-16d10428abf1	f	1794506012082	1794506178282	2
57	cIRE81CkaF	tamxbgxn7ds9shhxgzz665	f	1794603088298	1794608777717	4
19	D8D8A9A9C0	g_xAMkhV0Uvz9s	t	1794434910045	1794434910045	1
26	2566st17zd	1db82554e5a9437d67da6e	f	1794440872549	1794609976201	11
37	D8D8A9A9C0	g_SaLjfb6orjos	t	1794507684225	1794507684225	1
60	2566st17zd	g_FnDDFZt7SsKG	t	1794613518029	1794613518029	1
25	D8D8A9A9C0	g_1VP3YblyItwk	t	1794438657341	1794438657341	1
61	TpF9XM6NsF	1db82554e5a9437d67da6e	f	1794613746606	1794613746606	1
50	3Gs3ZhmL3r	tamxbgxn7ds9shhxgzz665	f	1794596047109	1794597449951	3
38	D8D8A9A9C0	g_U1YIyVktO7AV	t	1794508902200	1794508902200	1
39	D8D8A9A9C0	g_diCZn5enp5hw	t	1794508902255	1794508902255	1
40	D8D8A9A9C0	b0228e946a337dbd06e0ae	f	1794508985133	1794508985133	1
41	D8D8A9A9C0	db89e32c11d184f8ad801e	f	1794508985164	1794508985164	1
62	TpF9XM6NsF	612f23b9956c63ef868ebc61	f	1794613761871	1794613761871	1
51	3Gs3ZhmL3r	1db82554e5a9437d67da6e	f	1794596085617	1794597706796	3
63	EtbnO2Sk37	612f23b9956c63ef868ebc61	f	1794614173084	1794614173084	1
42	D8D8A9A9C0	61630118e5fab56cd39ea5	f	1794509771672	1794509771672	1
64	EtbnO2Sk37	1db82554e5a9437d67da6e	f	1794614185973	1794614185973	1
44	D8D8A9A9C0	612f23b9956c63ef868ebc61	f	1794522409680	1794614464235	4
52	kZkyb4jGaD	tamxbgxn7ds9shhxgzz665	f	1794599222391	1794599222391	1
53	kZkyb4jGaD	1db82554e5a9437d67da6e	f	1794599363198	1794599363198	1
65	2566st17zd	g_JS179X3trLi5	t	1794615094793	1794615094793	1
78	D8D8A9A9C0	g_xuBtIPpXV2UF	t	1794683494853	1794683494853	1
66	2566st17zd	612f23b9956c63ef868ebc61	f	1794615246695	1794615289087	2
43	D8D8A9A9C0	1fed12b52786838144d1533f	f	1794520286800	1794526520427	2
81	zIam26hotD	g_agZjBFBamH8m	t	1794699975025	1794699975025	1
77	00qhpSwLi6	tamxbgxn7ds9shhxgzz665	f	1794682171448	1794691298065	2
45	D8D8A9A9C0	g_ucpmSP7PgzUa	t	1794526670676	1794526670676	1
75	7gaKF2Yjjt	tamxbgxn7ds9shhxgzz665	f	1794676473213	1794676473213	1
27	D8D8A9A9C0	g_4Soo7PS8I7zx	t	1794502641098	1794502641098	1
28	D8D8A9A9C0	g_rJVbmcXvQ3Na	t	1794502660985	1794502660985	1
29	D8D8A9A9C0	858cf050854687cd4697e666	f	1794503783417	1794503783417	1
30	D8D8A9A9C0	b36afd63c0f2444554741ec7	f	1794503869575	1794503869575	1
31	2566st17zd	858cf050854687cd4697e666	f	1794503933203	1794503933203	1
32	2566st17zd	b36afd63c0f2444554741ec7	f	1794503955702	1794503955702	1
58	2566st17zd	af9114346116b469bcd1deb3	f	1794603250444	1794616774530	2
55	SW2SEkrSBZ	tamxbgxn7ds9shhxgzz665	f	1794600871079	1794600871079	1
33	D8D8A9A9C0	1df05ea402cb47ffaf759734	f	1794504626568	1794504626568	1
34	2566st17zd	1df05ea402cb47ffaf759734	f	1794504649055	1794504649055	1
18	D8D8A9A9C0	tamxbgxn7ds9shhxgzz665	f	1794433984288	1794693547364	31
46	zIam26hotD	1db82554e5a9437d67da6e	f	1794588920395	1794769759838	10
54	SW2SEkrSBZ	1db82554e5a9437d67da6e	f	1794600858039	1794601008621	2
49	2566st17zd	g_JkbnaSqbHiB8	t	1794595784218	1794595784218	1
48	4EiKKuYYx6	tamxbgxn7ds9shhxgzz665	f	1794595190693	1794595919069	3
68	bnRijiP1j9	af9114346116b469bcd1deb3	f	1794616967200	1794616967200	1
67	bnRijiP1j9	1db82554e5a9437d67da6e	f	1794615771098	1794617052764	2
69	Kvjh6GHORe	1db82554e5a9437d67da6e	f	1794618175554	1794618175554	1
59	cIRE81CkaF	af9114346116b469bcd1deb3	f	1794603262382	1794604515772	2
70	Kvjh6GHORe	af9114346116b469bcd1deb3	f	1794618570277	1794618570277	1
76	DtMSpAH2LE	1db82554e5a9437d67da6e	f	1794677990612	1794677990612	1
15	D8D8A9A9C0	1db82554e5a9437d67da6e	f	1794432817516	1794688011224	37
56	cIRE81CkaF	1db82554e5a9437d67da6e	f	1794603037873	1794608769650	2
71	0wpC9zu974	1db82554e5a9437d67da6e	f	1794619541249	1794619541249	1
72	0wpC9zu974	af9114346116b469bcd1deb3	f	1794619565648	1794619565648	1
73	D8D8A9A9C0	af9114346116b469bcd1deb3	f	1794619725668	1794619725668	1
83	zIam26hotD	g_6X5oqTsY0lr3	t	1794771009797	1794771009797	1
74	zIam26hotD	af9114346116b469bcd1deb3	f	1794620517271	1794620517271	1
24	2566st17zd	tamxbgxn7ds9shhxgzz665	f	1794437869808	1794682149511	24
79	00qhpSwLi6	1db82554e5a9437d67da6e	f	1794685106416	1794687719225	3
82	zIam26hotD	g_PTEl5J8Tms2q	t	1794700409062	1794700409062	1
80	fxKMqh6WaA	tamxbgxn7ds9shhxgzz665	f	1794699599248	1794699599248	1
47	zIam26hotD	tamxbgxn7ds9shhxgzz665	f	1794589578124	1794777006669	24
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rooms (idroom, about, "user", pass, id, owner, topic, pic, rmli, mic, welcome, broadcast, deleted, needpass, color, max, stage_count, stage_state, room_owner_meta, message_mode) FROM stdin;
4	غرفة دردشة وتواصل	seohost		zIam26hotD	#1	غرفة المسابقات	picroom/1794588408136_1ed415.jpg	0	5	أهلاً وسهلاً بالجميع	f	f	f	#0A6E8C	40	5	{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0}	{"ownerId":"#1","ownerUser":"system","ownerTopic":"System","badge_id":"","badge":{"name":"","bg":"","icon":"","bg_type":"static"},"assignments":[]}	real
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (id, site, dro3, them, cover, emo, sico, room_badges, site_badges, gifts_git, gift_categories) FROM stdin;
1	{"siteScript":"1777583218756.json","bg":"0A6E8C","buttons":"#b60202","background":"#910808","walllikes":"{\\"likeMsgRoom\\":\\"8\\",\\"likeTopicEdit\\":\\"100\\",\\"likeUpPic\\":\\"10\\",\\"likeUpImgBc\\":\\"500\\",\\"lengthMsgRoom\\":\\"250\\",\\"lengthMsgPm\\":\\"250\\",\\"lengthMsgBc\\":\\"250\\",\\"lengthUserReg\\":\\"100\\",\\"lengthUserG\\":\\"100\\",\\"bclikes\\":\\"10\\"}","wallminutes":"0","bclikes":"10","msgst":"5","pmlikes":"2000","miclikes":"5000","notlikes":"7000","fileslikes":"90000","allowg":true,"allowreg":true,"micprovider":"WEBRTC","roomMessageTheme":"classic","evaluation_awards":{"enabled":true,"actions":{"room_message":{"points":1,"cooldownMs":180000,"dailyLimit":40,"minRoomMembers":3,"minLength":3,"requireDifferentMember":true},"wall_post":{"points":3,"cooldownMs":180000,"dailyLimit":15,"minRoomMembers":0,"minLength":3,"requireDifferentMember":true},"private_message":{"points":1,"cooldownMs":600000,"dailyLimit":10,"minRoomMembers":0,"minLength":3,"requireDifferentMember":true},"online_duration":{"points":1,"cooldownMs":900000,"dailyLimit":20,"minRoomMembers":0,"minLength":0,"requireDifferentMember":true},"daily_login":{"points":5,"cooldownMs":0,"dailyLimit":5,"minRoomMembers":0,"minLength":0,"requireDifferentMember":true},"game_win":{"points":4,"cooldownMs":0,"dailyLimit":40,"minRoomMembers":0,"minLength":0,"requireDifferentMember":true}}},"title":"شات يمن ايفون"}	["1771636115918.jpg","1794604974277_2af407.gif"]	["1771636084601.gif","1775173367834.jpg","1775173372955.jpg","1775173377825.jpg"]	["1771636098677.gif","1775173329999.jpg","1775173341108.gif","1775173346636.jpg","1775173357479.gif"]	["1773355492653.gif","1773365316706.gif","1773365326132.gif","1773365335073.gif","1773365344347.gif","1773365356133.gif","1773365364558.gif"]	["1771635980871.jpg","1771715317451.gif"]	[{"id":"rb_1772239218404","name":"مالك الغرفة","bg":"linear-gradient(60deg, #ff0000, #fff200, #a600ff, #ffffff)","icon":"/room_badges/1772243111563.gif","bg_type":"animated"},{"id":"rb_1772243272470","name":"مشرف الغرفة","bg":"linear-gradient(60deg, #c80909, #c80909, #c80909, #c80909)","icon":"/room_badges/1772243270229.gif","bg_type":"static"}]	[{"id":"sb_1772252966823","name":"مالك الموقع","bg":"linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)","icon":"/room_badges/1772252964797.gif","bg_type":"animated"},{"id":"sb_1773956561289","name":"بببب","bg":"linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)","icon":"/room_badges/1773956558185.gif","bg_type":"animated"},{"id":"sb_1794595667690","name":"مالك الاستضافة","bg":"linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)","icon":"","bg_type":"animated"}]	[{"id":"rose_standard","file":"rose.png","coin":1,"name":"وردة","category":"افتراضي"},{"id":"rxdb4mq71776445026015","file":"1776445025983.jpg","coin":1,"name":"وردة","category":"فاخر"},{"id":"foz1x4ka1776445012437","file":"1776445012406.jpg","coin":1000,"name":"شسي شسي","category":"افتراضي"},{"id":"jzuye7pv1776445003832","file":"1776445003798.jpg","coin":1000,"name":"شسي سي","category":"فاخر"},{"id":"2op2uill1776444994791","file":"1776444994729.jpg","coin":1000,"name":"ي سيشي","category":"فاخر"},{"id":"v35jolgo1776441783325","file":"1776441783301.jpg","coin":1300,"name":"مايك","category":"افتراضي"},{"id":"tpbj825j1776441767615","file":"1776441767591.jpg","coin":1200,"name":"طيارة","category":"فاخر"},{"id":"4xcc0vdd1776441721112","file":"1776441721087.jpg","coin":1500,"name":"سيارة","category":"فاخر"}]	["افتراضي","فاخر"]
\.


--
-- Data for Name: site; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site (id, banner, host, ids, logo) FROM stdin;
1	1773956666064.jpg	localhost	1	1773956645236.webp
\.


--
-- Data for Name: site_master_wallet; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_master_wallet (id, site_id, balance_coins, reserved_coins, status, created_at, updated_at) FROM stdin;
1	1	440810	0	active	1775168862236	1794620251962
\.


--
-- Data for Name: site_master_wallet_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_master_wallet_ledger (id, txid, site_id, event_type, amount, before_balance, after_balance, actor_type, actor_id, counterparty_type, counterparty_id, note, reference_table, reference_id, created_at) FROM stdin;
3	master_1794591711380_8682ad2a2780	1	manual_adjustment_add	1000000	0	1000000	owner	#8 مازن	system			site_master_wallet	1	1794591711394
4	agent_transfer_1794593186126_617452c3291d	1	transfer_to_agent	-500	1000000	999500	owner	#2 safari2023	agent	2		owner_agent_transfers	1	1794593186137
5	agent_topup_1794619374597_30e213199dd6	1	topup_agent_commission	-10	999500	999490	agent	AG2CCF562E6E medos	agent	2	commission for order TP1794619303384B93406	topup_orders	4	1794619374614
6	agent_transfer_1794620069518_dd567ad9acff	1	transfer_to_agent	-50000	999490	949490	owner	#8 مازن	agent	2		owner_agent_transfers	2	1794620069544
7	agent_transfer_1794620078958_e25b3b0b5f2f	1	transfer_to_agent	-500000	949490	449490	owner	#8 مازن	agent	2		owner_agent_transfers	3	1794620078970
8	topup_1794620122027_93e88f76f5c5	1	topup_agent_commission	-10000	449490	439490	owner	#8 مازن	agent	2	commission for order TP17946200902571A1AE6	topup_orders	5	1794620122040
9	gift_1794620160319_ez9h6j	1	gift_fee	400	439490	439890	user	af9114346116b469bcd1deb3	user	1db82554e5a9437d67da6e	Gift 1776444994729.jpg x1	gift_notifications	0	1794620160319
10	gift_1794620226043_aaqeuh	1	gift_fee	520	439890	440410	user	af9114346116b469bcd1deb3	user	1db82554e5a9437d67da6e	Gift 1776441783301.jpg x1	gift_notifications	0	1794620226043
11	gift_1794620251962_8u8hjt	1	gift_fee	400	440410	440810	user	af9114346116b469bcd1deb3	user	1db82554e5a9437d67da6e	Gift 1776445012406.jpg x1	gift_notifications	0	1794620251962
\.


--
-- Data for Name: stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats (id, state, topic, username, room, ip, "time") FROM stdin;
325	تعديل وضع حماية الدوز	مازن	STRICT		127.0.0.1	1794502053535
326	تعديل وضع حماية الدوز	مازن	STRICT		127.0.0.1	1794502055450
329	تعديل غرفه	seohost	safari2023	الغرفة العامة	127.0.0.1	1794503687245
331	تعديل غرفه	seohost	safari2023	الغرفة العامة	127.0.0.1	1794505068602
333	مزود المايكات	safari2023	WEBRTC		127.0.0.1	1794508598333
335	مزود المايكات	qa_voice_owner_1794508901557	JITSI		127.0.0.1	1794508903503
336	مزود المايكات	qa_voice_owner_1794508901557	LIVEKIT		127.0.0.1	1794508903821
337	مزود المايكات	qa_voice_owner_1794508901557	WEBRTC		127.0.0.1	1794508904135
339	مزود المايكات	qa_e2e_voice	WEBRTC		127.0.0.1	1794510554549
341	تنبيه	مازن	زهره	2566st17zd	127.0.0.1	1794523143816
342	تعديل الايكات	مازن	زهره (1000)	D8D8A9A9C0	127.0.0.1	1794523163201
344	حذف صورة	مازن	زهره	2566st17zd	127.0.0.1	1794523374880
345	طرد	مازن	زهره	2566st17zd	127.0.0.1	1794523384348
347	تعديل غرفه	seohost	safari2023	صنعاء	127.0.0.1	1794588325895
349	إعدادت الموقع	safari2023	حفظ		127.0.0.1	1794588707097
350	إعدادت الموقع	safari2023	حفظ		127.0.0.1	1794588713900
353	إظافة رسالة يوميه	مازن	مازن		127.0.0.1	1794591520780
355	إعدادت الموقع	مازن	حفظ		127.0.0.1	1794591580291
357	إضافة وكيل شحن	مازن	Mohammed		127.0.0.1	1794591749455
359	تعديل وضع حماية الدوز	مازن	STRICT		127.0.0.1	1794591839373
361	تعديل صلاحية	seohostseohost	[ترقية ذهبية] زهره		127.0.0.1	1794593313044
363	انشاء بث صوتي	seohostseohost	safari2023	قناة صوتية	127.0.0.1	1794595184454
365	انشاء بث صوتي	seohostseohost	safari2023	قناة صوتي	127.0.0.1	1794596034092
367	انشاء بث صوتي	seohostseohost	safari2023	سوالف وظحك	127.0.0.1	1794599222376
369	تعديل مجموعة 	seohostseohost	seohostseohost	Hide	127.0.0.1	1794599929552
371	انشاء بث صوتي	مازن	مازن	سوالف	127.0.0.1	1794600858026
373	انشاء بث صوتي	مازن	مازن	سوالف	127.0.0.1	1794603037857
375	إظافة هدية	seohostseohost	safari2023		127.0.0.1	1794604974344
377	حذف غرفه	مازن	مازن	سوالف	127.0.0.1	1794609961293
379	حذف غرفه	مازن	مازن	سوالف	127.0.0.1	1794613974576
381	حذف غرفه	زهره	زهره	و6و6ت	127.0.0.1	1794614438721
383	تنبيه	مازن	seohostseohost		127.0.0.1	1794614778995
385	طرد	مازن	نيمار		127.0.0.1	1794615234051
386	طرد	مازن	سشسش		127.0.0.1	1794615240317
387	طرد	مازن	سشسش		127.0.0.1	1794615242341
389	حذف غرفه	مازن	مازن	سوالف	127.0.0.1	1794617377776
391	انشاء بث صوتي	مازن	مازن	سوالف	127.0.0.1	1794618175537
393	إنشاء طلب شحن	علي	TP1794619303384B93406		127.0.0.1	1794619303395
395	حذف غرفه	مازن	مازن	سوالف	127.0.0.1	1794619714047
397	تحويل رصيد إلى وكيل	مازن	Mohammed / 50000 coin		127.0.0.1	1794620069553
399	إنشاء طلب شحن	علي	TP17946200902571A1AE6		127.0.0.1	1794620090272
401	انشاء بث صوتي	seohostseohost	safari2023	سوالف	127.0.0.1	1794676473199
403	انشاء بث صوتي	مازن	مازن	سوالف	127.0.0.1	1794677990597
405	طرد	seohostseohost	علي	2566st17zd	127.0.0.1	1794680343513
407	تنبيه	مازن	seohostseohost	00qhpSwLi6	127.0.0.1	1794685260066
409	انشاء بث صوتي	seohostseohost	safari2023	بث seohostseohost الصوتي	127.0.0.1	1794699599214
411	فك حظر	safari2023	النظام	9904e4d66ec744bba66eae78a039424a	127.0.0.1	1794700390299
327	تعديل وضع حماية الدوز	مازن	STRICT		127.0.0.1	1794502059873
328	الغاء تفعيل تعليقات الجدار	مازن	مازن		127.0.0.1	1794502070883
330	تعديل غرفه	seohost	safari2023	الغرفة العامة	127.0.0.1	1794504777706
332	تعديل غرفه	seohost	safari2023	الغرفة العامة	127.0.0.1	1794505700509
334	تعديل غرفه	seohost	safari2023	الغرفة العامة	127.0.0.1	1794508810317
338	مزود المايكات	qa_e2e_voice	JITSI		127.0.0.1	1794510510558
340	تعديل غرفه	مازن	مازن	الغرفة العامة	127.0.0.1	1794519407739
343	ترقية حساب	مازن	[ترقية ذهبية] زهره		127.0.0.1	1794523191166
346	تعديل الايكات	مازن	زهره (10000)	D8D8A9A9C0	127.0.0.1	1794526836277
348	انشاء غرفه	seohost	safari2023	غرفة المسابقات	127.0.0.1	1794588417314
351	إظافة فلتر	مازن	زب		127.0.0.1	1794591435863
352	إظافة فلتر	مازن	زب		127.0.0.1	1794591446189
354	إظافة إختصار	مازن	ك1		127.0.0.1	1794591540392
356	إضافة إلى الرصيد الرئيسي	مازن	1000000 coin		127.0.0.1	1794591711398
358	إضافة باقة شحن	مازن	باقة البدايه		127.0.0.1	1794591787779
360	تحويل رصيد إلى وكيل	seohostseohost	Mohammed / 500 coin		127.0.0.1	1794593186155
362	تعديل مجموعة 	seohostseohost	seohostseohost	Hide	127.0.0.1	1794594913150
364	تعديل صلاحية	مازن	[Hide] seohostseohost		127.0.0.1	1794595572261
366	حذف غرفه	seohostseohost	safari2023	قناة صوتي	127.0.0.1	1794597841732
368	حذف غرفه	seohostseohost	safari2023	سوالف وظحك	127.0.0.1	1794599507641
370	تعديل غرفه	seohostseohost	safari2023	غرفة المسابقات	127.0.0.1	1794600113921
372	حذف غرفه	مازن	مازن	سوالف	127.0.0.1	1794601269017
374	تعديل الايكات	مازن	علي (100000)	cIRE81CkaF	127.0.0.1	1794603358599
376	تعديل مجموعة 	seohostseohost	seohostseohost	Hide	127.0.0.1	1794604991068
378	انشاء بث صوتي	مازن	مازن	سوالف	127.0.0.1	1794613746583
380	انشاء بث صوتي	زهره	زهره	و6و6ت	127.0.0.1	1794614173065
382	تعديل صلاحية	مازن	[chatmaster] seohostseohost		127.0.0.1	1794614652597
384	تعديل صلاحية	مازن	[chatmaster] seohostseohost		127.0.0.1	1794614996642
388	انشاء بث صوتي	مازن	مازن	سوالف	127.0.0.1	1794615771079
390	الغاء تثبيت العضويات	مازن	مازن		127.0.0.1	1794617537299
392	حذف غرفه	مازن	مازن	سوالف	127.0.0.1	1794618759697
394	انشاء بث صوتي	مازن	مازن	سوالف	127.0.0.1	1794619541232
396	إضافة باقة شحن	مازن	باقه عرض		127.0.0.1	1794619963748
398	تحويل رصيد إلى وكيل	مازن	Mohammed / 500000 coin		127.0.0.1	1794620078988
400	اعتماد طلب شحن	مازن	TP17946200902571A1AE6		127.0.0.1	1794620122080
402	حذف غرفه	seohostseohost	safari2023	سوالف	127.0.0.1	1794676593792
404	حذف غرفه	مازن	مازن	سوالف	127.0.0.1	1794678349922
406	انشاء بث صوتي	seohostseohost	safari2023	بث seohostseohost الصوتي	127.0.0.1	1794682171404
408	حذف غرفه	seohostseohost	safari2023	بث seohostseohost الصوتي	127.0.0.1	1794691303169
410	تنبيه	seohostseohost	سامر	zIam26hotD	127.0.0.1	1794700199314
314	تنبيه	seohost	مازن	D8D8A9A9C0	127.0.0.1	1794440357256
315	تعديل الايكات	seohost	مازن (100000)	D8D8A9A9C0	127.0.0.1	1794440378279
316	ترقية حساب	seohost	[ترقية ذهبية] مازن		127.0.0.1	1794441127905
317	طرد	seohost	مازن	2566st17zd	127.0.0.1	1794441417696
318	تعديل صلاحية	seohost	[Hide] مازن		127.0.0.1	1794441484913
319	ترقية حساب	مازن	[Hide] seohost		127.0.0.1	1794441516989
320	تثبيت العضويات	safari2023	seohost		127.0.0.1	1794442361636
321	طرد	مازن	سشسش	D8D8A9A9C0	127.0.0.1	1794442512699
322	تعديل مجموعة 	مازن	مازن	Hide	127.0.0.1	1794442594574
323	تعديل مجموعة 	مازن	مازن	Hide	127.0.0.1	1794442621742
324	تعديل مجموعة 	مازن	مازن	admin	127.0.0.1	1794442640414
\.


--
-- Data for Name: storie; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.storie (id, sid, photo, name, link, "lastUpdated", item, seen, "currentPreview") FROM stdin;
4	z7fwmux1g29vwcpjx77z35ffi10itdx	/pic/1773376784089.jpg	medo	 		[{"itid":"rvdk3exxza4kgkno252q","type":"photo","length":3,"src":"/sendfile/1777830368847.jpg","preview":" ","link":"","linkText":false,"time":1777830333.858,"seen":false}]	f	1777830333.858
9	af9114346116b469bcd1deb3	/pic/1794603563676_1aca1b.jpg	علي	text:ينسنس	1794620762360	[{"id":"6L7xLbo6Yt","type":"text","src":"","caption":"🎵 غيمه","bgColor":"linear-gradient(135deg,#667eea,#764ba2)","textColor":"#ffffff","length":6,"time":1794620694891},{"id":"fDs9i5MB4A","type":"text","src":"","caption":"ينسنس","bgColor":"linear-gradient(135deg,#30cfd0,#330867)","textColor":"#ffffff","length":6,"time":1794620762360}]	f	[]
7	1fed12b52786838144d1533f	pic.png	أمير القصص	text:منورين كلكلم	1794526526446	[{"id":"HRp7obe9Xs","type":"text","src":"","caption":"منورين كلكلم","bgColor":"linear-gradient(135deg,#e0c3fc,#8ec5fc)","textColor":"#ffffff","length":6,"time":1794520536734},{"id":"8PNTIKHcqg","type":"text","src":"","caption":"منورين كلكلم","bgColor":"linear-gradient(135deg,#f5576c,#ff6f91)","textColor":"#ffffff","length":6,"time":1794521148432},{"id":"sbNokxnQoP","type":"text","src":"","caption":"منورين كلكلم","bgColor":"linear-gradient(135deg,#30cfd0,#330867)","textColor":"#ffffff","length":6,"time":1794521758467},{"id":"6DaumFBhBT","type":"text","src":"","caption":"منورين كلكلم","bgColor":"linear-gradient(135deg,#a18cd1,#fbc2eb)","textColor":"#ffffff","length":6,"time":1794525271359},{"id":"dzuIfeoGOC","type":"text","src":"","caption":"منورين كلكلم","bgColor":"linear-gradient(135deg,#30cfd0,#330867)","textColor":"#ffffff","length":6,"time":1794526526446}]	f	[]
6	1db82554e5a9437d67da6e	/pic/1794440403648_6c221e.jpg	مازن	text:لست نصا يمكن ازالتة انا الفكرة🌸🤍	1794617888237	[{"id":"x4EiOB9WK6","type":"video","src":"/sendfile/1794439466562_419aec.mp4","length":15,"time":1794439466581},{"id":"w1Q1t5mo53","type":"image","src":"/sendfile/1794441780715_4b9180.jpg","length":6,"time":1794441780759},{"id":"Sz9fPTLNJw","type":"video","src":"/sendfile/1794589511548_e1bdf5.mp4","caption":"حب حب","length":15,"time":1794589511604},{"id":"3BZmRkzSIt","type":"audio","src":"/sendfile/1794613080762_6e6404.mp4","caption":"8OFADSX3U","length":15,"time":1794613080878},{"id":"NbutTDHb9u","type":"text","src":"","caption":"الا بذكر الله تطمئن القلوب🌸🎵","bgColor":"linear-gradient(135deg,#667eea,#764ba2)","textColor":"#ffffff","length":6,"time":1794615099742},{"id":"y9OdtmzEWd","type":"text","src":"","caption":"لست نصا يمكن ازالتة انا الفكرة🌸🤍","bgColor":"linear-gradient(135deg,#667eea,#764ba2)","textColor":"#ffffff","length":6,"time":1794617888237}]	f	[]
\.


--
-- Data for Name: storieview; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.storieview (id, sid, topic, photo, idsto, item, "time") FROM stdin;
1	kli4vc4f25x10d0a3qs4y32sbz8vv5b	chatmaster11	/pic/1771634698757.jpg	kli4vc4f25x10d0a3qs4y32sbz8vv5b	0	1771977623209
2	z7fwmux1g29vwcpjx77z35ffi10itdx	medo	pic.png	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1772402558481
3	kli4vc4f25x10d0a3qs4y32sbz8vv5b	chatmaster11	/pic/1771634698757.jpg	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1772403415827
4	kli4vc4f25x10d0a3qs4y32sbz8vv5b	chatmaster11	/pic/1771634698757.jpg	kli4vc4f25x10d0a3qs4y32sbz8vv5b	1	1773355598889
6	1db82554e5a9437d67da6e	مازن	pic.png	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794439417478
7	1db82554e5a9437d67da6e	مازن	pic.png	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794439422619
8	1db82554e5a9437d67da6e	مازن	pic.png	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794439428144
9	1db82554e5a9437d67da6e	مازن	pic.png	1db82554e5a9437d67da6e	0	1794439470845
10	1db82554e5a9437d67da6e	مازن	pic.png	1db82554e5a9437d67da6e	0	1794439484201
11	1db82554e5a9437d67da6e	مازن	pic.png	1db82554e5a9437d67da6e	0	1794440136773
12	tamxbgxn7ds9shhxgzz665	seohost	pic.png	1db82554e5a9437d67da6e	0	1794440180777
13	1db82554e5a9437d67da6e	مازن	pic.png	1db82554e5a9437d67da6e	0	1794440185718
14	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	0	1794441787226
15	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	1	1794441799970
16	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794441889242
17	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	0	1794441893727
18	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	0	1794502112852
19	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	0	1794519614308
20	1fed12b52786838144d1533f	أمير القصص	pic.png	1fed12b52786838144d1533f	0	1794520569273
21	1fed12b52786838144d1533f	أمير القصص	pic.png	1db82554e5a9437d67da6e	0	1794520575799
22	1fed12b52786838144d1533f	أمير القصص	pic.png	1db82554e5a9437d67da6e	1	1794520605388
23	1fed12b52786838144d1533f	أمير القصص	pic.png	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794520614525
24	tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	1db82554e5a9437d67da6e	1	1794520832116
25	1fed12b52786838144d1533f	أمير القصص	pic.png	1fed12b52786838144d1533f	1	1794521188434
26	1fed12b52786838144d1533f	أمير القصص	pic.png	1fed12b52786838144d1533f	2	1794521830054
27	612f23b9956c63ef868ebc61	زهره	pic.png	1db82554e5a9437d67da6e	0	1794522789604
28	612f23b9956c63ef868ebc61	زهره	pic.png	1fed12b52786838144d1533f	2	1794522798405
29	612f23b9956c63ef868ebc61	زهره	pic.png	1db82554e5a9437d67da6e	1	1794522805125
31	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1fed12b52786838144d1533f	0	1794523955486
32	612f23b9956c63ef868ebc61	زهره	pic.png	1fed12b52786838144d1533f	0	1794523959376
34	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1fed12b52786838144d1533f	1	1794523966410
35	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1fed12b52786838144d1533f	2	1794523977257
36	1fed12b52786838144d1533f	أمير القصص	pic.png	1fed12b52786838144d1533f	3	1794525408559
37	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1fed12b52786838144d1533f	3	1794528858442
38	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1fed12b52786838144d1533f	4	1794528883302
39	tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794587903639
40	tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	1fed12b52786838144d1533f	0	1794588205031
41	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	2	1794589532111
42	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1db82554e5a9437d67da6e	2	1794607373852
43	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1fed12b52786838144d1533f	1	1794607437606
44	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1fed12b52786838144d1533f	2	1794610295710
45	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1fed12b52786838144d1533f	3	1794610297251
46	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1fed12b52786838144d1533f	4	1794610298199
47	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	3	1794613268474
48	612f23b9956c63ef868ebc61	زهره	pic.png	1db82554e5a9437d67da6e	2	1794614064914
49	612f23b9956c63ef868ebc61	زهره	pic.png	1db82554e5a9437d67da6e	3	1794614068016
50	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	4	1794615680026
51	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	1db82554e5a9437d67da6e	0	1794616866061
52	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	1db82554e5a9437d67da6e	1	1794616870743
53	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	1db82554e5a9437d67da6e	2	1794616914465
54	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	1db82554e5a9437d67da6e	3	1794616919170
55	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	1db82554e5a9437d67da6e	4	1794616921048
56	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1db82554e5a9437d67da6e	5	1794617911136
57	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794620592678
58	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	af9114346116b469bcd1deb3	0	1794620739228
59	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	af9114346116b469bcd1deb3	1	1794620771724
60	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	af9114346116b469bcd1deb3	0	1794676264233
61	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1db82554e5a9437d67da6e	3	1794676267194
62	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1db82554e5a9437d67da6e	4	1794676270295
63	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1db82554e5a9437d67da6e	5	1794676271196
64	g_xuBtIPpXV2UF	فهد_التجربة	pic.png	af9114346116b469bcd1deb3	0	1794683550324
65	g_xuBtIPpXV2UF	فهد_التجربة	pic.png	af9114346116b469bcd1deb3	1	1794683557748
66	g_xuBtIPpXV2UF	فهد_التجربة	pic.png	1db82554e5a9437d67da6e	0	1794683565227
67	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	af9114346116b469bcd1deb3	0	1794685020709
68	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	af9114346116b469bcd1deb3	1	1794685335737
69	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	af9114346116b469bcd1deb3	1	1794691286039
70	g_6X5oqTsY0lr3	safari2023	pic.png	z7fwmux1g29vwcpjx77z35ffi10itdx	0	1794771557562
71	g_6X5oqTsY0lr3	safari2023	pic.png	1db82554e5a9437d67da6e	0	1794771562102
72	g_6X5oqTsY0lr3	safari2023	pic.png	1db82554e5a9437d67da6e	1	1794771582822
73	g_6X5oqTsY0lr3	safari2023	pic.png	1db82554e5a9437d67da6e	2	1794771585276
74	g_6X5oqTsY0lr3	safari2023	pic.png	1db82554e5a9437d67da6e	3	1794771592323
75	g_6X5oqTsY0lr3	safari2023	pic.png	1db82554e5a9437d67da6e	4	1794771594234
76	g_6X5oqTsY0lr3	safari2023	pic.png	1db82554e5a9437d67da6e	5	1794771596014
77	g_6X5oqTsY0lr3	safari2023	pic.png	af9114346116b469bcd1deb3	0	1794771605857
\.


--
-- Data for Name: story_comment_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.story_comment_likes (id, comment_cid, user_uid, created_at) FROM stdin;
1	sc_XGonJjzWbSwe	1db82554e5a9437d67da6e	1794520954304
2	sc_YhVIyvw9n2zj	1db82554e5a9437d67da6e	1794520984235
3	sc_f81qNtQ7maom	1db82554e5a9437d67da6e	1794522833314
4	sc_VAohJPz1Vl76	1fed12b52786838144d1533f	1794526533722
5	sc_eYMhusiOrIUU	1fed12b52786838144d1533f	1794526534125
6	sc_11aXo3vnLuVH	af9114346116b469bcd1deb3	1794616903708
\.


--
-- Data for Name: story_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.story_comments (id, cid, story_sid, item_id, parent_cid, reply_to_topic, author_uid, author_topic, author_pic, author_ucol, author_verified, body, likes_count, created_at) FROM stdin;
2	sc_ycBRrDzrPlmO	1db82554e5a9437d67da6e	x4EiOB9WK6			1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	❤️	0	1794520936862
1	sc_XGonJjzWbSwe	1db82554e5a9437d67da6e	x4EiOB9WK6			tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	#000000	t	❤️	1	1794520813268
3	sc_YhVIyvw9n2zj	1db82554e5a9437d67da6e	x4EiOB9WK6	sc_XGonJjzWbSwe	seohost	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	تسلم	1	1794520964768
4	sc_f81qNtQ7maom	1db82554e5a9437d67da6e	x4EiOB9WK6			612f23b9956c63ef868ebc61	زهره	pic.png	#000000	f	❤️حلووو	1	1794522821386
5	sc_a34XzBk3yuaU	1db82554e5a9437d67da6e	x4EiOB9WK6	sc_f81qNtQ7maom	زهره	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	شكرا	0	1794522842523
7	sc_Ah9hWNDDL33s	1fed12b52786838144d1533f	8PNTIKHcqg			1fed12b52786838144d1533f	أمير القصص	pic.png	#000000	f	قصة جميلة جداً	0	1794525538825
8	sc_yHSNVSN9KJo5	1fed12b52786838144d1533f	8PNTIKHcqg	sc_Ah9hWNDDL33s	أمير القصص	1fed12b52786838144d1533f	أمير القصص	pic.png	#000000	f	منورين وشكراً	0	1794525598777
9	sc_VAohJPz1Vl76	1fed12b52786838144d1533f	HRp7obe9Xs			1fed12b52786838144d1533f	أمير القصص	pic.png	#000000	f	قصة جميلة جداً	1	1794526530884
10	sc_eYMhusiOrIUU	1fed12b52786838144d1533f	HRp7obe9Xs	sc_VAohJPz1Vl76	أمير القصص	1fed12b52786838144d1533f	أمير القصص	pic.png	#000000	f	منورين وشكراً	1	1794526532398
11	sc_yGdJpJIlCS0m	1fed12b52786838144d1533f	HRp7obe9Xs	sc_VAohJPz1Vl76	أمير القصص	tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	#000000	t	قوة القوة	0	1794588219473
12	sc_Sbc5nYEPJ3jY	1fed12b52786838144d1533f	HRp7obe9Xs	sc_VAohJPz1Vl76	seohost	tamxbgxn7ds9shhxgzz665	seohost	/pic/1794512127060_378568.jpg	#000000	t	تسلم	0	1794588235303
13	sc_IZ3Xma5Xcxzz	1db82554e5a9437d67da6e	Sz9fPTLNJw			1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	روووعه	0	1794589545709
14	sc_hKmJEmATA17V	1db82554e5a9437d67da6e	Sz9fPTLNJw			1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	❤️	0	1794590535106
15	sc_IB9S5asG0hDm	1db82554e5a9437d67da6e	Sz9fPTLNJw	sc_hKmJEmATA17V	مازن	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	روعه	0	1794590544904
17	sc_LUw2ZAt21LCi	1db82554e5a9437d67da6e	Sz9fPTLNJw	sc_hKmJEmATA17V	مازن	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#900909	t	رهيب	0	1794607396951
18	sc_CEymbCz9Xw9g	1db82554e5a9437d67da6e	Sz9fPTLNJw			1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	نايس	0	1794611167673
19	sc_my3ylbnL90Ol	1db82554e5a9437d67da6e	3BZmRkzSIt			1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	قوة	0	1794613113970
20	sc_9HyFyax6srRK	1db82554e5a9437d67da6e	NbutTDHb9u			1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	❤️	0	1794615694985
21	sc_vsqWaf0TRYAI	1db82554e5a9437d67da6e	NbutTDHb9u	sc_9HyFyax6srRK	مازن	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	#000000	f	نينين	0	1794615699590
22	sc_11aXo3vnLuVH	1db82554e5a9437d67da6e	x4EiOB9WK6			af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	#000000	f	❤️	1	1794616892100
\.


--
-- Data for Name: story_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.story_likes (id, story_sid, item_id, user_uid, topic, photo, created_at) FROM stdin;
1	1db82554e5a9437d67da6e	x4EiOB9WK6	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794520926691
2	1db82554e5a9437d67da6e	w1Q1t5mo53	1fed12b52786838144d1533f	أمير القصص	pic.png	1794521868387
3	1db82554e5a9437d67da6e	x4EiOB9WK6	612f23b9956c63ef868ebc61	زهره	pic.png	1794522796880
5	1fed12b52786838144d1533f	sbNokxnQoP	1fed12b52786838144d1533f	أمير القصص	pic.png	1794525401563
6	1fed12b52786838144d1533f	HRp7obe9Xs	1fed12b52786838144d1533f	أمير القصص	pic.png	1794526529310
8	1db82554e5a9437d67da6e	w1Q1t5mo53	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794591005970
9	z7fwmux1g29vwcpjx77z35ffi10itdx	slide_4_0	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794592499656
10	1db82554e5a9437d67da6e	Sz9fPTLNJw	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1794607409096
11	1db82554e5a9437d67da6e	Sz9fPTLNJw	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794611154662
12	1fed12b52786838144d1533f	dzuIfeoGOC	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794611179495
13	1db82554e5a9437d67da6e	x4EiOB9WK6	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1794611708311
14	1fed12b52786838144d1533f	dzuIfeoGOC	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1794611961300
16	sample_u_ed	sample_note_4	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794613501000
17	sample_u_mosaap	sample_note_5	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794613507224
18	1db82554e5a9437d67da6e	3BZmRkzSIt	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794613518556
19	1db82554e5a9437d67da6e	3BZmRkzSIt	612f23b9956c63ef868ebc61	زهره	pic.png	1794613923019
20	1db82554e5a9437d67da6e	NbutTDHb9u	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794615689173
21	1db82554e5a9437d67da6e	x4EiOB9WK6	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	1794616882249
22	af9114346116b469bcd1deb3	6L7xLbo6Yt	af9114346116b469bcd1deb3	علي	/pic/1794603563676_1aca1b.jpg	1794620731330
23	1db82554e5a9437d67da6e	y9OdtmzEWd	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1794676637517
24	af9114346116b469bcd1deb3	6L7xLbo6Yt	1db82554e5a9437d67da6e	مازن	/pic/1794440403648_6c221e.jpg	1794685022069
25	1db82554e5a9437d67da6e	NbutTDHb9u	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	1794699566249
\.


--
-- Data for Name: sub; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sub (id, iduser, sub, topic, topic1, timestart, timefinish, timeis) FROM stdin;
1	5	admin	medo	medo	1777697292790	1777697292780	0
2	8	Hide	مازن	مازن	1794441484910	1797033484910	30
4	21	ترقية ذهبية	زهره	زهره	1794593313042	1797185313042	30
3	2	chatmaster	safari2023	seohost	1794614996638	1797206996638	30
\.


--
-- Data for Name: top10wall; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.top10wall (id, uid, otype, pic, topic) FROM stdin;
1	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
2	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
3	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
4	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
5	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
6	kli4vc4f25x10d0a3qs4y32sbz8vv5b	comment	/pic/1771634698757.jpg	admin
7	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
8	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
9	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
10	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
11	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
12	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
13	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
14	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
15	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
16	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
17	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
18	kli4vc4f25x10d0a3qs4y32sbz8vv5b	comment	/pic/1771634698757.jpg	admin
19	kli4vc4f25x10d0a3qs4y32sbz8vv5b	comment	/pic/1771634698757.jpg	admin
20	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
21	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
22	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
23	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
24	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
25	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
26	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
27	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
28	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
29	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
30	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
31	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
32	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
33	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
34	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
35	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
36	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
37	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
38	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
39	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
40	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
41	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
42	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
43	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
44	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
45	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
46	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
47	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
48	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
49	kli4vc4f25x10d0a3qs4y32sbz8vv5b	comment	/pic/1771634698757.jpg	admin
50	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
51	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
52	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
53	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
54	kli4vc4f25x10d0a3qs4y32sbz8vv5b	comment	/pic/1771634698757.jpg	admin
55	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
56	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
57	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
58	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
59	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
60	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
61	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
62	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
63	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
64	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
65	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
66	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
67	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
68	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
69	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
70	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
71	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
72	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
73	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
74	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
75	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
76	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
77	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
78	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
79	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
80	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
81	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
82	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
83	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
84	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
85	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
86	z7fwmux1g29vwcpjx77z35ffi10itdx	comment	/pic/1773376784089.jpg	medo
87	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
88	z7fwmux1g29vwcpjx77z35ffi10itdx	comment	/pic/1773376784089.jpg	medo
89	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
90	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
91	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
92	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
93	z7fwmux1g29vwcpjx77z35ffi10itdx	comment	/pic/1773376784089.jpg	medo
94	z7fwmux1g29vwcpjx77z35ffi10itdx	comment	/pic/1773376784089.jpg	medo
95	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
96	z7fwmux1g29vwcpjx77z35ffi10itdx	comment	/pic/1773376784089.jpg	medo
97	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
98	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
99	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
100	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
101	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
102	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
103	z7fwmux1g29vwcpjx77z35ffi10itdx	comment	/pic/1773376784089.jpg	medo
104	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
105	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
106	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
107	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
108	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
109	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
110	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
111	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
112	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
113	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
114	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
115	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
116	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
117	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
118	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
119	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
120	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
121	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
122	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
123	kli4vc4f25x10d0a3qs4y32sbz8vv5b	msg	/pic/1771634698757.jpg	admin
124	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
125	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
126	z7fwmux1g29vwcpjx77z35ffi10itdx	msg	/pic/1773376784089.jpg	medo
127	z7fwmux1g29vwcpjx77z35ffi10itdx	like	/pic/1773376784089.jpg	medo
128	kli4vc4f25x10d0a3qs4y32sbz8vv5b	like	/pic/1771634698757.jpg	admin
130	ormtckbsh8x0plk7e45tggph562lufc	bc	pic.png	seohost
131	ormtckbsh8x0plk7e45tggph562lufc	bc	pic.png	seohost
132	ormtckbsh8x0plk7e45tggph562lufc	bc	pic.png	seohost
133	ormtckbsh8x0plk7e45tggph562lufc	bc	pic.png	seohost
134	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
135	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
136	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
137	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
138	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
139	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
140	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
141	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
142	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
143	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
144	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
145	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
146	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
147	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
148	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
149	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
150	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
151	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
152	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
153	ormtckbsh8x0plk7e45tggph562lufc	bc	/pic/1794512127060_378568.jpg	seohostseohost
154	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
155	ormtckbsh8x0plk7e45tggph562lufc	bc	/pic/1794512127060_378568.jpg	seohostseohost
156	ormtckbsh8x0plk7e45tggph562lufc	bc	/pic/1794512127060_378568.jpg	seohostseohost
157	ormtckbsh8x0plk7e45tggph562lufc	bc	/pic/1794512127060_378568.jpg	seohostseohost
158	867bc01476cd530af6d27b5bad66933	bc	/pic/1794440403648_6c221e.jpg	مازن
159	ormtckbsh8x0plk7e45tggph562lufc	bc	/pic/1794512127060_378568.jpg	seohostseohost
160	ormtckbsh8x0plk7e45tggph562lufc	bc	/pic/1794512127060_378568.jpg	seohostseohost
161	ormtckbsh8x0plk7e45tggph562lufc	bc	/pic/1794512127060_378568.jpg	seohostseohost
\.


--
-- Data for Name: topup_order_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topup_order_events (id, order_id, order_no, event_type, old_status, new_status, actor_type, actor_id, note, created_at) FROM stdin;
7	4	TP1794619303384B93406	created		pending	user	#22 علي	وسيلة الدفع: محفظة جيب | سعر الباقة: 10 USD | عمولة الوكيل: 1 USD | عمولة كوين للوكيل: 10 | تم حجز 100 coin من رصيد الوكيل | المرجع: 123456 | سند مرفق | تم التحويل	1794619303384
8	4	TP1794619303384B93406	approved	pending	approved	agent	AG2CCF562E6E medos	الحجز قبل الاعتماد: 100 | الحجز بعد الاعتماد: 0	1794619374614
9	5	TP17946200902571A1AE6	created		pending	user	#22 علي	وسيلة الدفع: محفظة جيب | سعر الباقة: 20 SAR | عمولة الوكيل: 2 SAR | عمولة كوين للوكيل: 10000 | تم حجز 100000 coin من رصيد الوكيل | المرجع: 123456 | سند مرفق | 123456	1794620090257
10	5	TP17946200902571A1AE6	approved	pending	approved	owner	#8 مازن	الحجز قبل الاعتماد: 100000 | الحجز بعد الاعتماد: 0	1794620122040
\.


--
-- Data for Name: topup_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topup_orders (id, order_no, user_uid, user_idreg, user_topic, user_username, agent_id, agent_code, agent_name, agent_phone, agent_country_code, agent_city, package_id, package_title, package_coins, package_price_local, customer_price_local, agent_profit_local, agent_commission_type, agent_commission_value, currency, package_country_code, package_city, payment_method_id, payment_method_name, payment_method_account_name, payment_method_identifier, receipt_path, receipt_uploaded_at, payment_reference, payment_note, status, processed_by, processed_note, reject_reason, requested_at, processed_at, source_ip, agent_commission_coins) FROM stdin;
4	TP1794619303384B93406	af9114346116b469bcd1deb3	22	علي	علي	2	AG2CCF562E6E	Mohammed		SA		2	باقة البدايه	100	10.0000	10.0000	1.0000	percent	10.0000	USD	SA		2	محفظة جيب	محمد عبدالعزيز محمد احمد القباطي	780780525	/topup_receipts/topup-1794619287575-6f8820fe.jpg	1794619303384	123456	تم التحويل	approved	AG2CCF562E6E medos			1794619303384	1794619374614	127.0.0.1	10
5	TP17946200902571A1AE6	af9114346116b469bcd1deb3	22	علي	علي	2	AG2CCF562E6E	Mohammed		SA		3	باقه عرض	100000	20.0000	20.0000	2.0000	percent	10.0000	SAR	SA		2	محفظة جيب	محمد عبدالعزيز محمد احمد القباطي	780780525	/topup_receipts/topup-1794619991950-d3d098af.jpg	1794620090257	123456	123456	approved	#8 مازن			1794620090257	1794620122040	127.0.0.1	10000
\.


--
-- Data for Name: topup_settlement_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topup_settlement_ledger (id, txid, order_id, order_no, event_type, agent_id, agent_name, user_uid, user_idreg, package_id, package_title, package_coins, currency, customer_price_local, site_share_local, agent_profit_local, processed_by, note, created_at) FROM stdin;
2	agent_topup_1794619374597_30e213199dd6	4	TP1794619303384B93406	topup_approved	2	Mohammed	af9114346116b469bcd1deb3	22	2	باقة البدايه	100	USD	10.0000	10.0000	1.0000	AG2CCF562E6E medos	customer=10.0000 | site_share=10.0000 | agent_profit=1.0000 | agent_commission_coins=10	1794619374614
3	topup_1794620122027_93e88f76f5c5	5	TP17946200902571A1AE6	topup_approved	2	Mohammed	af9114346116b469bcd1deb3	22	3	باقه عرض	100000	SAR	20.0000	20.0000	2.0000	#8 مازن	customer=20.0000 | site_share=20.0000 | agent_profit=2.0000 | agent_commission_coins=10000	1794620122040
\.


--
-- Data for Name: user_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_notes (id, nid, uid, author_topic, author_pic, author_ucol, author_verified, type, text, caption, audio_url, duration, tag, likes_count, comments_count, created_at) FROM stdin;
5	note_PQFVbsKZ13J8	tamxbgxn7ds9shhxgzz665	seohostseohost	/pic/1794512127060_378568.jpg	#ffffff	t	audio		موسيقى وطرب	/sendfile/1794695538985_3d0907.mp3	15	موسيقى وطرب	1	6	1794695539002
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (idreg, bg, mcol, ucol, evaluation, ico, ip, fp, id, lid, uid, msg, pic, pich, power, rep, topic, username, password, token, youtub, them, cover, "loginG", muted, documentationc, lastssen, joinuser, site_badge_id, site_badge, coins, gift_ico, gcol, last_eval_login_day, auto_power, wall_post_likes, gifts_received_count, eval_awards_json, busy, alerts, nopmcall, nopmvideocall) FROM stdin;
1	#FFFFFF	#000000	#000000	0		192.168.1.1			5ogwo9ii4vqdubv10ovnx6g2fkta8j4	qp46tzm6fb0r4h1g0468za	(عضو جديد)	pic.png	pich.png	ispower	0	mohammed	mohammed	sha1$b93f1d5c$1$0bbd5078ea2a506e2aad595bfe7b4fe3816f00c7	cf0847f86c9ca59883adf1a7732e4259				f	f	1	\N	1771634424509			0		#FFFFFF			0	0	\N	f	f	f	f
20	#FFFFFF	#000000	#000000	6		127.0.0.1	735bf07caf904c96a641dcde10db9cd2	Yc5uaV6bUne282cUAAAz	2c50fcbec5105cb3059f	1fed12b52786838144d1533f	(عضو جديد)	pic.png	pich.png		0	أمير القصص	storytester	$2a$10$9uAuP71OxtbFb8sPitSR4OXp0a1uxd6.2Mb0ipUaRvrtb2McMA6/2	278a8aa62e79b1e9c61ff07e7cfddefe				f	f	0	1794526520298	1794520286492		\N	0		#FFFFFF	2026-11-12		0	0	{"daily_login":1794520286834,"daily":{"day":"2026-11-12","amounts":{"daily_login":5,"online_duration":1}},"online_duration":1794525673080}	f	f	f	f
7	#FFFFFF	#000000	#000000	15		::1	Android.8.0.0.ehs.sxr.uhu.Chrome.izu.1nj.92e	kGO0mYRv8XU-JPiOAABL	q3lp0q4trnkk6zpunhqb07jobggjftk	4yw6hre4qx9xj6hnwdrsz8	(عضو جديد)	pic.png	pich.png		0	صالح	صالح	sha1$cefb5908$1$255571dbf56be8520bea16cb3604952eda5412ec	9abccaca9c9463d89ed02f5174e10835				f	f	0	1777709439635	1777688952886			0		#FFFFFF	2026-05-02		0	0	{"__daily":{"day":"2026-05-02","amounts":{"daily_login":5,"online_duration":10}},"daily_login":1777688953904,"online_duration":1777709439630}	f	f	f	f
6	#FFFFFF	#000000	#000000	0		::1	Android.8.0.0.4u0.iyp.ptr.Chrome.wl2.5j6.51p	1lA01NaGU8hz6CbLAABN	eiqpodczud9lwx7ic0aj1w5z1rk9gex	ox462ainhew5o88e83elq5	(عضو جديد)	/pic/1776894770113.jpg	pich.png		123123123	medo2	medo2	sha1$92a262dc$1$006cf2d9b1b3970759ac3a1598973778a324d2c8	bbe386318df88af4191b8ba981d8c4b9				f	f	0	1776895550240	1776894731915			0		#FFFFFF			0	0	\N	f	f	f	f
2	#ffffff	#0b0a0a	#f0ebeb	152		127.0.0.1	e6f918f32b93487682f287ed4bc985da	3GTKUuH2u1orSbHXAAAA	ormtckbsh8x0plk7e45tggph562lufc	tamxbgxn7ds9shhxgzz665	لست نصا يمكن ازالتة انا الفكرة لست نصا يمكن ازالتة انا الفكرة	/pic/1794512127060_378568.jpg	/pic2/1794692542577_6ed8bb.jpg	chatmaster	500000008	seohostseohost	safari2023	$2a$10$jwtu8FEXETiLyvZWTWST3eurZGd1U3gDYJdd0nwtZvNnW2t04DY/C	384b54412f87709c075e4c2d18e82117d2ac45a7079f2ad8				f	f	1	1794777006594	1771634424510			6	/gifts_git/1776445025983.jpg	#a01c1c	2026-11-15		4	6	{"__daily":{"day":"2026-11-11","amounts":{"online_duration":5,"daily_login":5}},"daily_login":1794769106352,"online_duration":1794777906707,"room_message":1794691257432,"daily":{"day":"2026-11-15","amounts":{"wall_post":3,"daily_login":5,"private_message":1,"online_duration":1}},"wall_post":1794701013411,"private_message":1794769873064,"game_win":1794698091782}	f	f	f	f
5	#FFFFFF	#000000	#1F1F1F	73	/sico/1771715317451.gif	::1	Windows.10.ot6.esb.agd.Chrome.yl3.4yc.wvn	UxEGGznAVf2-qt6gAAAF	z7fwmux1g29vwcpjx77z35ffi10itdx	pj1l22e51ih51bilghkyp0	 ، لست نصاً يمكن ازالتة انا الفكرة لست نصاً يمكن ازالتة انا الفكرة 	/pic/1773376784089.jpg	/pic2/1777688276361.jpg	admin	5500556	medo	medo	sha1$d636977e$1$99fb77bc3be261cda1ab1540fba361d6960c5a9c	881ecdfd5dbf04f26b0782b449b9c18b	rVMJH2BeW5E?si=BmqRmKJvqJblx2pv		/cover/1771636098677.gif	f	f	1	1777830607337	1772233912666	sb_1772252966823	{"id":"sb_1772252966823","name":"مالك الموقع","bg":"linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)","icon":"/room_badges/1772252964797.gif","bg_type":"animated"}	58		#FFFFFF	2026-05-03		0	6	{"__daily":{"day":"2026-05-03","amounts":{"daily_login":5,"online_duration":1}},"daily_login":1777829562045,"online_duration":1777833387520}	f	f	f	f
22	#FFFFFF	#000000	#000000	16		127.0.0.1	6e139e2f0a554fd492ba2f8de28d5235	y2CmyKzOkDkCoH5dAAAu	27ebb051fb067af3753e	af9114346116b469bcd1deb3	لست نصا يمكن ازالتة انا الفكرة لست نصا يمكن ازالتة انا الفكرة	/pic/1794603563676_1aca1b.jpg	/pic2/1794605736747_5f1e58.jpg		100001	علي	علي	$2a$10$1JQEV0.j9Uz2LYloeVlga.zpmspFtgVUxwmvZDuwKbzHntWQBixBa	bd8135c88af7b3bb99d8d5e29f4a1046				f	f	0	1794616774345	1794603250089		\N	96792		#FFFFFF	2026-11-14		0	0	{"daily_login":1794616774563,"daily":{"day":"2026-11-14","amounts":{"daily_login":5,"online_duration":5}},"online_duration":1794675766531}	f	f	f	f
4	#FFFFFF	#000000	#000000	0		192.168.1.1			c0oak2snfpgde03op0ad3x8y0ow66ka	oux7vcv2atpevurzua56w3	(عضو جديد)	pic.png	pich.png	chatmaster	0	chatmaster	chatmaster	sha1$e705b2a9$1$e8682eb5bfa27e58455fad886b4c740df0583ad3	87fc38b1d4869c243e85ea30ec47dd15				t	f	1	\N	1771634424510			0		#FFFFFF			0	0	\N	f	f	f	f
25	#FFFFFF	#000000	#000000	0		127.0.0.1	sec-test	\N	37b74ad8375e9911dc2597a4ce85e22	eae1cdd4a8709934a70359	(عضو جديد)	pic.png	pich.png		0	sectest21c63b	sectest21c63b	$2a$10$JMN7.eQqnhntus/c/iSG3etASeItLbUgwbmeK10v.AhesiaAKskZq	81bdb94748dbaa6a1caf6f47232764c0				f	f	0	1794682170748	1794682170748		\N	0		#FFFFFF			0	0	\N	f	f	f	f
8	#FFFFFF	#000000	#000000	137	dro3/1771636115918.jpg	127.0.0.1	24f7999a7dd1496d8e4b8a70e36cdbb3	QUnMisuXIOqgJXPGAAAF	867bc01476cd530af6d27b5bad66933	1db82554e5a9437d67da6e	لست نصا يمكن ازالتة انا الفكرة	/pic/1794440403648_6c221e.jpg	/pic2/1794440423293_3db5ec.jpg	Hide	100001	مازن	مازن	$2a$10$fo2QgwFrNUbgMPBwQ5GvS.GiQzqZSIK90O9k7V/xDlpUCHTIPZeQe	7322c94802836543095b28f9ee98cf0c	https://www.youtube.com/watch?v=enFeM1NXonA	1771636084601.gif	1771636098677.gif	f	f	0	1794769759465	1794422626741	sb_1772252966823	{"id":"sb_1772252966823","name":"مالك الموقع","bg":"linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)","icon":"/room_badges/1772252964797.gif","bg_type":"animated"}	1982	/gifts_git/1776445025983.jpg	#FFFFFF	2026-11-15		6	11	{"daily_login":1794769759869,"daily":{"day":"2026-11-15","amounts":{"daily_login":5,"online_duration":1}},"online_duration":1794770659879,"room_message":1794679455541,"wall_post":1794696616939,"game_win":1794524456436,"private_message":1794698849556}	t	t	f	f
9	#FFFFFF	#000000	#000000	0		127.0.0.1	Win32	IfM7Vye89nuA6P0mAAAK	3c4e7f876e8e71fb094889a5d84d7f6	8d79228f9d305c993f5cf2	(عضو جديد)	pic.png	pich.png		1	نيمار	نيمار	$2a$10$8JuzPt5nNbpzRXbZi9JZHuHOku2zSYQtaQE0jzh.iQCAbtvkaGdvC	5baa75efdc5fa5bb8835eb2a2408c260				f	f	0	1794425337963	1794425337963		\N	0		#FFFFFF			0	0	\N	f	f	f	f
21	#FFFFFF	#000000	#000000	68	1771636115918.jpg	127.0.0.1	298f979c63944e029ad50c05f36651bc	oKLq1F6QdOiTIdUPAAAp	939f3cfddc378594d1e1	612f23b9956c63ef868ebc61	(عضو جديد)	pic.png	pich.png	ترقية ذهبية	10001	زهره	زهره	$2a$10$L0Bp0pJB2AF41ouWyqV3VuF0L.T3o/AoTQ6CbN8d4aRug7T3PmDpm	a7c3d7c1e15e90a0d5f629a479652532				f	f	0	1794615288953	1794522409475		\N	0		#FFFFFF	2026-11-14		0	0	{"daily_login":1794615246730,"daily":{"day":"2026-11-14","amounts":{"daily_login":5,"private_message":1}},"room_message":1794613711142,"game_win":1794524562140,"online_duration":1794526323290,"private_message":1794615318377}	f	f	f	f
3	#FFFFFF	#000000	#000000	80	/gifts_git/1776445025983.jpg	::1	Windows.10.t7a.gvg.por.Chrome.e4r.pf2.l4x	FTG5_5xnwYFGl-LyAAB7	kli4vc4f25x10d0a3qs4y32sbz8vv5b	5i8j4dzvrmg6w7l3nw4rvy	 لست نصاً يمكن ازالتة انا الفكرة لست نصاً يمكن ازالتة انا الفكرة 	/pic/1771634698757.jpg	/pic2/1771634702184.jpg	chatmaster	3232655673	admin	chatmaster11	sha1$1a0cc4ec$1$1e81835d762585d6f166c655d2f775b6e518d6fe	40a6d8b47a50d59e6cf15881619bf7f9	z6PxTtWGLSg?si=QV3US8UyZz8RDDT_			t	f	1	1777587049404	1771634424510	sb_1772252966823	{"id":"sb_1772252966823","name":"مالك الموقع","bg":"linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)","icon":"/room_badges/1772252964797.gif","bg_type":"animated"}	7	/dro3/1771636115918.jpg	#FFFFFF	2026-04-30		0	7	\N	f	f	f	f
24	#FFFFFF	#000000	#000000	0		127.0.0.1	sec-test	\N	24a0ebc143a95844c03148d973231d1	b429d50f74050932fa56f4	(عضو جديد)	pic.png	pich.png		0	sectestb048fb	sectestb048fb	$2a$10$zfRPjzweE14fRBZoX6w6Fe2H.7tqDu9e3HYm0tAFrsKGonuNJFyhu	14539db0dd04d3accce88aef3434807a				f	f	0	1794682137909	1794682137909		\N	0		#FFFFFF			0	0	\N	f	f	f	f
23	#FFFFFF	#000000	#000000	0		127.0.0.1	sec-test	\N	63bcbb95320be58b7f66a8dbd3295d4	48dfb865a8e28f11d4e129	(عضو جديد)	pic.png	pich.png		0	sectest0d17e5	sectest0d17e5	$2a$10$woqtJqejAnfXZeENmnngs.9AHIrQttL2omkY.W42ltU7/crz2yfw2	fc6a665f56db02b0fc5452e6bd2fe19e				f	f	0	1794682126415	1794682126415		\N	0		#FFFFFF			0	0	\N	f	f	f	f
\.


--
-- Name: agent_payment_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_payment_methods_id_seq', 2, true);


--
-- Name: agent_wallet_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_wallet_ledger_id_seq', 9, true);


--
-- Name: agent_wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_wallets_id_seq', 2, true);


--
-- Name: agents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agents_id_seq', 2, true);


--
-- Name: band_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.band_id_seq', 2, true);


--
-- Name: bars_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bars_id_seq', 131, true);


--
-- Name: bots_idreg_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bots_idreg_seq', 501, true);


--
-- Name: bsb_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bsb_id_seq', 1, true);


--
-- Name: coin_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coin_ledger_id_seq', 65, true);


--
-- Name: coin_packages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coin_packages_id_seq', 3, true);


--
-- Name: cuts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cuts_id_seq', 2, true);


--
-- Name: followers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.followers_id_seq', 24, true);


--
-- Name: gift_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.gift_notifications_id_seq', 31, true);


--
-- Name: histletter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.histletter_id_seq', 8, true);


--
-- Name: hosts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hosts_id_seq', 1, true);


--
-- Name: internal_mail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.internal_mail_id_seq', 8, true);


--
-- Name: intromsg_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.intromsg_id_seq', 2, true);


--
-- Name: logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.logs_id_seq', 171, true);


--
-- Name: names_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.names_id_seq', 158, true);


--
-- Name: note_comment_likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.note_comment_likes_id_seq', 4, true);


--
-- Name: note_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.note_comments_id_seq', 9, true);


--
-- Name: note_likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.note_likes_id_seq', 7, true);


--
-- Name: notext_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notext_id_seq', 7, true);


--
-- Name: owner_agent_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.owner_agent_transfers_id_seq', 3, true);


--
-- Name: owner_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.owner_id_seq', 1, true);


--
-- Name: powers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.powers_id_seq', 1, true);


--
-- Name: profile_visits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.profile_visits_id_seq', 228, true);


--
-- Name: room_welcome_visits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.room_welcome_visits_id_seq', 83, true);


--
-- Name: rooms_idroom_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rooms_idroom_seq', 18, true);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settings_id_seq', 1, true);


--
-- Name: site_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.site_id_seq', 1, true);


--
-- Name: site_master_wallet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.site_master_wallet_id_seq', 39, true);


--
-- Name: site_master_wallet_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.site_master_wallet_ledger_id_seq', 11, true);


--
-- Name: stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stats_id_seq', 411, true);


--
-- Name: storie_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.storie_id_seq', 9, true);


--
-- Name: storieview_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.storieview_id_seq', 77, true);


--
-- Name: story_comment_likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.story_comment_likes_id_seq', 6, true);


--
-- Name: story_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.story_comments_id_seq', 22, true);


--
-- Name: story_likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.story_likes_id_seq', 25, true);


--
-- Name: sub_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sub_id_seq', 4, true);


--
-- Name: top10wall_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.top10wall_id_seq', 161, true);


--
-- Name: topup_order_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.topup_order_events_id_seq', 10, true);


--
-- Name: topup_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.topup_orders_id_seq', 5, true);


--
-- Name: topup_settlement_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.topup_settlement_ledger_id_seq', 3, true);


--
-- Name: user_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_notes_id_seq', 5, true);


--
-- Name: users_idreg_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_idreg_seq', 25, true);


--
-- Name: agent_payment_methods agent_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_payment_methods
    ADD CONSTRAINT agent_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: agent_wallet_ledger agent_wallet_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_wallet_ledger
    ADD CONSTRAINT agent_wallet_ledger_pkey PRIMARY KEY (id);


--
-- Name: agent_wallets agent_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_wallets
    ADD CONSTRAINT agent_wallets_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: band band_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.band
    ADD CONSTRAINT band_pkey PRIMARY KEY (id);


--
-- Name: bars bars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bars
    ADD CONSTRAINT bars_pkey PRIMARY KEY (id);


--
-- Name: bots bots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bots
    ADD CONSTRAINT bots_pkey PRIMARY KEY (idreg);


--
-- Name: bsb bsb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsb
    ADD CONSTRAINT bsb_pkey PRIMARY KEY (id);


--
-- Name: coin_ledger coin_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_ledger
    ADD CONSTRAINT coin_ledger_pkey PRIMARY KEY (id);


--
-- Name: coin_packages coin_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_packages
    ADD CONSTRAINT coin_packages_pkey PRIMARY KEY (id);


--
-- Name: cuts cuts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuts
    ADD CONSTRAINT cuts_pkey PRIMARY KEY (id);


--
-- Name: followers followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_pkey PRIMARY KEY (id);


--
-- Name: gift_notifications gift_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_notifications
    ADD CONSTRAINT gift_notifications_pkey PRIMARY KEY (id);


--
-- Name: histletter histletter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.histletter
    ADD CONSTRAINT histletter_pkey PRIMARY KEY (id);


--
-- Name: hosts hosts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosts
    ADD CONSTRAINT hosts_pkey PRIMARY KEY (id);


--
-- Name: internal_mail internal_mail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_mail
    ADD CONSTRAINT internal_mail_pkey PRIMARY KEY (id);


--
-- Name: intromsg intromsg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intromsg
    ADD CONSTRAINT intromsg_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: names names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.names
    ADD CONSTRAINT names_pkey PRIMARY KEY (id);


--
-- Name: note_comment_likes note_comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_comment_likes
    ADD CONSTRAINT note_comment_likes_pkey PRIMARY KEY (id);


--
-- Name: note_comments note_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_comments
    ADD CONSTRAINT note_comments_pkey PRIMARY KEY (id);


--
-- Name: note_likes note_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_likes
    ADD CONSTRAINT note_likes_pkey PRIMARY KEY (id);


--
-- Name: notext notext_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notext
    ADD CONSTRAINT notext_pkey PRIMARY KEY (id);


--
-- Name: owner_agent_transfers owner_agent_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_agent_transfers
    ADD CONSTRAINT owner_agent_transfers_pkey PRIMARY KEY (id);


--
-- Name: owner owner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner
    ADD CONSTRAINT owner_pkey PRIMARY KEY (id);


--
-- Name: powers powers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.powers
    ADD CONSTRAINT powers_pkey PRIMARY KEY (id);


--
-- Name: profile_visits profile_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_visits
    ADD CONSTRAINT profile_visits_pkey PRIMARY KEY (id);


--
-- Name: room_welcome_visits room_welcome_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_welcome_visits
    ADD CONSTRAINT room_welcome_visits_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (idroom);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: site_master_wallet_ledger site_master_wallet_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_master_wallet_ledger
    ADD CONSTRAINT site_master_wallet_ledger_pkey PRIMARY KEY (id);


--
-- Name: site_master_wallet site_master_wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_master_wallet
    ADD CONSTRAINT site_master_wallet_pkey PRIMARY KEY (id);


--
-- Name: site site_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site
    ADD CONSTRAINT site_pkey PRIMARY KEY (id);


--
-- Name: stats stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats
    ADD CONSTRAINT stats_pkey PRIMARY KEY (id);


--
-- Name: storie storie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storie
    ADD CONSTRAINT storie_pkey PRIMARY KEY (id);


--
-- Name: storieview storieview_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storieview
    ADD CONSTRAINT storieview_pkey PRIMARY KEY (id);


--
-- Name: story_comment_likes story_comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comment_likes
    ADD CONSTRAINT story_comment_likes_pkey PRIMARY KEY (id);


--
-- Name: story_comments story_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comments
    ADD CONSTRAINT story_comments_pkey PRIMARY KEY (id);


--
-- Name: story_likes story_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_likes
    ADD CONSTRAINT story_likes_pkey PRIMARY KEY (id);


--
-- Name: sub sub_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub
    ADD CONSTRAINT sub_pkey PRIMARY KEY (id);


--
-- Name: top10wall top10wall_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.top10wall
    ADD CONSTRAINT top10wall_pkey PRIMARY KEY (id);


--
-- Name: topup_order_events topup_order_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_order_events
    ADD CONSTRAINT topup_order_events_pkey PRIMARY KEY (id);


--
-- Name: topup_orders topup_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_orders
    ADD CONSTRAINT topup_orders_pkey PRIMARY KEY (id);


--
-- Name: topup_settlement_ledger topup_settlement_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_settlement_ledger
    ADD CONSTRAINT topup_settlement_ledger_pkey PRIMARY KEY (id);


--
-- Name: user_notes user_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (idreg);


--
-- Name: idx_agent_wallets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_wallets_status ON public.agent_wallets USING btree (status);


--
-- Name: idx_agents_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_country ON public.agents USING btree (country_code);


--
-- Name: idx_agents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_status ON public.agents USING btree (status);


--
-- Name: idx_apm_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apm_active ON public.agent_payment_methods USING btree (is_active);


--
-- Name: idx_apm_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apm_agent ON public.agent_payment_methods USING btree (agent_id);


--
-- Name: idx_awl_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_awl_agent ON public.agent_wallet_ledger USING btree (agent_id, created_at);


--
-- Name: idx_awl_txid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_awl_txid ON public.agent_wallet_ledger USING btree (txid);


--
-- Name: idx_band_country_band; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_band_country_band ON public.band USING btree (country_band);


--
-- Name: idx_band_decoderDans; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_band_decoderDans" ON public.band USING btree ("decoderDans");


--
-- Name: idx_band_device_band; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_band_device_band ON public.band USING btree (device_band);


--
-- Name: idx_band_ip_band; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_band_ip_band ON public.band USING btree (ip_band);


--
-- Name: idx_band_name_band; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_band_name_band ON public.band USING btree (name_band);


--
-- Name: idx_bars_bid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bars_bid ON public.bars USING btree (bid);


--
-- Name: idx_bars_lid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bars_lid ON public.bars USING btree (lid);


--
-- Name: idx_bars_lid_bid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bars_lid_bid ON public.bars USING btree (lid, bid);


--
-- Name: idx_bars_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bars_uid ON public.bars USING btree (uid);


--
-- Name: idx_bots_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bots_id ON public.bots USING btree (id);


--
-- Name: idx_bots_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bots_room ON public.bots USING btree (room);


--
-- Name: idx_bots_stat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bots_stat ON public.bots USING btree (stat);


--
-- Name: idx_coin_ledger_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_ledger_created_at ON public.coin_ledger USING btree (created_at);


--
-- Name: idx_coin_ledger_txid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_ledger_txid ON public.coin_ledger USING btree (txid);


--
-- Name: idx_coin_ledger_user_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_ledger_user_uid ON public.coin_ledger USING btree (user_uid, created_at);


--
-- Name: idx_cp_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_active_sort ON public.coin_packages USING btree (is_active, sort_order);


--
-- Name: idx_cp_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_country ON public.coin_packages USING btree (country_code);


--
-- Name: idx_cuts_text1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cuts_text1 ON public.cuts USING btree (text1);


--
-- Name: idx_followers_follower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followers_follower ON public.followers USING btree (follower_id);


--
-- Name: idx_followers_following; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followers_following ON public.followers USING btree (following_id);


--
-- Name: idx_gift_notif_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_notif_created_at ON public.gift_notifications USING btree (created_at);


--
-- Name: idx_gift_notif_to_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_notif_to_uid ON public.gift_notifications USING btree (to_uid, is_read, created_at);


--
-- Name: idx_gift_notif_txid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_notif_txid ON public.gift_notifications USING btree (txid);


--
-- Name: idx_histletter_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_histletter_ip ON public.histletter USING btree (ip);


--
-- Name: idx_histletter_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_histletter_topic ON public.histletter USING btree (topic);


--
-- Name: idx_hosts_hostname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hosts_hostname ON public.hosts USING btree (hostname);


--
-- Name: idx_hosts_setting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hosts_setting ON public.hosts USING btree (setting);


--
-- Name: idx_intromsg_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intromsg_category ON public.intromsg USING btree (category);


--
-- Name: idx_logs_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_ip ON public.logs USING btree (ip);


--
-- Name: idx_logs_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_lookup ON public.logs USING btree (ip, state, topic, username);


--
-- Name: idx_logs_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_state ON public.logs USING btree (state);


--
-- Name: idx_mail_from_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mail_from_uid ON public.internal_mail USING btree (from_uid);


--
-- Name: idx_mail_to_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mail_to_uid ON public.internal_mail USING btree (to_uid, is_read, created_at);


--
-- Name: idx_names_fp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_names_fp ON public.names USING btree (fp);


--
-- Name: idx_names_iduser; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_names_iduser ON public.names USING btree (iduser);


--
-- Name: idx_names_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_names_ip ON public.names USING btree (ip);


--
-- Name: idx_note_comment_likes_cid_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_comment_likes_cid_user ON public.note_comment_likes USING btree (comment_cid, user_uid);


--
-- Name: idx_note_comments_cid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_comments_cid ON public.note_comments USING btree (cid);


--
-- Name: idx_note_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_comments_parent ON public.note_comments USING btree (parent_cid);


--
-- Name: idx_note_comments_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_comments_target ON public.note_comments USING btree (note_nid, created_at DESC);


--
-- Name: idx_note_likes_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_likes_target ON public.note_likes USING btree (note_nid);


--
-- Name: idx_note_likes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_likes_user ON public.note_likes USING btree (note_nid, user_uid);


--
-- Name: idx_notext_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notext_path ON public.notext USING btree (path);


--
-- Name: idx_notext_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notext_type ON public.notext USING btree (type);


--
-- Name: idx_oat_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oat_agent ON public.owner_agent_transfers USING btree (agent_id, created_at);


--
-- Name: idx_oat_txid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oat_txid ON public.owner_agent_transfers USING btree (txid);


--
-- Name: idx_owner_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_owner_room ON public.owner USING btree (room);


--
-- Name: idx_profile_visits_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_visits_owner ON public.profile_visits USING btree (owner_id);


--
-- Name: idx_profile_visits_owner_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_visits_owner_seen ON public.profile_visits USING btree (owner_id, seen, "time");


--
-- Name: idx_profile_visits_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_visits_visitor ON public.profile_visits USING btree (visitor_id);


--
-- Name: idx_room_welcome_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_welcome_room ON public.room_welcome_visits USING btree (room_id);


--
-- Name: idx_rooms_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_id ON public.rooms USING btree (id);


--
-- Name: idx_rooms_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_owner ON public.rooms USING btree (owner);


--
-- Name: idx_rooms_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_topic ON public.rooms USING btree (topic);


--
-- Name: idx_site_host; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_host ON public.site USING btree (host);


--
-- Name: idx_site_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_ids ON public.site USING btree (ids);


--
-- Name: idx_smwl_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smwl_site ON public.site_master_wallet_ledger USING btree (site_id, created_at);


--
-- Name: idx_smwl_txid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smwl_txid ON public.site_master_wallet_ledger USING btree (txid);


--
-- Name: idx_stats_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stats_ip ON public.stats USING btree (ip);


--
-- Name: idx_stats_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stats_room ON public.stats USING btree (room);


--
-- Name: idx_stats_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stats_time ON public.stats USING btree ("time");


--
-- Name: idx_storie_sid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storie_sid ON public.storie USING btree (sid);


--
-- Name: idx_storieview_idsto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storieview_idsto ON public.storieview USING btree (idsto);


--
-- Name: idx_storieview_sid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storieview_sid ON public.storieview USING btree (sid);


--
-- Name: idx_story_comment_likes_cid_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_comment_likes_cid_user ON public.story_comment_likes USING btree (comment_cid, user_uid);


--
-- Name: idx_story_comments_cid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_comments_cid ON public.story_comments USING btree (cid);


--
-- Name: idx_story_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_comments_parent ON public.story_comments USING btree (parent_cid);


--
-- Name: idx_story_comments_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_comments_target ON public.story_comments USING btree (story_sid, item_id, created_at);


--
-- Name: idx_story_likes_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_likes_target ON public.story_likes USING btree (story_sid, item_id);


--
-- Name: idx_story_likes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_likes_user ON public.story_likes USING btree (story_sid, item_id, user_uid);


--
-- Name: idx_sub_iduser; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_iduser ON public.sub USING btree (iduser);


--
-- Name: idx_sub_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_sub ON public.sub USING btree (sub);


--
-- Name: idx_sub_timefinish; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_timefinish ON public.sub USING btree (timefinish);


--
-- Name: idx_toe_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_toe_created_at ON public.topup_order_events USING btree (created_at);


--
-- Name: idx_toe_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_toe_order_id ON public.topup_order_events USING btree (order_id);


--
-- Name: idx_top10wall_otype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_top10wall_otype ON public.top10wall USING btree (otype);


--
-- Name: idx_top10wall_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_top10wall_uid ON public.top10wall USING btree (uid);


--
-- Name: idx_topup_orders_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topup_orders_agent_id ON public.topup_orders USING btree (agent_id);


--
-- Name: idx_topup_orders_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topup_orders_requested_at ON public.topup_orders USING btree (requested_at);


--
-- Name: idx_topup_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topup_orders_status ON public.topup_orders USING btree (status);


--
-- Name: idx_topup_orders_user_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topup_orders_user_uid ON public.topup_orders USING btree (user_uid);


--
-- Name: idx_tsl_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tsl_agent ON public.topup_settlement_ledger USING btree (agent_id);


--
-- Name: idx_tsl_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tsl_created_at ON public.topup_settlement_ledger USING btree (created_at);


--
-- Name: idx_tsl_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tsl_order ON public.topup_settlement_ledger USING btree (order_id);


--
-- Name: idx_tsl_txid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tsl_txid ON public.topup_settlement_ledger USING btree (txid);


--
-- Name: idx_user_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_created_at ON public.user_notes USING btree (created_at DESC);


--
-- Name: idx_user_notes_nid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_nid ON public.user_notes USING btree (nid);


--
-- Name: idx_user_notes_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_uid ON public.user_notes USING btree (uid);


--
-- Name: idx_users_eval_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_eval_desc ON public.users USING btree (evaluation);


--
-- Name: idx_users_fp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_fp ON public.users USING btree (fp);


--
-- Name: idx_users_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_ip ON public.users USING btree (ip);


--
-- Name: idx_users_lid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_lid ON public.users USING btree (lid);


--
-- Name: idx_users_rep_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_rep_desc ON public.users USING btree (rep);


--
-- Name: idx_users_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_token ON public.users USING btree (token);


--
-- Name: idx_users_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_topic ON public.users USING btree (topic);


--
-- Name: idx_users_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_uid ON public.users USING btree (uid);


--
-- Name: uniq_agent_wallets_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_agent_wallets_agent ON public.agent_wallets USING btree (agent_id);


--
-- Name: uniq_agents_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_agents_code ON public.agents USING btree (code);


--
-- Name: uniq_agents_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_agents_username ON public.agents USING btree (username);


--
-- Name: uniq_followers_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_followers_pair ON public.followers USING btree (follower_id, following_id);


--
-- Name: uniq_room_welcome_visit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_room_welcome_visit ON public.room_welcome_visits USING btree (room_id, identity_key);


--
-- Name: uniq_site_master_wallet_site; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_site_master_wallet_site ON public.site_master_wallet USING btree (site_id);


--
-- Name: uniq_topup_orders_order_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_topup_orders_order_no ON public.topup_orders USING btree (order_no);


--
-- Name: uniq_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_users_username ON public.users USING btree (username);


--
-- PostgreSQL database dump complete
--

\unrestrict S3d3g3lvjLmERzpkpsj34uefQfqNkf5TCkx6HUCSSShp2eH4d8BbEs14h44e5IH


import { INCOMING_CMDS, OUTGOING_CMDS, SOCKET_EVENTS } from "../packages/shared/src/events.js";
import * as dbSchema from "../packages/db/src/schema/index.js";

const expectedTables = [
  "users",
  "names",
  "followers",
  "profile_visits",
  "sub",
  "rooms",
  "room_welcome_visits",
  "bots",
  "bars",
  "storie",
  "storieview",
  "top10wall",
  "internal_mail",
  "intromsg",
  "coin_ledger",
  "gift_notifications",
  "site_master_wallet",
  "site_master_wallet_ledger",
  "agents",
  "agent_wallets",
  "agent_wallet_ledger",
  "owner_agent_transfers",
  "coin_packages",
  "topup_orders",
  "topup_order_events",
  "agent_payment_methods",
  "topup_settlement_ledger",
  "owner",
  "site",
  "hosts",
  "settings",
  "powers",
  "band",
  "bsb",
  "cuts",
  "notext",
  "histletter",
  "logs",
  "stats",
];

const missingTables = expectedTables.filter((t) => !(t in dbSchema));

console.log("=== NewChat Parity Check ===");
console.log(`SOCKET_EVENTS: ${SOCKET_EVENTS.length}`);
console.log(`INCOMING_CMDS: ${INCOMING_CMDS.length}`);
console.log(`OUTGOING_CMDS: ${OUTGOING_CMDS.length}`);
console.log(`PostgreSQL Tables: ${expectedTables.length - missingTables.length}/${expectedTables.length}`);

if (missingTables.length > 0) {
  console.error("Missing tables in schema:", missingTables);
  process.exit(1);
}
console.log("Parity check passed cleanly!");

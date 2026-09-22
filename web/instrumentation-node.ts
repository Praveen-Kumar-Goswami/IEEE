import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";

// The Lambda function URL resolves to eight IPv6 and six IPv4 addresses. With Node's
// happy-eyeballs selection every proxied request spent ~4 s connecting; IPv4 first
// without auto-selection connects in under a second.
setDefaultAutoSelectFamily(false);
setDefaultResultOrder("ipv4first");

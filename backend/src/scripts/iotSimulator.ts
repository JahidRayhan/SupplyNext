// Fake IoT device — we don't have real hardware for this pilot, so this script
// logs in as a logistics coordinator and pretends to be one. Pending shipments
// occasionally get a dispatch scan (auto-advances to in_transit), in_transit
// shipments get GPS pings walking toward a made-up destination until they "arrive"
// and get marked delivered. Coordinates are fake, there's no real geodata.
//
// usage: npm run simulate
//        API_BASE_URL=https://your-backend.onrender.com npm run simulate

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const SIMULATOR_EMAIL = process.env.SIMULATOR_EMAIL ?? "rafiqul.islam@supplynext.com";
const SIMULATOR_PASSWORD = process.env.SIMULATOR_PASSWORD ?? "SDCIP-Pilot-2026";
const TICK_MS = process.env.SIMULATOR_TICK_MS ? Number(process.env.SIMULATOR_TICK_MS) : 5000;

interface Shipment {
  id: string;
  sku: string;
  status: "pending" | "in_transit" | "delivered" | "delayed";
}

// fake origin point (Dhaka-ish) and a per-shipment fake destination
const ORIGIN = { lat: 23.8103, lng: 90.4125 };

function destinationFor(shipmentId: string): { lat: number; lng: number } {
  // dumb hash so each shipment always gets the same fake destination
  let h = 0;
  for (const ch of shipmentId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const lat = 22.3 + (h % 1000) / 1000; // ~22.3–23.3
  const lng = 89.0 + ((h >> 10) % 1000) / 1000; // ~89.0–90.0
  return { lat, lng };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

let token: string;

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  return body;
}

async function login(): Promise<void> {
  const { token: t } = await api("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: SIMULATOR_EMAIL, password: SIMULATOR_PASSWORD }),
  });
  token = t;
  console.log(`[simulator] logged in as ${SIMULATOR_EMAIL}, posting to ${API_BASE_URL}`);
}

// tracked in memory only, resets if the script restarts
const progress = new Map<string, number>();

function log(msg: string) {
  console.log(`[simulator] ${new Date().toISOString()} ${msg}`);
}

async function tick(): Promise<void> {
  let shipments: Shipment[];
  try {
    shipments = await api("/api/v1/shipments");
  } catch (err: any) {
    log(`could not fetch shipments: ${err.message}`);
    return;
  }

  for (const shipment of shipments) {
    if (shipment.status === "delivered" || shipment.status === "delayed") continue;

    if (shipment.status === "pending") {
      // 40% chance a pending shipment gets its dispatch scan this tick
      if (Math.random() < 0.4) {
        try {
          await api("/api/v1/iot/events", {
            method: "POST",
            body: JSON.stringify({
              deviceId: "RFID-GATE-SIM",
              eventType: "rfid_scan",
              sku: shipment.sku,
              shipmentId: shipment.id,
            }),
          });
          log(`${shipment.id} dispatch scan → auto-advanced to in_transit`);
        } catch (err: any) {
          log(`${shipment.id} rfid_scan failed: ${err.message}`);
        }
      }
      continue;
    }

    if (shipment.status === "in_transit") {
      const p = Math.min(1, (progress.get(shipment.id) ?? 0) + 0.08 + Math.random() * 0.12);
      progress.set(shipment.id, p);

      const dest = destinationFor(shipment.id);
      const lat = Math.round(lerp(ORIGIN.lat, dest.lat, p) * 10000) / 10000;
      const lng = Math.round(lerp(ORIGIN.lng, dest.lng, p) * 10000) / 10000;

      try {
        await api("/api/v1/iot/events", {
          method: "POST",
          body: JSON.stringify({
            deviceId: "GPS-TRK-SIM",
            eventType: "gps_ping",
            shipmentId: shipment.id,
            latitude: lat,
            longitude: lng,
          }),
        });
        log(`${shipment.id} gps_ping (${lat}, ${lng}) — ${Math.round(p * 100)}% of the way there`);
      } catch (err: any) {
        log(`${shipment.id} gps_ping failed: ${err.message}`);
      }

      // random temp/humidity reading, just for variety
      if (Math.random() < 0.25) {
        const eventType = Math.random() < 0.5 ? "temperature" : "humidity";
        const value = eventType === "temperature" ? Math.round((28 + Math.random() * 8) * 10) / 10 : Math.round(50 + Math.random() * 30);
        try {
          await api("/api/v1/iot/events", {
            method: "POST",
            body: JSON.stringify({ deviceId: "COND-SENSOR-SIM", eventType, shipmentId: shipment.id, value }),
          });
        } catch {
          // non-critical, don't spam the log for this one
        }
      }

      if (p >= 1) {
        try {
          await api(`/api/v1/shipments/${shipment.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "delivered", actualDelivery: new Date().toISOString().slice(0, 10) }),
          });
          log(`${shipment.id} arrived → marked delivered`);
          progress.delete(shipment.id);
        } catch (err: any) {
          log(`${shipment.id} delivery update failed: ${err.message}`);
        }
      }
    }
  }
}

async function main() {
  await login();
  log(`ticking every ${TICK_MS}ms — Ctrl+C to stop`);
  await tick();
  const interval = setInterval(tick, TICK_MS);

  process.on("SIGINT", () => {
    clearInterval(interval);
    log("stopped.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[simulator] fatal:", err.message);
  process.exit(1);
});

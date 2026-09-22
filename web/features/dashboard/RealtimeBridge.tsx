"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ALERT_TYPE_LABEL } from "@/lib/domain/labels";
import { getDemoState, type DemoTopic } from "@/services/data/demo/state";
import { useLiveStore } from "@/stores/live";
import { toast } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";
import { useWorkspace } from "./context";

/** Query roots each demo topic affects. Supabase realtime events map onto the same roots below. */
const TOPIC_KEYS: Record<DemoTopic, string[]> = {
  patients: ["patients", "overview"],
  alerts: ["alerts", "overview", "timeline"],
  notes: ["notes", "timeline"],
  tasks: ["tasks", "timeline"],
  checkins: ["checkins", "timeline"],
  appointments: ["appointments", "timeline"],
  notifications: ["notifications"],
  messages: ["messages"],
  reports: ["reports"],
  staff: ["staff", "overview"],
  devices: ["devices", "overview"],
  approvals: ["approvals", "overview"],
  audit: ["audit"],
  rules: ["rules"],
  plans: ["plans"],
};

function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => void ctx.close();
  } catch {
    /* Audio is optional; autoplay policies can block it. */
  }
}

/** Routes realtime events into the live store, refetches affected queries and raises toasts. */
export function RealtimeBridge() {
  const { realtime, data, home } = useWorkspace();
  const qc = useQueryClient();

  useEffect(() => {
    const live = useLiveStore.getState();
    live.reset();
    const refresh = (...keys: string[]) => keys.forEach((key) => void qc.invalidateQueries({ queryKey: [key] }));

    const offConnection = realtime.onConnectionChange((state) => useLiveStore.getState().setConnection(state));
    const offEvents = realtime.subscribe((event) => {
      switch (event.type) {
        case "reading.created":
          useLiveStore.getState().pushReading(event.patientId, event.reading);
          break;
        case "device.status":
          useLiveStore.getState().setDeviceHealth(event.deviceId, event.health);
          refresh("devices", "patients");
          break;
        case "alert.created": {
          refresh("alerts", "patients", "overview", "timeline");
          const { alert } = event;
          toast.push({
            tone: alert.severity === "attention" ? "attention" : alert.severity === "watch" ? "watch" : "info",
            title: `${ALERT_TYPE_LABEL[alert.alertType]} · ${alert.patientName}`,
            body: alert.roomLabel ? `${alert.roomLabel}. Review is recommended.` : "Review is recommended.",
            action: { label: "Open patient", href: `${home}/patients/${alert.patientId}` },
            durationMs: 8000,
          });
          if (useUiStore.getState().alertSound) chime();
          break;
        }
        case "alert.updated":
          refresh("alerts", "patients", "overview", "timeline");
          break;
        case "patient.status":
          refresh("patients");
          break;
        case "notification.created":
          refresh("notifications");
          break;
        case "message.created":
          refresh("messages");
          toast.push({ tone: "info", title: "New message", body: event.message.body.slice(0, 90), action: { label: "Open messages", href: `${home}/messages` } });
          break;
        case "task.updated":
          refresh("tasks");
          break;
      }
    });

    const offTopics = data.mode === "demo" ? getDemoState().on((topic) => refresh(...TOPIC_KEYS[topic])) : () => {};
    realtime.start();
    return () => {
      offEvents();
      offConnection();
      offTopics();
      realtime.stop();
    };
  }, [realtime, data, qc, home]);

  return null;
}

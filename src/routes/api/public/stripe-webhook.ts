import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) return new Response("no stripe", { status: 500 });
        const stripe = new Stripe(stripeKey);
        const sig = request.headers.get("stripe-signature") ?? "";
        const raw = await request.text();
        let event: Stripe.Event;
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        try {
          if (secret) event = stripe.webhooks.constructEvent(raw, sig, secret);
          else event = JSON.parse(raw) as Stripe.Event;
        } catch (e) {
          return new Response("invalid", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const s = event.data.object as Stripe.Checkout.Session;
          const m = s.metadata ?? {};
          const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

          if (m.kind === "subscription") {
            const now = new Date();
            const exp = new Date(now);
            if (m.period === "yearly") exp.setFullYear(exp.getFullYear() + 1);
            else if (m.period === "quarterly") exp.setMonth(exp.getMonth() + 3);
            else exp.setMonth(exp.getMonth() + 1);
            await sb.from("subscriptions").upsert({
              fan_id: m.fan_id, creator_id: m.creator_id, period: m.period,
              price_paid_cents: s.amount_total ?? 0, expires_at: exp.toISOString(),
              stripe_session_id: s.id, active: true,
            });
          } else if (m.kind === "post") {
            await sb.from("post_purchases").insert({
              post_id: m.post_id, buyer_id: m.buyer_id, amount_cents: Number(m.amount),
              stripe_session_id: s.id,
            });
          } else if (m.kind === "message_media") {
            await sb.from("message_media_purchases").insert({
              message_id: m.message_id, buyer_id: m.buyer_id, amount_cents: Number(m.amount),
              stripe_session_id: s.id,
            });
          }
        }
        return new Response("ok");
      },
    },
  },
});

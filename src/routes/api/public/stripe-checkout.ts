import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

async function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/public/stripe-checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "");
          if (!token) return Response.json({ error: "Auth required" }, { status: 401 });

          const sb = await admin();
          const { data: userData, error: uErr } = await sb.auth.getUser(token);
          if (uErr || !userData.user) return Response.json({ error: "Invalid session" }, { status: 401 });
          const user = userData.user;

          const stripeKey = process.env.STRIPE_SECRET_KEY;
          if (!stripeKey) return Response.json({ error: "Stripe non configuré" }, { status: 500 });
          const stripe = new Stripe(stripeKey);

          const body = await request.json() as { kind: string; creator_id?: string; period?: string; post_id?: string; message_id?: string };
          const origin = request.headers.get("origin") ?? new URL(request.url).origin;

          if (body.kind === "subscription") {
            const { data: plan } = await sb.from("subscription_plans").select("*").eq("creator_id", body.creator_id!).maybeSingle();
            if (!plan) return Response.json({ error: "Plan introuvable" }, { status: 404 });
            const priceCents = body.period === "yearly" ? plan.price_yearly_cents : body.period === "quarterly" ? plan.price_quarterly_cents : plan.price_monthly_cents;
            if (priceCents <= 0) return Response.json({ error: "Prix invalide" }, { status: 400 });
            const session = await stripe.checkout.sessions.create({
              mode: "payment",
              success_url: `${origin}/?checkout=success`,
              cancel_url: `${origin}/u/`,
              line_items: [{ price_data: { currency: "eur", unit_amount: priceCents, product_data: { name: `Abonnement Hush (${body.period})` } }, quantity: 1 }],
              metadata: { kind: "subscription", fan_id: user.id, creator_id: body.creator_id!, period: body.period! },
            });
            return Response.json({ url: session.url });
          }

          if (body.kind === "post") {
            const { data: post } = await sb.from("posts").select("*").eq("id", body.post_id!).maybeSingle();
            if (!post || post.ppv_price_cents <= 0) return Response.json({ error: "Post invalide" }, { status: 400 });
            const session = await stripe.checkout.sessions.create({
              mode: "payment",
              success_url: `${origin}/?unlock=success`,
              cancel_url: `${origin}/`,
              line_items: [{ price_data: { currency: "eur", unit_amount: post.ppv_price_cents, product_data: { name: "Déverrouillage Hush" } }, quantity: 1 }],
              metadata: { kind: "post", buyer_id: user.id, post_id: body.post_id!, amount: String(post.ppv_price_cents) },
            });
            return Response.json({ url: session.url });
          }

          if (body.kind === "message_media") {
            const { data: msg } = await sb.from("messages").select("*").eq("id", body.message_id!).maybeSingle();
            if (!msg || msg.ppv_price_cents <= 0) return Response.json({ error: "Message invalide" }, { status: 400 });
            const session = await stripe.checkout.sessions.create({
              mode: "payment",
              success_url: `${origin}/messages`,
              cancel_url: `${origin}/messages`,
              line_items: [{ price_data: { currency: "eur", unit_amount: msg.ppv_price_cents, product_data: { name: "Média Hush" } }, quantity: 1 }],
              metadata: { kind: "message_media", buyer_id: user.id, message_id: body.message_id!, amount: String(msg.ppv_price_cents) },
            });
            return Response.json({ url: session.url });
          }

          return Response.json({ error: "Kind inconnu" }, { status: 400 });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
        }
      },
    },
  },
});

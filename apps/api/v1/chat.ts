import { createClient } from "@supabase/supabase-js";

type ChatReq = {
  threadId?: string | null;
  input: string;
  mode?: "text" | "voice" | "meeting";
  activeProject?: string | null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const body = (req.body ?? {}) as ChatReq;
  if (!body.input || typeof body.input !== "string") {
    return res.status(400).json({ error: "Missing input" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // TODO: replace with Supabase Auth user later
  const user_id = "00000000-0000-0000-0000-000000000000";

  // Create thread if missing
  let threadId = body.threadId ?? null;
  if (!threadId) {
    const { data: t, error: te } = await supabase
      .from("threads")
      .insert({ user_id, title: "Mina" })
      .select("id")
      .single();
    if (te) return res.status(500).json({ error: te.message });
    threadId = t.id;
  }

  // Store user message
  const { error: me } = await supabase.from("messages").insert({
    thread_id: threadId,
    role: "user",
    content: body.input
  });
  if (me) return res.status(500).json({ error: me.message });

  // Audit log (input)
  await supabase.from("audit_log").insert({
    user_id,
    thread_id: threadId,
    event_type: "turn_input",
    event: {
      mode: body.mode ?? "text",
      activeProject: body.activeProject ?? null,
      input: body.input
    }
  });

  // Placeholder Mina response (we’ll swap to model call next)
  const reply =
    "Acknowledged. I have your message. Next step is wiring the model call and enforcing the charter.";

  // Store assistant message
  const { data: am, error: ae } = await supabase
    .from("messages")
    .insert({ thread_id: threadId, role: "assistant", content: reply })
    .select("id")
    .single();
  if (ae) return res.status(500).json({ error: ae.message });

  // Audit log (output)
  await supabase.from("audit_log").insert({
    user_id,
    thread_id: threadId,
    event_type: "turn_output",
    event: { reply, assistant_message_id: am.id }
  });

  return res.status(200).json({ threadId, reply });
}
